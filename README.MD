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
| **Topology** | `assertExchange`, `assertQueue` and `bindQueue` before every publish/consume | Asserted for you. Named exchanges get an exclusive, auto-deleted queue bound to your routing key. The default exchange gets a durable queue |
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

A handler that resolves acknowledges the message. A handler that throws, or a message with no matching handler, gets a `nack`.

Both methods also accept a single context object: `client.publish({ to, data, options })`, `client.consume({ from, options, handlers })`.

### Multiple exchanges

`of(exchange)` returns a client bound to another exchange. It shares the same connection and default options.

```typescript
const notifications = client.of({ name: 'notifications', type: 'fanout' });

// fanout ignores the routing key, but publish still requires a non-empty one
await notifications.publish('deploy', { message: 'deploy finished' });
```

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
| `prefetchCount` | consume | — | Maximum number of unacknowledged messages per consumer (`channel.prefetch`) |
| `noAck` | consume | `false` | amqplib option. When `true`, no `ack`/`nack` is sent at all |
| `singleActiveConsumer` | both | `false` | Declare the default-exchange queue as single active consumer (see below) |

### Queue options

On the default exchange, `consume` and `publish` assert a named, durable queue. Queue options are set flat on the publish/consume options, and named exchanges ignore them. `singleActiveConsumer` delivers to one consumer at a time, in publish order, and fails over to another when it goes away. The broker rejects re-declaring a queue with different arguments, so publisher and consumer must pass the same options.

```typescript
import { Client } from 'amqp-extension';

// no exchange: the default exchange routes to the queue named in each call
const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
});

await client.consume('<queue>', { singleActiveConsumer: true, prefetchCount: 1 }, {
    $any: async (message) => { /* ... */ },
});

await client.publish('<queue>', { foo: 'bar' }, { singleActiveConsumer: true });
```

## API

| Export | Kind | Purpose |
|---|---|---|
| `Client` | class | `publish()`, `consume()`, `of()`, plus the underlying `connection` |
| `ClientContext` | type | Constructor input: `connection` / `connectionOptions`, `exchange`, `publishOptions`, `consumeOptions` |
| `ExchangeType` | enum | `direct` (default exchange), `topic`, `fanout`, `match` |
| `ConsumeHandlers` | type | Map from message `type` to handler, with the `$any` fallback key |
| `ConsumeOptions` / `PublishOptions` | type | amqplib options plus the extensions listed above |
| `QueueOptions` | type | `{ singleActiveConsumer?: boolean }`, part of both `ConsumeOptions` and `PublishOptions` |
| `ConsumeMessage` | type | Re-export of amqplib's message type |

## Notes

- **Close the connection when you are done:** `await client.connection.close()`. A client that created its own connection also closes it on `SIGINT`.
- **Unconsumed fanout/topic messages are dropped.** Named exchanges bind an exclusive, auto-deleted queue per `consume` call, which lives only as long as that consumer.
- **Handler errors are not rethrown.** Catch and log inside the handler if you need visibility.

## License

Made with 💚

Published under [MIT License](./LICENSE).
