const parseDiff = require('parse-diff');  // For parsing unified diff patches

/**
 * Analyzes commit files into a summary for LLM prompting.
 * @param {Array} files - Commit files array from GitHub API (e.g., [{filename, status, patch, additions, deletions}]).
 * @param {Object} commit - Full commit object (for parents/SHA detection).
 * @returns {Object} Analysis: { summary: string, files: Array<{filename, status, changes: string}>, stats: {added, deleted, total}, isMerge: boolean }.
 */
function analyze(files, commit) {
    if (!files || files.length === 0) {
        return { summary: 'No files changed in this commit.', files: [], stats: { added: 0, deleted: 0, total: 0 }, isMerge: false };
    }

    let totalAdded = 0;
    let totalDeleted = 0;
    const fileSummaries = [];
    const isMerge = commit.parents && commit.parents.length > 1;

    files.forEach(file => {
        const { filename, status, patch, additions = 0, deletions = 0 } = file;
        totalAdded += additions;
        totalDeleted += deletions;

        // Parse patch for detailed changes (limit to first 3 chunks for brevity)
        let changes = 'No patch available.';
        if (patch) {
            try {
                const parsed = parseDiff(patch);
                const chunks = parsed.chunks || [];
                changes = chunks.slice(0, 3).map(chunk =>
                    `Chunk: Lines ${chunk.fromFileRange.start}-${chunk.fromFileRange.end} -> ${chunk.toFileRange.start}-${chunk.toFileRange.end}. Changes: ${chunk.changes.map(c => c.type).join(', ')}`
                ).join('; ') || 'Empty patch.';
            } catch (error) {
                changes = `Raw patch snippet: ${patch.substring(0, 500)}...`;  // Fallback truncate
            }
        }

        fileSummaries.push({
            filename,
            status,  // e.g., 'added', 'modified', 'removed', 'renamed'
            changes: `${additions} lines added, ${deletions} lines deleted. ${changes}`
        });
    });

    const summary = `Commit changed ${files.length} files (${totalAdded} added, ${totalDeleted} deleted lines). ${isMerge ? 'This is a merge commit.' : ''} Files: ${fileSummaries.map(f => f.filename).join(', ')}`;

    return {
        summary,
        files: fileSummaries,
        stats: { added: totalAdded, deleted: totalDeleted, total: files.length },
        isMerge
    };
}

module.exports = { analyze };