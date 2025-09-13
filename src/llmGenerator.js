const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');

const adjectives = ['Robust', 'Swift', 'Elegant', 'Dynamic', 'Stable', 'Vivid', 'Clear', 'Bold'];

/**
 * Generates commit message and summary, with stub mode for testing.
 * @param {Object} analysis - Diff analysis from diffAnalyzer.
 * @param {string} apiKey - Anthropic API key.
 * @returns {Promise<{message: string, summary: string}>}
 */
async function generate(analysis, apiKey) {
    try {
        // Stub mode for testing (set env var STUB_LLM=true)
        if (process.env.STUB_LLM === 'true') {
            const randomAdjective = adjectives[crypto.randomInt(adjectives.length)];
            const fileList = analysis.files.map(f => f.filename).join(', ') || 'no files';
            const message = `Modified files: ${fileList}. Changes include ${analysis.stats.added} additions and ${analysis.stats.deleted} deletions. This update improves functionality. [${randomAdjective}]`;
            const summary = `Updated ${analysis.stats.total} files with ${analysis.stats.added} additions.`;
            return { message, summary };
        }

        // Normal mode: Call Claude
        const anthropic = new Anthropic({ apiKey });
        const prompt = `
You are a helpful Git commit analyst. Based on the following commit analysis (including files changed, diffs, and context), generate:

1. A verbose, detailed commit message (2-4 sentences) explaining what was done, why, and any impacts. Make it professional and clear—avoid vague terms like "fixed" or "updated." Append a unique adjective in brackets at the end (e.g., [Robust]).

2. A concise summary (1 sentence) for quick overview.

Commit Analysis:
${JSON.stringify(analysis, null, 2)}

Output in JSON: {"message": "...", "summary": "..."}
`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            temperature: 0.7,
            messages: [{ role: 'user', content: prompt }],
        });

        if (!response.content || !response.content[0].text) {
            throw new Error('No response from Claude');
        }

        const output = JSON.parse(response.content[0].text);
        return {
            message: output.message,
            summary: output.summary
        };
    } catch (error) {
        throw new Error(`LLM generation failed: ${error.message}`);
    }
}

module.exports = { generate };