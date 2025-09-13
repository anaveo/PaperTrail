async function run() {
    let apiKey, token, papertrailPath, octokit, context;

    try {
        apiKey = core.getInput('gemini-api-key', { required: true });
        token = core.getInput('repo-token');
        papertrailPath = core.getInput('papertrail-path');

        core.debug(`Inputs: apiKey=${apiKey ? 'set' : 'missing'}, token=${token ? 'set' : 'missing'}, path=${papertrailPath}`);

        octokit = github.getOctokit(token);
        context = github.context;

        core.debug(`Context: sha=${context.sha}, ref=${context.ref}, eventName=${context.eventName}, before=${context.payload.before || 'none'}`);

        let analysis, isMerge = false;
        const isLocalMock = process.env.ACT === 'true' && token === 'fake-local-token';

        if (isLocalMock) {
            core.debug('Local mock mode: Simulating diff...');
            // Mock diff (updated: Simulate files from 'before' to 'after' for consistency)
            const mockFiles = [
                {
                    filename: 'src/test.js',
                    status: 'modified',
                    additions: 1,
                    deletions: 0,
                    patch: '@@ -1 +1 @@ console.log("Updated");'
                }
            ];
            analysis = {
                summary: `Mock commit changed ${mockFiles.length} files...`,
                files: mockFiles.map(f => ({ filename: f.filename, status: f.status, changes: `${f.additions} added, ${f.deletions} deleted. Patch: ${f.patch}` })),
                stats: { added: 1, deleted: 0, total: 1 },
                isMerge: context.ref.includes('merge')  // Simulate merge detection
            };
            core.debug(`Mock analysis: ${JSON.stringify(analysis, null, 2)}`);
        } else {
            // Real mode: Use compareCommits for full diff (handles merges/branches)
            core.debug('Fetching real diff via compareCommits...');
            const beforeSha = context.payload.before || '0000000000000000000000000000000000000000';  // Root for initial commits
            const { data } = await octokit.rest.repos.compareCommits({
                owner: context.repo.owner,
                repo: context.repo.repo,
                basehead: `${beforeSha}...${context.sha}`  // Diff from before to current
            });
            const files = data.files || [];  // Array of {filename, status, additions, deletions, patch}
            isMerge = data.status === 'behind' || data.total_commits > 1;  // Detect merge via status or commits

            core.debug(`Diff fetched: ${files.length} files, status=${data.status}, isMerge=${isMerge}`);

            // Modular: Analyze diffs
            analysis = diffAnalyzer.analyze(files, { parents: isMerge ? [{}, {}] : [] });  // Pass mock parents for isMerge
            core.debug(`Analysis: ${JSON.stringify(analysis, null, 2)}`);
        }

        // Modular: Generate via LLM (stubbed or real)
        core.debug('Generating message/summary...');
        const { message, summary } = await llmGenerator.generate(analysis, apiKey);
        core.debug(`Generated: message=${message}, summary=${summary}`);

        // Modular: Update file
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