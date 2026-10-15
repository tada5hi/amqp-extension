# Architecture

## Overview

A thin facade over `amqp-connection-manager`. One `Client` holds the following:

- `connection`: either injected (`ctx.connection`) or created via `connect(ctx.connectionOptions, ctx.connectionManagerOptions)` (amqp-connection-manager's default reconnect delay: 5 s). `client.close()` closes it, together with every channel and every `of()` sibling sharing it. `Client` implements `Symbol.asyncDispose` (delegating to `close()`), so `await using client = new Client(...)` closes it at scope exit. There is no automatic close on `SIGINT`: the app owns the process.
- `publishOptions` / `consumeOptions`: client-level defaults.
- `exchange`: defaults to `{ type: 'direct', name: '' }`, which is the AMQP **default exchange**.

`client.of(exchange)` returns a new `Client` that shares the connection and default options but is bound to another exchange. Use it to work with several exchanges over one connection.

## Core Design Decisions

### 1. `direct` type means the default exchange

`isDefaultExchange(type)` is true for `undefined` or `'direct'`. In that mode, `to`/`from` is a **queue name**: the queue is asserted durably (always `durable: true`) and messages are published to exchange `''` with the queue name as routing key. An empty queue name throws. Queue options (`QueueOptions`: `queueType`, `deliveryLimit`, `deadLetterExchange`, `deadLetterRoutingKey`, `messageTtl`, `maxLength`, `singleActiveConsumer`) are intersected flat into both `PublishOptions` and `ConsumeOptions`. `planTopology` maps them to `x-*` queue arguments through one key→argument map (`QueueArguments` in `src/queue/utils.ts`); `undefined` and `false` add no argument, and no options means no `arguments` key at all. Nothing is validated client-side: the broker answers a bad combination with a 406 (`BrokerError`). Publisher and consumer must pass the same values, because the broker rejects re-declaring a queue with different arguments. Named exchanges ignore them, except for the named `queue` of a consume (see section 2).

### 2. Named exchanges use an exclusive, temporary queue per consumer, or a durable named one

For every non-default type (`topic`, `fanout`, `headers`), `consume(from, ...)` does the following:
1. Asserts the exchange (`exchange.name`, `exchange.type`, `exchange.options`).
2. Asserts an anonymous queue `{ durable: false, autoDelete: true, exclusive: true }`, or, with the consume-only option `queue`, the queue of that name `{ durable: true, arguments }` with the `QueueOptions` arguments (the anonymous queue never gets them).
3. Binds it with `from` as the routing key / binding pattern. Bindings are never removed, so another `from` on the same `queue` adds one.

Once a consume has declared it, a named `queue` keeps messages while no consumer runs, and its consumers split the messages (`publish` declares only the exchange, so earlier messages are unroutable). An empty `queue` throws `TopologyError` (`QUEUE_NAME_EMPTY`). On the default exchange `queue` is ignored (`from` is the queue name).

`publish` on a named exchange asserts only the exchange. A named exchange type without `exchange.name` is rejected (`TopologyError`) for both publish and consume.

### 3. Topology is planned as data, declared inside `createChannel({ setup })`

`planTopology(exchange, key, options, consume?)` (`src/queue/utils.ts`) is pure. It returns a `Topology` (`{ exchange?, queue?, bind? }`) and throws on invalid input (an empty queue name on the default exchange, a nameless named exchange, an empty publish key on a named exchange) **before any channel is opened**. `assertTopology(channel, topology)` declares it and is only ever called from a channel `setup` callback, so it replays automatically after a reconnect.

Every setup function is wrapped in `guard()` (`src/module.ts`), which attaches a no-op `'error'` listener to the raw amqplib channel **only while the setup runs** (declarations, `prefetch`, `basic.consume`). amqp-connection-manager doesn't, and without it amqplib rethrows a channel-level error (e.g. a 406 on a mismatched declaration, a 403 on an exclusive consumer) and tears down the **whole connection**, which then reconnects only after the reconnect delay. After setup the listener is removed on purpose: amqp-connection-manager never recovers a channel-only close, so a runtime channel error (e.g. a handler acking a message itself, or the broker's `consumer_timeout`) must still recycle the connection, which re-runs the setup and re-registers the consumer.

### 4. Broker rejections reject the call, transient errors don't

