<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

# amqp-extension — Agent Guide

`amqp-extension` is a small, ESM-only TypeScript library (published to npm) on top of [amqplib](https://www.npmjs.com/package/amqplib) and [amqp-connection-manager](https://www.npmjs.com/package/amqp-connection-manager). It makes publishing and consuming RabbitMQ messages simpler. Its public API centers on one `Client` class with `publish()`, `consume()` and `of(exchange)`. It handles exchange and queue assertion, message serialization, type-based handler dispatch and ack/nack.

Tooling follows [tada5hi/typescript-template](https://github.com/tada5hi/typescript-template): tsdown, Vitest, ESLint flat config, release-please.

## Quick Reference

```bash
# Setup
npm ci

# Development
npm run build          # tsdown: src/index.ts → dist/index.mjs + index.d.mts
npm run test           # vitest --run; starts a RabbitMQ container via testcontainers (Docker required)
npm run test:coverage  # vitest with v8 coverage + 80% thresholds
npm run lint           # eslint (flat config)
npm run lint:fix
npx tsc --noEmit       # standalone type check (tsconfig has noEmit)
```

- **Node.js**: `>=22.0.0` (CI runs on 24)
- **Package manager**: npm (`package-lock.json`)
- **Build tool**: tsdown (single package, no orchestrator)

## Detailed Guides

- **[Project Structure](.agents/structure.md)**: `src/` modules (consume, publish, exchange, queue), public exports, dependencies
- **[Architecture](.agents/architecture.md)**: `Client` design, overloaded `publish`/`consume` signatures, topology planning (`planTopology`/`assertTopology`), `handleMessage` settlement, setup-failure rejection, option merging
- **[Testing](.agents/testing.md)**: Vitest setup, the RabbitMQ testcontainer global setup, the `provide`/`inject` connection string handoff
- **[Conventions](.agents/conventions.md)**: ESLint config, file layout (`type.ts`/`utils.ts`/`constants.ts` + barrel), commitlint, release-please, CI

## Branches

- `master` is the release branch. release-please runs on pushes to `master`, and Dependabot targets it.
- CI also runs on `develop`, `next`, `beta` and `alpha`.

## Commits, Issues & Pull Requests

- Commit messages must follow Conventional Commits (commitlint runs in the husky `commit-msg` hook). release-please derives versions and `CHANGELOG.md` from them.
- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Do **not** add AI-attribution lines (e.g. `🤖 Generated with [Claude Code](...)`) to issue or pull request titles, bodies, or comments.
