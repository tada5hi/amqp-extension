# Testing

## Setup

- **Runner**: Jest 29 + `ts-jest`
- **Test location**: `test/unit/**/*.spec.ts` (regex `(/unit/.*|(\.|/)(test|spec))\.(ts|js)x?$`)
- **Config**: `test/jest.config.js` (`rootDir: '../'`)
- **Prerequisite**: a running Docker daemon. `test/setup.js` starts `rabbitmq:3-management` through `testcontainers`

## Running Tests

```bash
npm run test                                   # all tests (NODE_ENV=test, --detectOpenHandles)
npx cross-env NODE_ENV=test jest --config ./test/jest.config.js test/unit/module.spec.ts   # single file
npm run test:coverage                          # coverage → writable/coverage
```

## Test Layers

### Integration-style unit tests

No mocks or fakes. Tests run the real `Client` against a live broker:

- `globalSetup` (`test/setup.js`) starts the container with user `root` / password `start123` and exposed port 5672. It writes `MQ_CONNECTION_STRING` with `envix.write()` and stores the container on `globalThis.MQ_CONTAINER`.
- `globalTeardown` (`test/teardown.js`) stops the container.
- Specs read the connection string with `read('MQ_CONNECTION_STRING', '')` from `envix` and create a `Client` in `beforeAll`. They close `client.connection` in `afterAll`.

## Test Environment Variables

| Variable               | Purpose                                                         |
|------------------------|-----------------------------------------------------------------|
| `MQ_CONNECTION_STRING` | AMQP URL of the test container. Set by global setup, not by hand |
| `NODE_ENV`             | Set to `test` by the npm scripts                                  |

## Code Coverage

Thresholds in `test/jest.config.js` are 80% global for branches, functions, lines and statements, collected from `src/**/*.ts`.

## CI Pipeline

GitHub Actions (`.github/workflows/main.yml`, Node 22) runs `npm ci` → `npm run build` → `npm run test` → `npx semantic-release`. Lint does **not** run in CI, so run `npm run lint` locally.

## Writing New Tests

1. Put specs in `test/unit/` as `*.spec.ts`. Import from `../../src`.
2. Use a fresh queue or routing key name per test, because the broker is shared across the whole run.
3. Wait for the actual delivery (resolve or `done()` inside the handler) instead of fixed sleeps. Start `consume` before `publish` so the binding exists.
4. To test against a named exchange, use `client.of({ type, name })`.
5. Run `npm run test` to verify.