`consume` races `waitForConnect()` against `failure(wrapper)`. `failure()` rejects on a wrapper `'error'` **that carries an AMQP reply code** (a broker rejection: 403/404/405/406…) or on the wrapper's `'close'` (`ClientError.channelClosed()`; e.g. `client.close()` before setup, which otherwise never settles). Errors without a reply code (the connection dropped mid-setup: `Channel ended…`, `Connection closing`) are transient: amqp-connection-manager re-runs the setup on reconnect, so the call keeps waiting. A failed `consume` closes its channel without awaiting the close: amqplib never settles a channel close when the connection drops before the broker's close-ok, which would hang the call. The listener stays attached, so setup errors after a later reconnect are swallowed instead of crashing the process (`ponytail:` ceiling: no hook for setup errors; `onError` covers handler failures only).

`consume` then resolves a `Consumer` (`src/consume/types.ts`). Its setup records the raw channel and consumer tag of every run, tracks the in-flight `handleMessage` promises and returns early once cancelled. `cancel()` is memoized and never rejects: it sets `cancelled` (no setup run after it, so a reconnect does not re-register the consumer), awaits a setup run still in progress (a reconnect that already passed the check registers a consumer), sends `basic.cancel` to the latest run's channel (errors swallowed, e.g. on a closed channel), awaits the in-flight handlers until none is left (so their messages are settled on the still-open channel) and closes the wrapper. `Symbol.asyncDispose` is `cancel`. `ponytail:` ceilings: a handler that never settles hangs `cancel()`, and so does a connection that drops between ChannelClose and CloseOk (amqplib).

`client.close()` marks the shared connection as closed (a module-level `WeakSet`), so later `publish()`/`consume()` calls on it or any `of()` sibling reject with `ClientError.closed()` (`The client is closed.`) instead of hanging on a closed connection manager.

### 5. One channel per publish

`publish` opens a channel and queues the message right away (`ChannelWrapper.publish`): it is sent only after the setup ran, the per-message `timeout` option bounds it during an outage, and `close()` rejects it. The publish is raced against `failure()`, and the channel is closed in `finally` (not awaited, as in `consume`). That is self-healing and needs no shared state. A long-lived publish channel is deliberately avoided: under amqp-connection-manager 5 one rejected declaration would disable it until the connection reconnects. `ponytail:` ceiling: throughput (and the per-connection channel limit, ~2047 concurrent publishes). A shared publish channel was prototyped for #470 and dropped: one bad publish (e.g. an invalid `expiration`) closed it for every concurrent publish, declaring once per connection lost messages to a queue deleted behind the client, and its retry made delivery at-least-once.

## Design Patterns

### Overloaded methods with a context-object form

Each public operation accepts positional arguments or a single context object. Follow this pattern for new operations:

```typescript
async consume(ctx: ConsumeContext): Promise<Consumer>;
async consume(from: string, handlers: ConsumeHandlers): Promise<Consumer>;
async consume(from: string, options: ConsumeOptions, handlers: ConsumeHandlers): Promise<Consumer>;

async publish(ctx: PublishContext): Promise<boolean>;
async publish(to: string, data: any): Promise<boolean>;
async publish(to: string, data: any, options: PublishOptions): Promise<boolean>;
```

The implementation tells the forms apart with `typeof arg === 'string'`, and `options` from `handlers` **by argument count**: with three arguments the second is `options`. Never guess from an object's shape (the removed `isConsumeHandlers({})` returned `true`, so `consume('q', {}, handlers)` ignored the handlers). `*Context` types (`ConsumeContext`, `PublishContext`, `ClientContext`) are the object-form inputs. `*Options` types extend `amqplib` `Options.*`.

### Option merging

Call-site options are merged on top of client defaults:

```typescript
options = ctx.options ? mergeOptions(ctx.options, this.consumeOptions) : this.consumeOptions; // left (call-site) wins
```

`mergeOptions` (smob) deep-merges, clones without mutating its inputs and dedupes arrays. It only runs when call options are passed: its clone turns a `Buffer` (e.g. in `headers`) into a plain `Uint8Array`, which amqplib no longer encodes as bytes. It clones through `structuredClone`, which throws on functions, so `consume` takes `onError` out of both sides first and re-attaches it afterwards (call-site value, else the client default).

### Handler dispatch and settlement

`handleMessage(message, channel, handlers, options)` (`src/consume/utils.ts`, internal) owns the whole policy: `ConsumeHandlers` maps `message.properties.type` to a handler, `'$any'` (`ConsumeHandlerAnyKey`) is the fallback, the delivery is acked or nacked, and a failure is then reported to `options.onError`. It needs only `{ ack, nack }` from the channel, so it is tested broker-free. It never rejects: amqplib discards the consumer callback's promise, so a rejection would be unhandled.

