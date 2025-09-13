const Anthropic = require('@anthropic-ai/sdk');

async function generate(analysis, apiKey) {
    try {
        const anthropic = new Anthropic({ apiKey });

        const prompt = `
You are a helpful Git commit analyst. Based on the following commit analysis (including files changed, diffs, and context), generate:

1. A verbose, detailed commit message (2-4 sentences) explaining what was done, why, and any impacts. Make it professional and clear—avoid vague terms like "fixed" or "updated."

2. A concise summary (1 sentence) for quick overview.

Commit Analysis:
${JSON.stringify(analysis, null, 2)}

Output in JSON: {"message": "...", "summary": "..."}
`;

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',  // Latest Sonnet; swap to 'claude-3-opus-20240229' for more complex tasks
            max_tokens: 1024,
            temperature: 0.7,  // Balanced creativity
            messages: [{ role: 'user', content: prompt }],
        });

        if (!response.content || !response.content[0].text) {
            throw new Error('No response from Claude');
        }

        // Parse JSON from response (Claude outputs structured text)
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