# PaperTrail Commit Enhancer

Analyzes commit diffs and generates clean messages using Gemini LLM.

## Usage
```yaml
- uses: anaveo/PaperTrail@v0.0.7
  with:
    gemini-api-key: ${{ secrets.GEMINI_API_KEY }}
  env:
    STUB_LLM: true  # For testing