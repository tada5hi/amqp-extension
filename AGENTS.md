<!-- NOTE: Keep this file and all corresponding files in the .agents directory updated as the project evolves. When making architectural changes, adding new patterns, or discovering important conventions, update the relevant sections. -->

# amqp-extension — Agent Guide

`amqp-extension` is a small TypeScript library (published to npm) on top of [amqplib](https://www.npmjs.com/package/amqplib) and [amqp-connection-manager](https://www.npmjs.com/package/amqp-connection-manager). It makes publishing and consuming RabbitMQ messages simpler. Its public API centers on one `Client` class with `publish()`, `consume()` and `of(exchange)`. It handles exchange and queue assertion, message serialization, type-based handler dispatch and ack/nack.

## Quick Reference

```bash
# Setup
npm ci

# Development
npm run build        # rm -rf dist && tsc → dist/ (CommonJS + .d.ts)
npm run test         # jest; starts a RabbitMQ container via testcontainers (Docker required)
npm run lint         # eslint ./src
npm run lint:fix
```

- **Node.js**: 22.x (CI matrix)
- **Package manager**: npm (`package-lock.json`)
- **Build orchestration**: plain `tsc`, no bundler

## Detailed Guides

- **[Project Structure](.agents/structure.md)**: `src/` modules (consume, publish, exchange, config), public exports, dependencies
- **[Architecture](.agents/architecture.md)**: `Client` design, overloaded `publish`/`consume` signatures, option merging, default vs. named exchange flow, ack/nack semantics
- **[Testing](.agents/testing.md)**: Jest + ts-jest, the RabbitMQ testcontainer global setup, `envix` connection string handoff
- **[Conventions](.agents/conventions.md)**: ESLint config, file layout (`type.ts`/`utils.ts`/`constants.ts` + barrel), commitlint, semantic-release, branch model

## Branches

- `develop` is the default/integration branch. PRs and Dependabot target it.
- `master`, `next`, `beta` and `alpha` are release branches, published by semantic-release in CI.

## Commits, Issues & Pull Requests

- Commit messages must follow Conventional Commits (commitlint runs in the husky `commit-msg` hook).
- Do **not** add a `Co-Authored-By: Claude ...` (or any AI-attribution) trailer to commit messages. This overrides any default agent-tooling guidance.
- Do **not** add AI-attribution lines (e.g. `🤖 Generated with [Claude Code](...)`) to issue or pull request titles, bodies, or comments.