With `options.retry` (`src/consume/retry.ts`), a handler throw is re-published with `x-attempt` + 1 after an exponential backoff (`retryMessage`), then the original is acked; exhausted → ack + `onError(ATTEMPTS_EXHAUSTED)`; a failed re-publish → `nack(requeue: true)`. The re-publish goes through `Client.republish` (its own confirm channel, default exchange by queue name): never the consume channel, which may have been reset while the handler ran, and never `publish()`, whose queue assertion without the queue arguments would 406. `handleMessage` receives it, plus a per-`consume()` `Map<messageId, run>` that survives setup reruns, as a `HandleMessageContext`. The redelivery guard (only with `retry`, a `messageId` and without `noAck`): a redelivered copy of a tracked run is acked (with `ordered`, after the run settles); an untracked redelivery is a failed attempt, retried without running the handler. Without `retry` nothing changes: guarding would ack a copy whose original then cannot `nack` on its dead channel.

## Data Flow

```
publish(to, data, options?)
  1. Merge options with client publishOptions
  2. Serialize: Buffer as-is · string → utf-8 · anything else → JSON.stringify
  3. planTopology (validation, throws before any channel exists)
  4. createChannel({ setup: guard(assertTopology) }); the message is queued right away (sent after setup)
  5. race(channel.publish(exchange.name || '', to, buffer, options), failure()) → boolean; close channel (finally)

consume(from, options?, handlers)
  1. Merge options with client consumeOptions
  2. planTopology(…, consume = true) (validation, throws before any channel exists; anonymous or named queue)
  3. Channel setup (guard): assertTopology → prefetch(prefetchCount) → channel.consume(queue, handleMessage, options)
  4. race(waitForConnect(), failure()) resolves a Consumer, or rejects (and closes the channel) on a broker rejection / close
  5. handleMessage: pick the own handler for properties.type or $any → await → ack; on throw/no handler → nack
```

## Error Handling

- Ack/nack happens only when `options.noAck` is falsy.
- When no handler matches, or a handler throws, the message is `nack`ed with `requeue = options.requeueOnFailure ?? false`. Then `options.onError` (if set, also with `noAck`) is called with the handler's error or `ClientError.handlerMissing(type)` (`HANDLER_MISSING`). Its own throw or rejection is swallowed. Handler errors are never rethrown.
- An `ack`/`nack` that throws because the channel closed while the handler ran (reconnect) is swallowed. The broker redelivers the message.
- Configuration errors reject with `TopologyError` (`QUEUE_NAME_EMPTY`, `EXCHANGE_NAME_MISSING`, `DESTINATION_MISSING`) before any channel is opened.
- A payload that cannot be serialized (circular, `BigInt`, or one that `JSON.stringify` turns into `undefined`) rejects `publish` with `SerializationError` (`SERIALIZATION_FAILED`) before any channel is opened.
- Broker rejections become `BrokerError` (`replyCode`, `classId`, `methodId`; amqplib error as `cause`). Only that channel closes.
- `publish`/`consume` pass every rejection through `toError()` (`src/errors/utils.ts`), so callers only ever see `AmqpExtensionError` subclasses. It maps amqp-connection-manager's `timeout` / `Channel closed` by message (`ponytail:`, they carry no class or code).
- Error identity is duck-typed through `@ebec/core`'s marker chain: every error class calls `markInstanceof(this, Symbol.for('amqp-extension/<Class>'))` and overrides `static [Symbol.hasInstance]` with `hasInstanceof` on its own marker, so `instanceof` also matches errors from a duplicate copy of the library. A new subclass **must** do both, otherwise it inherits its parent's `hasInstance` and matches every sibling. The `is*Error` guards (`src/errors/check.ts`) use `matchesInstanceof`, which also accepts the string chain `toJSON()` emits, so they match errors that crossed a JSON boundary.

## Configuration

`ClientContext` (constructor input):

| Field               | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `connection`        | Existing `amqp-connection-manager` connection (shared)          |
| `connectionOptions` | `amqplib` `Options.Connect` or URL string, used when no `connection` is given |
| `connectionManagerOptions` | amqp-connection-manager `connect()` options (e.g. `reconnectTimeInSeconds`), used when no `connection` is given |
| `exchange`          | `{ type, name?, options? }`. Defaults to the default exchange   |
| `publishOptions`    | Defaults merged into every `publish`                           |
| `consumeOptions`    | Defaults merged into every `consume`. Extra fields: `requeueOnFailure`, `prefetchCount`, `queue` and the `QueueOptions` |
