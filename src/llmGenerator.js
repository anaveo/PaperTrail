const { GoogleGenerativeAI } = require('@google/generative-ai');
const crypto = require('crypto');

const adjectives = ['Robust', 'Swift', 'Elegant', 'Dynamic', 'Stable', 'Vivid', 'Clear', 'Bold'];

/**
 * Generates commit message and summary, with stub mode for testing.
 * @param {Object} analysis - Diff analysis from diffAnalyzer.
 * @param {string} apiKey - Gemini API key.
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

        // Normal mode: Call Gemini
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });  // Fast model; swap to 'gemini-1.5-pro' for advanced tasks

        const prompt = `You are a helpful Git commit analyst. Based on the following commit analysis (including files changed, diffs, and context), generate:

1. A verbose, detailed commit message (2-4 sentences) explaining what was done, why, and any impacts. Make it professional and clear—avoid vague terms like "fixed" or "updated." Append a unique adjective in brackets at the end (e.g., [Robust]).

2. A concise summary (1 sentence) for quick overview.

Commit Analysis:
${JSON.stringify(analysis, null, 2)}

Output in JSON: {"message": "...", "summary": "..."}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        if (!text) {
            throw new Error('No response from Gemini');
        }

        // Parse JSON from response (Gemini outputs structured text)
        const output = JSON.parse(text);
        return {
            message: output.message,
            summary: output.summary
        };
    } catch (error) {
        throw new Error(`LLM generation failed: ${error.message}`);
    }
}

module.exports = { generate };