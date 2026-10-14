# Testing

## Setup

- **Runner**: Vitest 5 (v8 coverage)
- **Test location**: `test/unit/**/*.{test,spec}.{js,ts}`. Files outside this glob are **not** picked up
- **Config**: `test/vitest.config.ts`. The npm scripts pass `--config` explicitly
- **Prerequisite**: a running Docker daemon. `test/utils/global-setup.ts` starts `rabbitmq:3-management` through `testcontainers`

## Running Tests

```bash
npm run test                                                              # all tests once
npm run test:coverage                                                     # with coverage
npx vitest --config test/vitest.config.ts --run test/unit/utils.spec.ts   # single file (broker-free, but globalSetup still starts the container)
```

## Test Layers

### Broker-free tests (`test/unit/utils.spec.ts`)

The pure decisions are tested directly, without a broker:
- `planTopology`: a table of exchange kind × publish/consume × options → `Topology`, plus every validation error.
- `handleMessage`: handler/`$any` dispatch and the ack/nack/requeue/`noAck` table, using a two-method `{ ack, nack }` fake that records calls (no `vi.fn`). Also: no rejection when `ack` throws on a closed channel.

Add new decision logic here, as pure functions, rather than as more broker tests.

### Broker tests (`test/unit/module.spec.ts`)

No mocks or fakes. Tests run the real `Client` against a live broker. They cover delivery end to end, the `{}`-options regression, rejection on a broker-rejected declaration (406, and the connection must survive it), eager validation errors and `close()`:

- `globalSetup` (`test/utils/global-setup.ts`) starts the container with user `root` / password `start123` and exposed port 5672. It hands the AMQP URL to the tests with `project.provide('MQ_CONNECTION_STRING', ...)` and returns a teardown function that stops the container. The `ProvidedContext` augmentation for this key also lives in that file.
- Specs read the URL with `inject('MQ_CONNECTION_STRING')` from `vitest`, create a `Client` in `beforeAll`, and close `client.connection` in `afterAll`.
- Timeouts are raised in the config: `testTimeout` 30s, `hookTimeout` 120s (container start).

## Code Coverage

Thresholds in `test/vitest.config.ts` are 80% for branches, functions, lines and statements, measured over `src/**`. The suite meets them (~96% lines, ~93% branches). CI runs `npm run test` only.

## CI Pipeline

GitHub Actions (`.github/workflows/main.yml`, Node 24): install → build → lint and test in parallel. The composite actions in `.github/actions/` handle install/build caching. GitHub-hosted Ubuntu runners provide Docker for testcontainers.

## Writing New Tests

1. Put specs in `test/unit/` as `*.spec.ts`. Import from `vitest` explicitly (no globals) and from `../../src`.
2. Use a fresh queue or routing key name per test, because the broker is shared across the whole run.
3. Await `consume()` before publishing so the binding exists. **Await `publish()`** too: a publish still in flight when `afterAll` closes the connection rejects with `Channel closed` as an unhandled error.
4. Wait for delivery with `Promise.withResolvers()` resolved inside the handler, not with fixed sleeps.
5. To test against a named exchange, use `client.of({ type, name })`.
6. Run `npm run test` to verify.
