const { createOrUpdateFileContents } = require('@octokit/rest').repos;  // For clarity, but use octokit instance

/**
 * Appends commit details to papertrail.md via GitHub API.
 * @param {string} path - File path (e.g., 'papertrail.md').
 * @param {string} sha - Commit SHA.
 * @param {string} message - Verbose message from LLM.
 * @param {string} summary - Concise summary from LLM.
 * @param {Object} octokit - Authenticated Octokit instance.
 * @param {Object} context - GitHub context (repo, ref).
 * @returns {Promise<void>}.
 */
async function update(path, sha, message, summary, octokit, context) {
    const { owner, repo } = context.repo;
    const branch = context.ref.replace('refs/heads/', '');  // e.g., 'main' from 'refs/heads/main'

    try {
        // Get existing file (handle 404 for creation)
        let existingSha, existingContent;
        try {
            const { data: file } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path,
                ref: branch
            });
            existingSha = file.sha;
            existingContent = Buffer.from(file.content, 'base64').toString('utf8');
        } catch (error) {
            if (error.status !== 404) throw error;
            // File doesn't exist: Create fresh
            existingContent = '# Papertrail\n\nThis file tracks commit summaries and details.';
            existingSha = null;
        }

        // Prepare new section (append at end)
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');  // e.g., '2025-09-12 10:30:45'
        const newSection = `\n\n## Commit ${sha.slice(0, 7)} (${timestamp})\n\n**Summary:** ${summary}\n\n**Details:** ${message}\n\n---`;
        const updatedContent = existingContent + newSection;

        // Encode and commit
        const base64Content = Buffer.from(updatedContent, 'utf8').toString('base64');
        const commitMessage = `Append analysis for commit ${sha.slice(0, 7)}`;

        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path,
            message: commitMessage,
            content: base64Content,
            sha: existingSha,  // Null for create
            branch
        });

        console.log(`Updated ${path} successfully for commit ${sha}`);
    } catch (error) {
        if (error.status === 409) {
            throw new Error('Conflict updating file; possible concurrent edit. Retry or check branch.');
        }
        throw new Error(`File update failed: ${error.message}`);
    }
}

module.exports = { update };