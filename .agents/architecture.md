# Architecture

## Overview

A thin facade over `amqp-connection-manager`. One `Client` holds the following:

- `connection`: either injected (`ctx.connection`) or created via `connect(ctx.connectionOptions, { reconnectTimeInSeconds: 60 })`. `client.close()` closes it, together with every channel and every `of()` sibling sharing it. There is no automatic close on `SIGINT`: the app owns the process.
- `publishOptions` / `consumeOptions`: client-level defaults.
- `exchange`: defaults to `{ type: 'direct', name: '' }`, which is the AMQP **default exchange**.

`client.of(exchange)` returns a new `Client` that shares the connection and default options but is bound to another exchange. Use it to work with several exchanges over one connection.

## Core Design Decisions

### 1. `direct` type means the default exchange

`isDefaultExchange(type)` is true for `undefined` or `'direct'`. In that mode, `to`/`from` is a **queue name**: the queue is asserted durably (always `durable: true`; `singleActiveConsumer` adds the `x-single-active-consumer` argument) and messages are published to exchange `''` with the queue name as routing key. An empty queue name throws. Queue options (`QueueOptions`, currently `singleActiveConsumer`) are intersected flat into both `PublishOptions` and `ConsumeOptions`, and publisher and consumer must pass the same values, because the broker rejects re-declaring a queue with different arguments. Named exchanges ignore it.

### 2. Named exchanges use an exclusive, temporary queue per consumer

For every non-default type (`topic`, `fanout`, `match`), `consume(from, ...)` does the following:
1. Asserts the exchange (`exchange.name`, `exchange.type`, `exchange.options`).
2. Asserts an anonymous queue `{ durable: false, autoDelete: true, exclusive: true }`.
3. Binds it with `from` as the routing key / binding pattern.

`publish` on a named exchange asserts only the exchange. A named exchange type without `exchange.name` is rejected (`SyntaxError`) for both publish and consume.

### 3. Topology is planned as data, declared inside `createChannel({ setup })`

`planTopology(exchange, key, options, consume?)` (`src/queue/utils.ts`) is pure. It returns a `Topology` (`{ exchange?, queue?, bind? }`) and throws on invalid input (an empty queue name on the default exchange, a nameless named exchange, an empty publish key on a named exchange) **before any channel is opened**. `assertTopology(channel, topology)` declares it and is only ever called from a channel `setup` callback, so it replays automatically after a reconnect.

`assertTopology` attaches a no-op `'error'` listener to the raw amqplib channel **only while declaring**. amqp-connection-manager doesn't, and without it amqplib rethrows a channel-level error (e.g. a 406 on a mismatched queue declaration) and tears down the **whole connection**, which then reconnects only after 60 s. After setup the listener is removed on purpose: amqp-connection-manager never recovers a channel-only close, so a runtime channel error (e.g. a handler acking a message itself, or the broker's `consumer_timeout`) must still recycle the connection, which re-runs the setup and re-registers the consumer.

### 4. Setup failures reject the call

`publish` and `consume` wait with `ready(wrapper)`, which resolves on `waitForConnect()` and rejects on the wrapper's `'error'` event (a setup function failed) or `'close'` event (e.g. `client.close()` before the channel was set up, which otherwise never settles). A failed `consume` closes its channel. The listener stays attached, so setup errors after a later reconnect are swallowed instead of crashing the process (`ponytail:` ceiling: no `onError` hook yet).

### 5. One channel per publish

`publish` opens a channel, waits for `ready`, publishes and closes the channel in `finally`. That is self-healing and needs no shared state. A long-lived publish channel is deliberately avoided: under amqp-connection-manager 5 one rejected declaration would disable it until the connection reconnects. `ponytail:` ceiling: throughput.

## Design Patterns

### Overloaded methods with a context-object form

Each public operation accepts positional arguments or a single context object. Follow this pattern for new operations:

```typescript
async consume(ctx: ConsumeContext): Promise<void>;
async consume(from: string, handlers: ConsumeHandlers): Promise<void>;
async consume(from: string, options: ConsumeOptions, handlers: ConsumeHandlers): Promise<void>;

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

`mergeOptions` (smob) deep-merges, clones without mutating its inputs and dedupes arrays. It only runs when call options are passed: its clone turns a `Buffer` (e.g. in `headers`) into a plain `Uint8Array`, which amqplib no longer encodes as bytes.

### Handler dispatch and settlement

`handleMessage(message, channel, handlers, options)` (`src/consume/utils.ts`, internal) owns the whole policy: `ConsumeHandlers` maps `message.properties.type` to a handler, `'$any'` (`ConsumeHandlerAnyKey`) is the fallback, and the delivery is acked or nacked. It needs only `{ ack, nack }` from the channel, so it is tested broker-free. It never rejects: amqplib discards the consumer callback's promise, so a rejection would be unhandled.

## Data Flow

```
publish(to, data, options?)
  1. Merge options with client publishOptions
  2. Serialize: Buffer as-is · string → utf-8 · anything else → JSON.stringify
  3. planTopology (validation, throws before any channel exists)
  4. createChannel({ setup: assertTopology }) → ready() (rejects on setup failure)
  5. channel.publish(exchange.name || '', to, buffer, options) → boolean; close channel (finally)

consume(from, options?, handlers)
  1. Merge options with client consumeOptions
  2. planTopology(…, consume = true) (validation, throws before any channel exists)
  3. Channel setup: assertTopology → prefetch(prefetchCount) → channel.consume(queue, handleMessage, options)
  4. ready() resolves, or rejects (and closes the channel) on setup failure
  5. handleMessage: pick handler by properties.type or $any → await → ack; on throw/no handler → nack
```

## Error Handling

- Ack/nack happens only when `options.noAck` is falsy.
- When no handler matches, or a handler throws, the message is `nack`ed with `requeue = options.requeueOnFailure ?? false`. Handler errors are swallowed and not rethrown or logged.
- An `ack`/`nack` that throws because the channel closed while the handler ran (reconnect) is swallowed. The broker redelivers the message.
- Configuration errors (empty queue name on the default exchange, missing exchange name, missing publish destination) reject `publish`/`consume` with `Error` / `SyntaxError` before any channel is opened.
- Broker rejections of a declaration (e.g. 406 `PRECONDITION_FAILED`) reject `publish`/`consume`. Only that channel closes, and the connection stays up.

## Configuration

`ClientContext` (constructor input):

| Field               | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `connection`        | Existing `amqp-connection-manager` connection (shared)          |
| `connectionOptions` | `amqplib` `Options.Connect` or URL string, used when no `connection` is given |
| `exchange`          | `{ type, name?, options? }`. Defaults to the default exchange   |
| `publishOptions`    | Defaults merged into every `publish`                           |
| `consumeOptions`    | Defaults merged into every `consume`. Extra fields: `requeueOnFailure`, `prefetchCount`, `singleActiveConsumer` |
