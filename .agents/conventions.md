# Conventions

## Tooling

| Tool                 | Purpose                                                                   |
|----------------------|---------------------------------------------------------------------------|
| tsdown               | Bundles `src/index.ts` → `dist/` (ESM + `.d.mts` + sourcemaps)            |
| TypeScript 6         | Type checking only (`noEmit: true`); base config from `@tada5hi/tsconfig` |
| ESLint 10 (flat)     | `eslint.config.js` spreads `await config()` from `@tada5hi/eslint-config`  |
| Vitest               | Tests and v8 coverage (see testing.md)                                     |
| husky + commitlint   | `.husky/commit-msg` runs `@tada5hi/commitlint-config`                     |
| release-please       | Version bump, changelog and release PR on `master`                        |
| Dependabot           | Daily npm + actions updates targeting `master`                            |

The `@tada5hi/*` packages are the source of truth for style, TS and commit rules. Change the shared package rather than adding local overrides, unless a deviation is genuinely project-specific.

TypeScript is pinned to 6.x because `typescript-eslint` does not support TS 7 yet (peer range `<6.1.0`).

## Workflow

- After making changes, **always** run `npm run build`, `npm run lint` and `npx tsc --noEmit`. Run `npm run test` when Docker is available.
- `npm run lint:fix` fixes most style issues. Check its output for trailing whitespace in reflowed lists.
- When public API or behavior changes, update `README.MD` (Usage section).
- Never hand-edit `CHANGELOG.md`, `.release-please-manifest.json` or the `version` in `package.json`. release-please owns them.

## Code Style

- **Module format**: ESM only (`"type": "module"`). No `require`, no `__dirname`.
- **Imports**: written without file extensions (`moduleResolution: bundler`). `verbatimModuleSyntax` is on, so use `import type` / `export type` for types.
- **Strictness**: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters` from `@tada5hi/tsconfig`.
- **Indentation**: 4 spaces, LF, UTF-8, final newline (`.editorconfig`).
- **Lint style**: `@stylistic` rules break multi-member import/export lists onto one member per line and collapse short objects onto a single line.
- Most files start with the copyright header block (`Copyright (c) <year>. Author Peter Placzek (tada5hi) ...`). Add it to new files.

## Naming Conventions

| Suffix / form   | When to use                                    | Examples                                        |
|-----------------|------------------------------------------------|-------------------------------------------------|
| `*Options`      | Options passed to broker calls, mostly `amqplib` `Options.*` aliases/extensions | `PublishOptions`, `ConsumeOptions`, `ExchangeOptions` |
| `*Context`      | Object-form input for a method or constructor  | `ClientContext`, `ConsumeContext`, `PublishContext` |
| `is*`           | Type guards                                    | `isDefaultExchange` |
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
build(deps-dev): bump vitest to v5
```

- `fix:` → patch, `feat:` → minor, `!` / `BREAKING CHANGE:` → major.
- Dependabot uses the `fix` prefix for prod deps and `build` for dev deps, with scope. Match that when bumping by hand.

## Build Output

| File                 | Contents          |
|----------------------|-------------------|
| `dist/index.mjs`     | ESM bundle        |
| `dist/index.d.mts`   | Type declarations |
| `dist/index.mjs.map` | Sourcemap         |

`package.json` `files` publishes only `dist/`. `exports` exposes `.` (types + import) and `./package.json`.

## Release Process

`.github/workflows/release.yml` runs on every push to `master`:

1. release-please (`googleapis/release-please-action@v5`) opens or updates a release PR that bumps the version, updates `CHANGELOG.md` and syncs `.release-please-manifest.json`.
2. Merging that PR creates a `v`-prefixed tag and a GitHub release.
3. On that run, checkout → install → build → publish via `tada5hi/monoship@v2` (needs the `NPM_TOKEN` secret).

Config: `release-please-config.json` (`release-type: node`, `include-v-in-tag: true`, `bump-minor-pre-major: true`).

## CI/CD

- `.github/workflows/main.yml`: push/PR to `develop`, `master`, `next`, `beta`, `alpha`. Runs install → build → lint + test. Node 24, and superseded runs are cancelled.
- `.github/workflows/release.yml`: release-please + npm publish on `master`.
- Both reuse `.github/actions/install` and `.github/actions/build`. Change caching or Node setup there.

## Best Practices

- Reuse `amqplib` option types (amqplib bundles its own `.d.ts`; there is no `@types/amqplib`) instead of redefining them. Extend them with intersections (`Options.Consume & { ... }`).
- Keep `Client` methods overload-compatible: positional form plus context-object form, with defaults merged through `mergeOptions`.
- Put broker assertions inside the `createChannel({ setup })` callback (via `assertTopology`) so they replay after a reconnect. Validate with `planTopology` **before** opening a channel.
- Keep decisions pure and broker-free where possible (`planTopology`, `handleMessage`), and test them in `test/unit/utils.spec.ts`. Never tell overload arguments apart by an object's shape; use the argument count.
- Study the surrounding patterns before adding code, and keep the public surface small.
