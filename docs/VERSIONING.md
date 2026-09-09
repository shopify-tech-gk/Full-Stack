# Versioning Workflow

This repo follows a simple, consistent git workflow for the rest of the project.

## Commits

- One commit per **approved** prompt.
- Message format: `type(chapter.prompt): short description`
- Conventional-commit types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.

Examples:
```
feat(3.1a): shared config package
feat(3.2): OTP request and verify
fix(2.4): pg pool clean shutdown in db client factory
```

## Pushing

- Push each prompt's commit to `origin/main` immediately after it's approved.
- No force-pushes, no history rewrites.

## Chapter tags

- One annotated tag per completed chapter: `chapter-N-complete`.
- Tag message briefly describes what the chapter delivered.
- Push tags alongside the commit: `git push origin --tags`.

## Secrets

- `.env` and any file with real secrets are **never** committed.
- Only `.env.example` (the safe template) is tracked.
