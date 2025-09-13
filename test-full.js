const diffAnalyzer = require('./src/diffAnalyzer');
const llmGenerator = require('./src/llmGenerator');
const fileUpdater = require('./src/fileUpdater');

// Mock GitHub context
const context = {
    sha: 'abc1234567890abcdef1234567890abcdef1234',
    ref: 'refs/heads/main',
    repo: { owner: 'test-user', repo: 'test-repo' }
};

// Mock commit data (simulates Octokit response)
const commit = {
    files: [
        {
            filename: 'src/index.js',
            status: 'modified',
            additions: 5,
            deletions: 2,
            patch: '@@ -10,2 +10,5 @@ function example() {\n-  console.log("old");\n+  console.log("new");\n+  return true;\n}'
        },
        {
            filename: 'README.md',
            status: 'added',
            additions: 10,
            patch: '@@ -0,0 +1,10 @@ # Project\nNew readme content.'
        }
    ],
    parents: [{ sha: 'def456' }]  // Single parent (not a merge)
};

// Mock Octokit (simulates file get/update)
const octokit = {
    rest: {
        repos: {
            getContent: jest.fn().mockImplementation(({ path }) => {
                if (path === 'papertrail.md') {
                    return Promise.resolve({
                        data: {
                            sha: 'xyz789',
                            content: Buffer.from('# Papertrail\n\nExisting content\n').toString('base64')
                        }
                    });
                }
                throw { status: 404 };
            }),
            createOrUpdateFileContents: jest.fn().mockResolvedValue({ data: { commit: { sha: 'new-commit-sha' } } })
        }
    }
};

// Mock @actions/core for outputs
const core = {
    getInput: jest.fn(name => {
        const inputs = {
            'gemini-api-key': 'fake-key',
            'repo-token': 'fake-token',
            'papertrail-path': 'papertrail.md'
        };
        return inputs[name];
    }),
    setOutput: jest.fn(),
    setFailed: jest.fn(),
    debug: console.log
};

async function testFullFlow() {
    console.log('Starting test...');

    // Set stub mode
    process.env.STUB_LLM = 'true';

    try {
        // Step 1: Analyze diff
        const analysis = diffAnalyzer.analyze(commit.files, commit);
        console.log('Diff Analysis:', JSON.stringify(analysis, null, 2));

        // Step 2: Generate message/summary
        const { message, summary } = await llmGenerator.generate(analysis, 'fake-key');
        console.log('Generated Message:', message);
        console.log('Generated Summary:', summary);

        // Step 3: Update papertrail.md
        await fileUpdater.update('papertrail.md', context.sha, message, summary, octokit, context);
        console.log('File Update Args:', octokit.rest.repos.createOrUpdateFileContents.mock.calls[0][0]);

        // Verify outputs
        expect(core.setOutput).toHaveBeenCalledWith('summary', summary);
        expect(octokit.rest.repos.createOrUpdateFileContents).toHaveBeenCalled();
        console.log('Test passed: Action flow completed.');
    } catch (error) {
        console.error('Test failed:', error.message);
        core.setFailed(error.message);
    }
}

// Run test
testFullFlow().catch(console.error);