const { analyze } = require('../src/diffAnalyzer');
jest.mock('@octokit/rest');  // Mock for fileUpdater if needed

test('analyzes files correctly', () => {
    const files = [{ filename: 'foo.js', status: 'added', additions: 5 }];
    const commit = { parents: [] };
    const result = analyze(files, commit);
    expect(result.summary).toContain('foo.js');
    expect(result.stats.added).toBe(5);
});