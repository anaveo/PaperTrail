/**
 * Appends commit details to papertrail.md via GitHub API.
 * @param {string} path - File path (e.g., 'papertrail.md').
 * @param {string} sha - Commit SHA.
 * @param {string} message - Verbose message from LLM.
 * @param {string} summary - Concise summary from LLM.
 * @param {Object} octokit - Authenticated Octokit instance (from @actions/github).
 * @param {Object} context - GitHub context (repo, ref).
 * @returns {Promise<void>}.
 */
async function update(path, sha, message, summary, octokit, context) {
    const { owner, repo } = context.repo;
    const branch = context.ref.replace('refs/heads/', '');  // e.g., 'main'

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
            existingSha = undefined;  // Use undefined for create (avoids 409 errors)
        }

        // Prepare new section (append at end)
        const timestamp = new Date(Date.parse(context.payload.head_commit.timestamp) || Date.now()).toISOString().slice(0, 19).replace('T', ' ');  // Use commit timestamp if available
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
            sha: existingSha,
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