const core = require('@actions/core');
const github = require('@actions/github');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { execSync } = require('child_process');

async function run() {
    try {
        const apiKey = core.getInput('gemini-api-key', { required: true });
        const context = github.context;
        const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

        core.debug(`Context: sha=${context.sha}, before=${context.payload.before || 'none'}`);

        // Get diff files (merge/branch-tolerant)
        const beforeSha = context.payload.before || '0000000000000000000000000000000000000000';
        let files = [];
        const isInitial = beforeSha === '0000000000000000000000000000000000000000';

        if (process.env.ACT === 'true') {
            // Mock for local act
            files = [{ filename: 'test.txt', status: 'modified', additions: 1, patch: '@@ -1 +1 @@ +Updated content' }];
        } else if (isInitial) {
            const { data } = await octokit.rest.repos.getCommit({
                owner: context.repo.owner,
                repo: context.repo.repo,
                commit_sha: context.sha,
            });
            files = data.files || [];
        } else {
            const { data } = await octokit.rest.repos.compareCommits({
                owner: context.repo.owner,
                repo: context.repo.repo,
                basehead: `${beforeSha}...${context.sha}`,
            });
            files = data.files || [];
        }

        core.debug(`Files: ${JSON.stringify(files, null, 2)}`);

        // Summarize diff for prompt
        const summary = files.length
            ? `Modified ${files.length} files: ${files.map(f => f.filename).join(', ')}. ${files.reduce((sum, f) => sum + (f.additions || 0), 0)} additions, ${files.reduce((sum, f) => sum + (f.deletions || 0), 0)} deletions.`
            : 'No file changes detected.';
        const patches = files.map(f => f.patch || 'No patch').join('\n');

        // Generate message with Gemini (stubbed option)
        let message;
        if (process.env.STUB_LLM === 'true') {
            message = `Stubbed: ${summary} [Mocked]`;
        } else {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const prompt = `Generate a clear, concise commit message (20-50 words) based on this diff summary and patches. Avoid vague terms like "fix bug". Append a random positive adjective in brackets (e.g., [Clear]).\n\nSummary: ${summary}\n\nPatches:\n${patches}`;
            const result = await model.generateContent(prompt);
            message = result.response.text().trim();
        }

        core.info(`Generated message: ${message}`);

        // Amend commit (set identity, preserve original)
        execSync(`git config user.name "${context.actor}" && git config user.email "${context.actor}@github-actions[bot].com"`, { stdio: 'inherit' });
        const originalMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
        const amendedMessage = `${message} (was: ${originalMessage})`;
        execSync(`git commit --amend -m "${amendedMessage.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
        execSync('git push origin HEAD --force', { stdio: 'inherit' });

        core.info('Commit amended successfully');
    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();