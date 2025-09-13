const { generate } = require('../src/llmGenerator');

// Helper to reset env between tests
afterEach(() => {
    delete process.env.STUB_LLM;
});

// Test stub mode (no API call, verifies adjective append)
test('generates stubbed message and summary', () => {
    process.env.STUB_LLM = 'true';
    const analysis = {
        files: [{ filename: 'foo.js', status: 'added', additions: 5 }],
        stats: { added: 5, deleted: 0, total: 1 },
        isMerge: false
    };
    return generate(analysis, 'fake-key').then(result => {
        expect(result.message).toContain('Modified files: foo.js');
        expect(result.message).toMatch(/\[\w+\]$/);  // Matches [Adjective] at end
        expect(result.summary).toContain('Updated 1 files');
    });
});

// Test real mode with mocked Gemini SDK (flatter mock to avoid nesting errors)
jest.mock('@google/generative-ai', () => {
    const mockGenAI = {
        getGenerativeModel: jest.fn(() => ({
            generateContent: jest.fn(() => Promise.resolve({
                response: {
                    text: () => '{"message": "Test verbose msg [Robust]", "summary": "Test summary"}'
                }
            }))
        }))
    };

    mockGenAI.GoogleGenerativeAI = jest.fn(() => mockGenAI);

    return mockGenAI;
});

test('generates message and summary from Gemini', () => {
    process.env.STUB_LLM = 'false';
    const analysis = {
        files: [{ filename: 'foo.js', status: 'added', additions: 5 }],
        stats: { added: 5, deleted: 0, total: 1 },
        isMerge: false
    };
    return generate(analysis, 'fake-key').then(result => {
        expect(result.message).toBe('Test verbose msg [Robust]');
        expect(result.summary).toBe('Test summary');
    });
});

// Bonus: Test error handling (e.g., invalid JSON response)
test('handles LLM generation error', () => {
    process.env.STUB_LLM = 'false';

    // Temporarily override mock to throw
    const originalGenAI = require('@google/generative-ai');
    jest.doMock('@google/generative-ai', () => ({
        GoogleGenerativeAI: jest.fn(() => ({
            getGenerativeModel: jest.fn(() => ({
                generateContent: jest.fn(() => Promise.resolve({
                    response: {
                        text: () => 'Invalid JSON'  // Triggers parse error
                    }
                }))
            }))
        }))
    }));

    const analysis = { files: [], stats: { added: 0, deleted: 0, total: 0 }, isMerge: false };
    return expect(generate(analysis, 'fake-key')).rejects.toThrow('LLM generation failed');
});