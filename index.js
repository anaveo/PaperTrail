const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const diffAnalyzer = require('./src/diffAnalyzer');
const llmGenerator = require('./src/llmGenerator');
const fileUpdater = require('./src/fileUpdater');

async function run() {
    let apiKey, token, papertrailPath, octokit, context;

    try {
        apiKey = core.getInput('gemini-api-key', { required: true });  // Updated input
        token = core.getInput('repo-token');
        papertrailPath = core.getInput('papertrail-path');

        core.debug(`Inputs: apiKey=${apiKey ? 'set' : 'missing'}, token=${token ? 'set' : 'missing'}, path=${papertrailPath}`);

        octokit = github.getOctokit(token);
        context = github.context;

        core.debug(`Context: sha=${context.sha}, ref=${context.ref}, repo=${JSON.stringify(context.repo)}`);

        let commit;
        const isLocalMock = process.env.ACT === 'true' && token === 'fake-local-token';  // Mock mode unchanged

        if (isLocalMock) {
            core.debug('Local mock mode: Simulating Octokit calls');
            // Mock commit (unchanged)
            commit = {
                sha: context.sha,
                files: [
                    {
                        filename: 'src/mock.js',
                        status: 'modified',
                        additions: 3,
                        deletions: 1,
                        patch: '@@ -1,1 +1,3 @@ \n- old code\n+ new code\n+ improved logic'
                    }
                ],
                parents: context.ref.includes('merge') ? [{ sha: 'parent-sha-1' }, { sha: 'parent-sha-2' }] : [{ sha: 'parent-sha' }]
            };
            core.debug(`Mock commit: ${commit.sha}, files: ${commit.files.length}, isMerge: ${commit.parents.length > 1}`);
        } else {
            // Real mode: Fetch from API (unchanged)
            core.debug('Fetching real commit data...');
            const { data: fetchedCommit } = await octokit.rest.repos.getCommit({
                owner: context.repo.owner,
                repo: context.repo.repo,
                commit_sha: context.sha,
            });
            commit = fetchedCommit;
            core.debug(`Real commit fetched: ${commit.sha}, parents: ${commit.parents?.length || 0}`);
        }

        // Modular: Analyze diffs (unchanged)
        core.debug('Analyzing diffs...');
        const analysis = diffAnalyzer.analyze(commit.files, commit);
        core.debug(`Analysis: ${JSON.stringify(analysis, null, 2)}`);

        // Modular: Generate via LLM (stubbed or real)
        core.debug('Generating message/summary...');
        const { message, summary } = await llmGenerator.generate(analysis, apiKey);
        core.debug(`Generated: message=${message}, summary=${summary}`);

        // Modular: Update file (unchanged)
        core.debug('Updating papertrail.md...');
        if (isLocalMock) {
            // Local mock write (unchanged)
            const fullPath = path.resolve(papertrailPath);
            let existingContent = '';
            try {
                existingContent = fs.readFileSync(fullPath, 'utf8');
            } catch (e) {
                existingContent = '# Papertrail\n\nThis file tracks commit summaries and details.';
            }
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const newSection = `\n\n## Commit ${context.sha.slice(0, 7)} (${timestamp})\n\n**Summary:** ${summary}\n\n**Details:** ${message}\n\n---`;
            const updatedContent = existingContent + newSection;
            fs.writeFileSync(fullPath, updatedContent);
            core.debug(`Local file updated at ${fullPath}`);
        } else {
            await fileUpdater.update(papertrailPath, context.sha, message, summary, octokit, context);
        }
        core.debug('File update complete');

        core.setOutput('summary', summary);
        core.debug('Action succeeded');
    } catch (error) {
        core.debug(`Full error: ${error.message} | Stack: ${error.stack}`);
        core.error(`Action error details: ${error.message}`);
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();