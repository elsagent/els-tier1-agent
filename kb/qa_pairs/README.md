# Few-shot QA pairs

Every `.md` file in this folder is concatenated into the system prompt as few-shot examples for all three agents (triage / tier-1 / tier-2).

## Format

Each file: a single user-assistant exchange, markdown. Keep it short.

```markdown
**User:** <customer's message>

**Agent:** <ideal response — voice we want to see>
```

## Rules for adding examples

- **Demonstrate the voice you want.** These examples teach the model by imitation — they are more powerful than any rule.
- **No forbidden tokens.** The `kb/persona/04_linguistic.md` rules apply here too. No em-dashes, curly quotes, "Great question", etc.
- **Show one-step-at-a-time pacing.** The response should check in with the user rather than dumping the full procedure.
- **Stay SALTO-only.** No other brands.

## When to add vs. when to edit

- **Add** a file when you have a brand new scenario not yet represented.
- **Edit** an existing file when the scenario is already covered but the response isn't a strong enough example.
- File names sort alphabetically and that determines prompt order. Use `NN_snake_case.md` so inserts are easy.

## Cost note

Everything here ships on every request. Keep the total corpus under ~3000 tokens. If it grows larger, move older examples out or summarize them.
