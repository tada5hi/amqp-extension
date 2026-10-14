# Architecture

## Overview

A thin facade over `amqp-connection-manager`. One `Client` holds the following:

- `connection`: either injected (`ctx.connection`) or created via `connect(ctx.connectionOptions, { reconnectTimeInSeconds: 60 })`. A self-created connection registers a `SIGINT` handler that closes it.
- `publishOptions` / `consumeOptions`: client-level defaults.
- `exchange`: defaults to `{ type: 'direct', name: '' }`, which is the AMQP **default exchange**.

`client.of(exchange)` returns a new `Client` that shares the connection and default options but is bound to another exchange. Use it to work with several exchanges over one connection.

## Core Design Decisions

### 1. `direct` type means the default exchange

`isDefaultExchange(type)` is true for `undefined` or `'direct'`. In that mode, `to`/`from` is a **queue name**: the queue is asserted with `buildAssertQueueOptions(options.queueOptions)` (always `durable: true`; `singleActiveConsumer` adds the `x-single-active-consumer` argument) and messages are published to exchange `''` with the queue name as routing key. An empty queue name throws. `queueOptions` is accepted on both `PublishOptions` and `ConsumeOptions`, and publisher and consumer must pass the same values, because the broker rejects re-declaring a queue with different arguments. Named exchanges ignore it.

### 2. Named exchanges use an exclusive, temporary queue per consumer

For every non-default type (`topic`, `fanout`, `match`), `consume(from, ...)` does the following:
1. Asserts the exchange (`exchange.name`, `exchange.type`, `exchange.options`).
2. Asserts an anonymous queue `{ durable: false, autoDelete: true, exclusive: true }`.
3. Binds it with `from` as the routing key / binding pattern.

`publish` on a named exchange requires `exchange.name` (otherwise it throws a `SyntaxError`) and asserts the exchange before publishing.

### 3. Setup happens inside `createChannel({ setup })`

All assertions run in the channel `setup` callback, so they replay automatically after a reconnect. `consume` resolves on `channel.waitForConnect()`. `publish` creates a short-lived channel, publishes, then closes it.

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

The implementation tells the forms apart with `typeof arg === 'string'`. It tells `options` and `handlers` apart with `isConsumeHandlers()`, which is true when every value is a function. `*Context` types (`ConsumeContext`, `PublishContext`, `ClientContext`) are the object-form inputs. `*Options` types extend `amqplib` `Options.*`.

### Option merging

Call-site options are merged on top of client defaults:

```typescript
options = mergeOptions(callOptions, this.consumeOptions); // left (call-site) wins
```

`mergeOptions` clones without mutating its inputs and dedupes arrays. It does not deep-merge an `exchange` key: when both sides hold an `Exchange`, the left one wins.

### Handler dispatch

`ConsumeHandlers` maps `message.properties.type` to a handler. The `'$any'` key (`ConsumeHandlerAnyKey`) is the fallback.

## Data Flow

```
publish(to, data, options?)
  1. Merge options with client publishOptions
  2. Serialize: Buffer as-is · string → utf-8 · anything else → JSON.stringify
  3. Channel setup: assert queue (default exchange) or assert exchange (named)
  4. channel.publish(exchange.name || '', to, buffer, options) → boolean; close channel

consume(from, options?, handlers)
  1. Merge options with client consumeOptions
  2. Channel setup: assert queue (default exchange) or exchange + exclusive queue + bind
  3. Apply prefetchCount if it is a number
  4. channel.consume(queue, handleMessage, options)
  5. handleMessage: pick handler by properties.type or $any → await → ack; on throw/no handler → nack
```

## Error Handling

- Ack/nack happens only when `options.noAck` is falsy.
- When no handler matches, or a handler throws, the message is `nack`ed with `requeue = options.requeueOnFailure ?? false`. Handler errors are swallowed and not rethrown or logged.
- Configuration errors (empty queue name on the default exchange, missing exchange name, missing publish destination) throw `Error` / `SyntaxError`.

## Configuration

`ClientContext` (constructor input):

| Field               | Purpose                                                       |
|---------------------|---------------------------------------------------------------|
| `connection`        | Existing `amqp-connection-manager` connection (shared)          |
| `connectionOptions` | `amqplib` `Options.Connect` or URL string, used when no `connection` is given |
| `exchange`          | `{ type, name?, options? }`. Defaults to the default exchange   |
| `publishOptions`    | Defaults merged into every `publish`                           |
| `consumeOptions`    | Defaults merged into every `consume`. Extra fields: `requeueOnFailure`, `prefetchCount`, `queueOptions` |
