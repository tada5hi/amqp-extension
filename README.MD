<p align="center">
    <img src="./.github/assets/logo.svg" alt="amqp-extension" width="128" height="128" />
</p>

<h1 align="center">amqp-extension</h1>

<p align="center">
    <b>Publish and consume RabbitMQ messages without the amqplib boilerplate.</b><br>
    One <code>Client</code> takes care of reconnecting, declaring exchanges and queues, serializing payloads,<br>
    routing messages to handlers and acknowledging them, so you write a call per operation and nothing else.
</p>

<p align="center">
    <a href="https://npmjs.com/package/amqp-extension"><img src="https://badge.fury.io/js/amqp-extension.svg" alt="npm version" /></a>
    <a href="https://github.com/Tada5hi/amqp-extension/actions/workflows/main.yml"><img src="https://github.com/Tada5hi/amqp-extension/actions/workflows/main.yml/badge.svg" alt="CI" /></a>
    <a href="https://codecov.io/gh/Tada5hi/amqp-extension"><img src="https://codecov.io/gh/Tada5hi/amqp-extension/branch/master/graph/badge.svg?token=6YELWNP9HG" alt="codecov" /></a>
    <a href="https://snyk.io/test/github/Tada5hi/amqp-extension?targetFile=package.json"><img src="https://snyk.io/test/github/Tada5hi/amqp-extension/badge.svg?targetFile=package.json" alt="Known Vulnerabilities" /></a>
    <a href="https://conventionalcommits.org"><img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white" alt="Conventional Commits" /></a>
</p>

<p align="center">
    <a href="#installation"><b>Installation</b></a>
    ·
    <a href="#usage">Usage</a>
    ·
    <a href="#options">Options</a>
    ·
    <a href="#api">API</a>
    ·
    <a href="#notes">Notes</a>
</p>

---

## Why amqp-extension?

