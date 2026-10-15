# Error system design

- **Date:** 2026-10-15
- **Status:** approved design, spec under review
- **Branch:** `feat/error-system`, based on `master` @ df2ada3
- **Release:** `feat!`. If it merges before release PR #457, it ships with the pending 5.0.0.

## Goal

Every error thrown or rejected from `Client.publish()` and `Client.consume()` should be an instance of one library error tree. Callers can then handle errors with `instanceof` (the category) or by `code` (the specific failure). The broker error underneath stays available as `cause`.

The design follows the layout of [typeorm-extension `src/errors`](https://github.com/tada5hi/typeorm-extension/tree/master/src/errors): one base class, subclasses with static factories, and a barrel. Unlike typeorm-extension, the base is built on [`@ebec/core`](https://github.com/tada5hi/ebec) `BaseError`.

## Decisions

| # | Decision | Chosen | Rejected |
|---|----------|--------|----------|
| 1 | Shape | Subclass tree like typeorm-extension | One class plus codes; plain `Error` with no ebec |
| 2 | Dependency | `@ebec/core` `^1.3.2` (ESM-first, zero deps, ~7 KB gz) | legacy `ebec` 2.x (last release 2023) |
| 3 | Wrap scope | Everything that leaves `publish`/`consume` | Only our own throws; our own throws plus broker errors |
| 4 | `onError` hook for swallowed handler errors | **Out of scope**, follow-up PR | |
| 5 | Base branch | `master` (deepen-client refactor merged in #464) | |

## Current state (master @ df2ada3)

| Site | Today |
|------|-------|
| `src/queue/utils.ts:26` `planTopology` | `Error('The queue name can not be empty if the default exchange is selected.')` |
| `src/queue/utils.ts:38` `planTopology` | `SyntaxError('A non default exchange requires a name.')` |
| `src/queue/utils.ts:51` `planTopology` | `SyntaxError('The publish operation requires a destination.')` |
| `src/module.ts:104` `assertOpen` | `Error('The client is closed.')` |
| `src/module.ts:52-57` `failure()` | Rejects with the raw amqplib error (numeric `code`) or `Error('Channel closed')` |
| `src/module.ts:176-181` `publish` serialization | Raw `TypeError` (circular data, BigInt). `JSON.stringify(undefined)` causes `Buffer.from(undefined)` to throw |
| `ChannelWrapper.publish` (amqp-connection-manager) | `Error('timeout')` (options.timeout), `Error('Channel closed')` (close with pending messages), a broker nack error |

## Design

### Files

```
src/errors/
├── base.ts           AmqpExtensionError
├── broker.ts         BrokerError
├── client.ts         ClientError
├── constants.ts      ErrorCode enum
├── serialization.ts  SerializationError
├── topology.ts       TopologyError
├── utils.ts          toError() (internal, not re-exported)
└── index.ts          barrel: base, broker, client, constants, serialization, topology
```

`src/index.ts` gains `export * from './errors';`. `utils.ts` is left out of the barrel, the same way `src/queue/utils.ts` is.

Every new file starts with the copyright header (2026). Imports have no file extensions, and types are imported with `import type`.

### Codes (`constants.ts`)

```ts
export enum ErrorCode {
    QUEUE_NAME_EMPTY = 'QUEUE_NAME_EMPTY',
    EXCHANGE_NAME_MISSING = 'EXCHANGE_NAME_MISSING',
    DESTINATION_MISSING = 'DESTINATION_MISSING',
    CLIENT_CLOSED = 'CLIENT_CLOSED',
    CHANNEL_CLOSED = 'CHANNEL_CLOSED',
    PUBLISH_TIMEOUT = 'PUBLISH_TIMEOUT',
    BROKER_REJECTED = 'BROKER_REJECTED',
    SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
}
```

Without an explicit code, `BaseError` derives one from the class name, so the fallback `AmqpExtensionError` gets `AMQP_EXTENSION_ERROR`. That code is deliberately left out of the enum.

### Classes

All of these extend `AmqpExtensionError`, which extends `BaseError` from `@ebec/core`.

| Class | Factory | `code` | Message |
|-------|---------|--------|---------|
| `TopologyError` | `queueNameEmpty()` | `QUEUE_NAME_EMPTY` | `The queue name can not be empty if the default exchange is selected.` |
| | `exchangeNameMissing()` | `EXCHANGE_NAME_MISSING` | `A non default exchange requires a name.` |
| | `destinationMissing()` | `DESTINATION_MISSING` | `The publish operation requires a destination.` |
| `ClientError` | `closed()` | `CLIENT_CLOSED` | `The client is closed.` |
| | `channelClosed(cause?)` | `CHANNEL_CLOSED` | `Channel closed` |
| | `timeout(cause?)` | `PUBLISH_TIMEOUT` | `The publish operation timed out.` |
| `BrokerError` | `fromAmqp(err)` | `BROKER_REJECTED` | `err.message`, copied unchanged (e.g. `Operation failed: QueueDeclare; 406 (PRECONDITION-FAILED) …`) |
| `SerializationError` | `payload(cause?)` | `SERIALIZATION_FAILED` | `The message payload could not be serialized.` |

- Messages that exist today are kept word for word, so callers that match on message text keep working. Only the error class changes.
- The `timeout` and serialization messages are new. Today those errors surface as raw `timeout` and raw `TypeError` messages.
- `BrokerError` has readonly `replyCode: number`, `classId?: number` and `methodId?: number`, taken from the amqplib error. The amqplib error is also kept as `cause`.
- Each class's constructor takes ebec's `ErrorInput` (`string | ErrorOptions`), so callers can still use `new TopologyError('…')` directly. The factories are what the library itself uses.
- The base class adds nothing to `BaseError` beyond its name. It exists so callers have one root class to check with `instanceof`.

### Normalization (`utils.ts`, internal)

```ts
export function toError(e: unknown): AmqpExtensionError
```

The rules are applied in this order:

1. `e instanceof AmqpExtensionError`: return it unchanged.
2. An `Error` with a numeric `code` (an AMQP reply code): `BrokerError.fromAmqp(e)`.
3. An `Error` with message `'timeout'`: `ClientError.timeout(e)`.
4. An `Error` with message `'Channel closed'`: `ClientError.channelClosed(e)`.
5. Anything else: `new AmqpExtensionError({ message: e instanceof Error ? e.message : String(e), cause: e })`.

Rules 3 and 4 match amqp-connection-manager's error messages, which carry no class or code. Mark them with a `ponytail:` comment: if the dependency rewords a message, that error falls through to rule 5. The tests pin this behaviour.

### Call sites

- `planTopology` uses the three `TopologyError` factories.
- `assertOpen` uses `ClientError.closed()`.
- `failure()` uses `ClientError.channelClosed()` on `'close'`. A wrapper `'error'` still rejects with the raw error, and `toError` wraps it.
- In `publish`, serialization is wrapped in try/catch. A `JSON.stringify` result of `undefined` (for an `undefined` payload, a function or a symbol) throws `SerializationError.payload()`. A thrown `TypeError` becomes `SerializationError.payload(e)`.
- The bodies of `consume` and `publish` are wrapped in `try { … } catch (e) { throw toError(e); }`. Their existing `catch`/`finally` cleanup stays as it is. In `consume` the channel is still closed before the rethrow.

`handleMessage` still swallows handler and ack errors, and `failure()` keeps its listener that swallows errors after a reconnect. Both are left for the `onError` follow-up.

### Public API change (breaking)

- `SyntaxError` and `Error` from validation and closed-client checks become `TopologyError` and `ClientError`. `instanceof SyntaxError` no longer matches.
- Raw amqplib, `TypeError`, `timeout` and `Channel closed` rejections become `BrokerError`, `SerializationError` and `ClientError`. The original error is available as `cause`.
- New exports:
  - `AmqpExtensionError`
  - `TopologyError`
  - `ClientError`
  - `BrokerError`
  - `SerializationError`
  - `ErrorCode`
- New runtime dependency: `@ebec/core`.

Commit type: `feat!: add error classes based on @ebec/core`, with a `BREAKING CHANGE:` footer that describes the class changes.

## Out of scope

- An `onError` consume hook, and surfacing handler, ack and post-reconnect setup errors.
- Wrapping errors from `connect()` or from the constructor.
- `markInstanceof` cross-copy markers or `is*` guards. `instanceof` covers the single-copy case, and ebec's `isBaseError`/`isErrorWithCode` cover the rest.
- `@ebec/http`, `defineErrorCatalog`, and the ebec issue model.

## Testing

- **Broker-free (`test/unit/utils.spec.ts`)**
  - `planTopology` validation asserts the class (`TopologyError`) and the `code`.
  - `toError` gets one table test per rule. Also check that an `AmqpExtensionError` passes through unchanged (same object), and that the non-`Error` input `'x'` becomes the base class.
  - Factories: `code`, `message`, `cause`, `instanceof AmqpExtensionError` and `instanceof BaseError`, and that `toJSON()` contains `code`.
  - `BrokerError.fromAmqp`: fake errors `{ code: 406, classId: 50, methodId: 10 }` lift the reply fields onto the instance.
- **Broker (`test/unit/module.spec.ts`)**
  - 406 mismatch and 403 exclusive: `rejects.toMatchObject({ code: 'BROKER_REJECTED', replyCode: 406 })` (and 403). Keep the `/PRECONDITION_FAILED/` and `/ACCESS_REFUSED/` message assertions.
  - Invalid input: `TopologyError` instead of `SyntaxError`.
  - Pending publish on close: `ClientError` with code `CHANNEL_CLOSED`.
  - Publish timeout: `ClientError` with code `PUBLISH_TIMEOUT`.
  - Calls after close: `ClientError` with code `CLIENT_CLOSED`.
  - Serialization: a circular object and `undefined` both reject with `SerializationError`, before any channel is opened.
- The coverage thresholds (80%) must still pass.

## Docs

- `README.MD`: add an "Errors" section under Usage. It covers the class tree, a `try/catch` example that switches on `err.code`, the `BrokerError.replyCode` and `cause` fields, and the migration note `SyntaxError` → `TopologyError`.
- `.agents/structure.md`: the `src/errors/` row, plus the dependency table row for `@ebec/core`.
- `.agents/architecture.md`: update the "Error Handling" section and §4 (`failure()` + `toError`).
