# Conventions

## Tooling

| Tool               | Purpose                                                          |
|--------------------|------------------------------------------------------------------|
| TypeScript 5       | Compile `src/` → `dist/` (extends `@tada5hi/tsconfig`)           |
| ESLint 8           | `@tada5hi/eslint-config-typescript`, `.eslintrc` (legacy config) |
| Jest + ts-jest     | Tests (see testing.md)                                           |
| husky + commitlint | `commit-msg` hook, `@tada5hi/commitlint-config`                  |
| semantic-release   | `@tada5hi/semantic-release` preset, runs in CI                   |
| Dependabot         | Daily npm + actions updates targeting `develop`                  |

## Workflow

- After making changes, **always** run `npm run build` and `npm run lint`. Run `npm run test` when Docker is available.
- When public API or behavior changes, update `README.MD` (Usage section).
- Do not edit `CHANGELOG.md` by hand. semantic-release generates it.

## Code Style

- **Module format**: TypeScript source with ES `import`/`export`, compiled to CommonJS (`module: commonjs`, `target: ES2020`). Test helper JS files use `require`.
- **Indentation**: 4 spaces, LF, UTF-8, final newline (`.editorconfig`)
- **Linting**: Airbnb-style base via `@tada5hi/eslint-config-typescript`. Local overrides allow underscore-prefixed params (`_ctxOrFrom`) and `class-methods-use-this`, and set `import/no-cycle` to maxDepth 1.
- Use `import type` for type-only imports.
- Most files start with the copyright header block (`Copyright (c) <year>. Author Peter Placzek (tada5hi) ...`). Add it to new files.

## Naming Conventions

| Suffix / form   | When to use                                    | Examples                                        |
|-----------------|------------------------------------------------|-------------------------------------------------|
| `*Options`      | Options passed to broker calls, mostly `amqplib` `Options.*` aliases/extensions | `PublishOptions`, `ConsumeOptions`, `ExchangeOptions` |
| `*Context`      | Object-form input for a method or constructor  | `ClientContext`, `ConsumeContext`, `PublishContext` |
| `is*`           | Type guards                                    | `isConsumeHandlers`, `isExchange`, `isDefaultExchange` |
| Enum + template literal | Accept enum values as plain strings    | `type: \`${ExchangeType}\`` |

## File Organization

Each feature directory under `src/` uses the following files:

- `type.ts`: exported types
- `constants.ts`: enums and constant keys
- `utils.ts`: guards and helpers
- `index.ts`: barrel that re-exports the files above

New public modules must also be re-exported from `src/index.ts`.

## Commit Convention

Commits follow **Conventional Commits**, enforced by commitlint:

```
<type>(<optional scope>): <subject>

feat: allow queue options for the named queue of the default exchange
build(deps-dev): remove @types/uuid dependency
```

Dependabot uses the `fix` prefix for prod deps and `build` for dev deps.

## Build Output

`dist/` contains `.js` (CommonJS) and `.d.ts` files. `prepublishOnly` runs the build. `.npmignore` excludes `src`, `test` and config files.

## Release Process

semantic-release runs on every push to `master`, `next`, `beta`, `alpha` or `develop` in CI. It derives the version from the commit types, publishes to npm, and updates `CHANGELOG.md` and the GitHub release. `develop`, `beta` and `next` are prerelease channels (e.g. `4.0.0-beta.x`).

## Best Practices

- Reuse `amqplib` option types instead of redefining them. Extend them with intersections (`Options.Consume & { ... }`).
- Keep `Client` methods overload-compatible: positional form plus context-object form, with defaults merged through `mergeOptions`.
- Put broker assertions inside the `createChannel({ setup })` callback so they replay after a reconnect.
- Study the surrounding patterns before adding code, and keep the public surface small.
