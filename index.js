const core = require('@actions/core');
const github = require('@actions/github');
const diff = require('diff');
const diffAnalyzer = require('./src/diffAnalyzer');
const llmGenerator = require('./src/llmGenerator');
const fileUpdater = require('./src/fileUpdater');

async function run() {
    try {
        const apiKey = core.getInput('anthropic-api-key', { required: true });  // Updated input
        const token = core.getInput('repo-token');
        const papertrailPath = core.getInput('papertrail-path');

        const octokit = github.getOctokit(token);
        const context = github.context;

        // Get commit diff (handles branches/merges via before/after SHAs)
        const { data: commit } = await octokit.rest.repos.getCommit({
            owner: context.repo.owner,
            repo: context.repo.repo,
            commit_sha: context.sha,
        });

        // Modular: Analyze diffs
        const analysis = diffAnalyzer.analyze(commit.files);

        // Modular: Generate via Claude
        const { message, summary } = await llmGenerator.generate(analysis, apiKey);  // Pass key directly

        // Modular: Update file (append to papertrail.md)
        await fileUpdater.update(papertrailPath, context.sha, message, summary, octokit, context);

        core.setOutput('summary', summary);
    } catch (error) {
        core.setFailed(`Action failed: ${error.message}`);
    }
}

run();