[amqplib](https://www.npmjs.com/package/amqplib) is a faithful, low-level AMQP 0-9-1 client. It gives you a connection and channels and leaves the rest to you. In practice, every service ends up rewriting the same layer on top: open a channel, assert the exchange, create and bind a queue, `JSON.stringify` the payload, `JSON.parse` it back, choose a handler, `ack` on success, `nack` on failure, and redo all of that after the broker restarts.

`amqp-extension` is that layer, written once:

| Concern | Plain amqplib | amqp-extension |
|---|---|---|
| **Reconnects** | A dropped connection stays dropped. You rebuild the connection, channels and topology yourself | Built on [amqp-connection-manager](https://www.npmjs.com/package/amqp-connection-manager): reconnects automatically and **replays exchange/queue setup** on every reconnect |
| **Topology** | `assertExchange`, `assertQueue` and `bindQueue` before every publish/consume | Asserted for you. Named exchanges get an exclusive, auto-deleted queue bound to your routing key, or a durable named one. The default exchange gets a durable queue |
| **Payloads** | `Buffer` in, `Buffer` out | Objects are sent as JSON, strings as UTF-8, and `Buffer`s pass through unchanged |
| **Dispatch** | One callback receives every message | A handler per message `type`, plus an `$any` fallback |
| **Acknowledgement** | Call `ack`/`nack` manually on every path, including errors | `ack` after the handler resolves, `nack` when it throws or nothing matches, with an optional requeue |
| **Defaults** | Pass the same options at every call site | Client-wide publish/consume defaults, deep-merged with per-call options |
| **Several exchanges** | A separate setup for each | `client.of(exchange)` reuses one connection |

The same consumer, side by side:

```typescript
// amqplib
const connection = await amqplib.connect(url);
const channel = await connection.createChannel();
await channel.assertExchange('events', 'topic');
const { queue } = await channel.assertQueue('', { exclusive: true, autoDelete: true });
await channel.bindQueue(queue, 'events', 'user.*');
await channel.consume(queue, async (message) => {
    if (!message) return;
    try {
        const payload = JSON.parse(message.content.toString('utf-8'));
        if (message.properties.type === 'userCreated') await onUserCreated(payload);
        channel.ack(message);
    } catch (e) {
        channel.nack(message, false, false);
    }
});
// ...and none of this survives a broker restart

// amqp-extension
const client = new Client({ connectionOptions: url, exchange: { name: 'events', type: 'topic' } });
await client.consume('user.*', {
    userCreated: async (message) => onUserCreated(JSON.parse(message.content.toString('utf-8'))),
});
```

**Table of Contents**
- [Installation](#installation)
- [Usage](#usage)
  - [Client](#client)
  - [Publish](#publish)
  - [Consume](#consume)
  - [Multiple exchanges](#multiple-exchanges)
  - [Errors](#errors)
- [Options](#options)
  - [Queue options](#queue-options)
- [API](#api)
- [Notes](#notes)
- [License](#license)

## Installation

```bash
npm install amqp-extension --save
```

The package is ESM-only and requires Node.js `>=22`.

## Usage

### Client

A `Client` owns one connection and is bound to one exchange. Leave out `exchange` to use the **default exchange**, which routes each message straight to the queue named in the call.

```typescript
import { Client } from 'amqp-extension';

const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: 'events',
        type: 'topic',
    },
});
```

You can pass an existing [amqp-connection-manager](https://www.npmjs.com/package/amqp-connection-manager) connection as `connection` instead of `connectionOptions`.
`connectionManagerOptions` is passed to amqp-connection-manager's `connect()`, e.g. to change the delay between reconnect attempts (default: 5 s):

```typescript
const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
    connectionManagerOptions: { reconnectTimeInSeconds: 1 },
});
```

### Publish

`publish(to, data, options?)` sends `data` with `to` as the routing key, or as the queue name on the default exchange. It resolves to `true` once the message is handed to the broker.

```typescript
await client.publish('user.created', { id: 1, name: 'admin' }, {
    type: 'userCreated',
    persistent: true,
});
```

### Consume

`consume(from, options?, handlers)` subscribes to messages matching `from` and routes each one to the handler named after its `type` property. A message with no matching handler goes to `$any`.

```typescript
import type { ConsumeMessage } from 'amqp-extension';

await client.consume('user.*', {
    userCreated: async (message: ConsumeMessage) => {
        const payload = JSON.parse(message.content.toString('utf-8'));
        // { id: 1, name: 'admin' }
    },
    $any: async (message: ConsumeMessage) => {
        // every other type
    },
});
```

A handler that resolves acknowledges the message. A handler that throws, or a message with no matching handler, gets a `nack`. Pass `onError` to see these failures: it is called after the `nack` with the handler's error, or with a `ClientError` (`HANDLER_MISSING`) when no handler matched. Its own errors are swallowed.

```typescript
await client.consume('user.*', {
    onError: (error, message) => logger.error(error, { type: message.properties.type }),
}, {
    userCreated: async (message) => { /* ... */ },
});
```

`consume()` resolves a `Consumer` once the subscription is in place. `cancel()` stops new deliveries, waits for the handlers still running (their messages are acked or nacked as usual), then closes the consumer's channel. It never rejects, and the consumer is not re-registered after a reconnect. `await using` cancels it when the scope ends:

```typescript
const consumer = await client.consume('user.*', { $any: async (message) => { /* ... */ } });
// ...
await consumer.cancel();

{
    await using scoped = await client.consume('jobs', { $any: async (message) => { /* ... */ } });
    // ...
} // cancelled here
```

Both methods also accept a single context object: `client.publish({ to, data, options })`, `client.consume({ from, options, handlers })`.

### Multiple exchanges

`of(exchange)` returns a client bound to another exchange. It shares the same connection and default options.

```typescript
const notifications = client.of({ name: 'notifications', type: 'fanout' });

// fanout ignores the routing key, but publish still requires a non-empty one
await notifications.publish('deploy', { message: 'deploy finished' });
```

By default, `consume` on a named exchange binds an exclusive, temporary queue that lives only as long as the consumer. Pass `queue` to bind a durable, named queue instead: once a `consume` has declared it, it keeps the messages published while no consumer runs, and consumers sharing it split the messages between them. `publish` declares only the exchange, so messages published before the first `consume` are dropped. Queue options apply to it too.

```typescript
const events = client.of({ name: 'events', type: 'topic' });

await events.consume('user.*', { queue: 'audit', queueType: 'quorum' }, {
    $any: async (message) => { /* ... */ },
});
```

The binding stays on the broker: consuming the same `queue` with another `from` adds a binding, it does not replace the old one. On the default exchange, `queue` is ignored, because `from` already is the queue name.

Pass `queue` per call rather than in the client's `consumeOptions`: a default applies to every `consume` of the client and its `of()` siblings, binding one queue to all of them. Consumers sharing a `queue` should register the same handlers, because a message reaches only one of them, and one without a matching handler nacks it (and drops it, unless `requeueOnFailure`).

### Errors

`publish()` and `consume()` reject only with subclasses of `AmqpExtensionError` (built on [`@ebec/core`](https://www.npmjs.com/package/@ebec/core)). Check the category with `instanceof` and the specific failure with `code`:

| Class | `code` |
|---|---|
| `TopologyError` | `QUEUE_NAME_EMPTY`, `EXCHANGE_NAME_MISSING`, `DESTINATION_MISSING` |
| `ClientError` | `CLIENT_CLOSED`, `CHANNEL_CLOSED`, `PUBLISH_TIMEOUT`, `HANDLER_MISSING` (passed to `onError` only) |
| `BrokerError` | `BROKER_REJECTED`, with the AMQP reply code as `replyCode` |
| `SerializationError` | `SERIALIZATION_FAILED` |

```typescript
import { BrokerError, ClientError, ErrorCode } from 'amqp-extension';

try {
    await client.publish('jobs', payload, { timeout: 5_000 });
} catch (e) {
    if (e instanceof BrokerError && e.replyCode === 406) {
        // queue re-declared with different arguments
    } else if (e instanceof ClientError && e.code === ErrorCode.PUBLISH_TIMEOUT) {
        // broker unreachable
    }
}
```

The original amqplib / amqp-connection-manager error is available as `cause`.
`instanceof` also matches errors from a duplicate copy of the library (e.g. two versions in `node_modules`). Errors that crossed a process boundary as JSON (`toJSON()`) are recognized by the guards `isAmqpExtensionError`, `isTopologyError`, `isClientError`, `isBrokerError` and `isSerializationError`.
A failure the library does not recognize surfaces as the base `AmqpExtensionError` with code `AMQP_EXTENSION_ERROR`, and the original error as `cause`.

Earlier releases rejected invalid input with a plain `SyntaxError` or `Error`. Replace `instanceof SyntaxError` checks with `instanceof TopologyError`; the messages are unchanged.

## Options

Client-wide defaults go into the constructor. Per-call options are deep-merged on top of them, and the per-call value wins.

```typescript
const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
    publishOptions: { persistent: true },
    consumeOptions: { prefetchCount: 10, requeueOnFailure: true },
});
```

`publishOptions` and `consumeOptions` accept every amqplib `Options.Publish` / `Options.Consume` field, plus:

| Option | Applies to | Default | Purpose |
|---|---|---|---|
| `requeueOnFailure` | consume | `false` | Requeue messages that are `nack`ed because a handler threw or none matched |
| `queue` | consume | none | Named exchanges only: consume through this durable, named queue instead of a temporary one (see [Multiple exchanges](#multiple-exchanges)) |
| `prefetchCount` | consume | none | Maximum number of unacknowledged messages per consumer (`channel.prefetch`) |
| `noAck` | consume | `false` | amqplib option. When `true`, no `ack`/`nack` is sent at all |
| `onError` | consume | none | `(error, message) => void \| Promise<void>`, called when a handler threw or none matched (also with `noAck`). A call-site `onError` replaces the client default |
| Queue options | both | none | `queueType`, `deliveryLimit`, `deadLetterExchange`, `deadLetterRoutingKey`, `messageTtl`, `maxLength`, `singleActiveConsumer` (see below) |
| `timeout` | publish | none | Milliseconds to wait for the broker to take the message before rejecting with a `ClientError` (`PUBLISH_TIMEOUT`), e.g. while it is unreachable. Without it the call waits for the reconnect |

### Queue options

On the default exchange, `consume` and `publish` assert a named, durable queue. Queue options are set flat on the publish/consume options and map to queue arguments. They also apply to the named queue of a `consume` with `queue` on a named exchange; otherwise named exchanges ignore them.

| Option | Queue argument | Purpose |
|---|---|---|
| `queueType` | `x-queue-type` | `'classic'` or `'quorum'` |
| `deliveryLimit` | `x-delivery-limit` | Drop or dead-letter a message after this many failed deliveries (quorum queues only). Counts only requeued messages: needs `requeueOnFailure: true`, otherwise a failed message is dropped or dead-lettered on its first failure |
| `deadLetterExchange` | `x-dead-letter-exchange` | Exchange that rejected or expired messages are republished to |
| `deadLetterRoutingKey` | `x-dead-letter-routing-key` | Routing key for dead-lettered messages |
| `messageTtl` | `x-message-ttl` | Expire messages after this many milliseconds in the queue |
| `maxLength` | `x-max-length` | Maximum number of ready messages, the oldest are dropped or dead-lettered beyond it |
| `singleActiveConsumer` | `x-single-active-consumer` | Deliver to one consumer at a time, in publish order, and fail over to another when it goes away |

They are not validated client-side: the broker rejects an invalid combination with a `BrokerError`. It also rejects re-declaring a queue with different arguments, so publisher and consumer must pass the same options.

Await the first `consume` (or `publish`) of a new quorum queue before running publisher and consumer concurrently: RabbitMQ 3.13 can crash the channel when a quorum queue is consumed while another channel is still creating it, which drops the connection until it reconnects. Concurrent first publishes to it can also be rejected (`message nacked`) and need a retry.

```typescript
import { Client } from 'amqp-extension';

// no exchange: the default exchange routes to the queue named in each call
const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
});

const queueOptions = { queueType: 'quorum', singleActiveConsumer: true } as const;

await client.consume('<queue>', { ...queueOptions, prefetchCount: 1 }, {
    $any: async (message) => { /* ... */ },
});

await client.publish('<queue>', { foo: 'bar' }, queueOptions);
```

## API

| Export | Kind | Purpose |
|---|---|---|
| `Client` | class | `publish()`, `consume()`, `of()`, `close()`, `[Symbol.asyncDispose]()`, plus the underlying `connection` |
| `ClientContext` | type | Constructor input: `connection` / `connectionOptions`, `connectionManagerOptions`, `exchange`, `publishOptions`, `consumeOptions` |
| `ExchangeType` | enum | `direct` (default exchange), `topic`, `fanout`, `headers` |
| `ConsumeHandlers` | type | Map from message `type` to handler, with the `$any` fallback key |
| `Consumer` | type | Resolved by `consume()`: `cancel()` and `[Symbol.asyncDispose]()` |
| `ConsumeOptions` / `PublishOptions` | type | amqplib options plus the extensions listed above |
| `QueueOptions` | type | Queue arguments (`queueType`, `deliveryLimit`, `deadLetterExchange`, `deadLetterRoutingKey`, `messageTtl`, `maxLength`, `singleActiveConsumer`), part of both `ConsumeOptions` and `PublishOptions` |
| `ConsumeMessage` | type | Re-export of amqplib's message type |
| `AmqpExtensionError`, `TopologyError`, `ClientError`, `BrokerError`, `SerializationError` | class | Error tree, see [Errors](#errors) |
| `ErrorCode` | enum | Stable error codes |
| `isAmqpExtensionError`, `isTopologyError`, `isClientError`, `isBrokerError`, `isSerializationError` | function | Error guards that also match duplicate library copies and JSON round-trips |

## Notes

- **Close the client when you are done:** `await client.close()`. It closes the shared connection, so every `of()` sibling stops too. Nothing is closed automatically on `SIGINT`; hook it into your app's shutdown, e.g. `process.once('SIGTERM', () => client.close())`. For scoped code (scripts, jobs, tests) use `await using client = new Client(...)`: the client closes when the scope ends, also on a throw. Disposal runs at scope exit, not on a signal, and like `close()` it closes the shared connection, so use it on the root client rather than on `of()` siblings.
- **Broker errors reject the call.** If the broker rejects the setup, e.g. `PRECONDITION_FAILED` for a queue re-declared with different queue options or `ACCESS_REFUSED` for a queue that is already consumed exclusively, `publish()` / `consume()` reject with a `BrokerError` (the amqplib error is its `cause`). Only that channel closes; the connection stays up. A connection that merely drops during the call is not an error: the call completes after the reconnect (`publish` is bounded by its `timeout` option).
- **Calls after `close()` reject** with a `ClientError` (`CLIENT_CLOSED`), also on `of()` siblings.
- **A consumer cancelled by the broker stays cancelled**, e.g. when its queue is deleted. Call `consume()` again after re-creating the queue.
- **Invalid input rejects before anything touches the broker:** an empty queue name on the default exchange, a named exchange type without a `name`, or an empty routing key when publishing to a named exchange, with a `TopologyError`.
- **Unconsumed fanout/topic messages are dropped**, unless `consume` passes `queue` and has declared it at least once. Without it, named exchanges bind an exclusive, auto-deleted queue per `consume` call, which lives only as long as that consumer.
- **Handler errors are not rethrown.** They are passed to the `onError` consume option, if set.

## License

Made with 💚

Published under [MIT License](./LICENSE).
