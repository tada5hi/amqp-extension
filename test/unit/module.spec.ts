/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    afterAll,
    beforeAll,
    describe,
    expect,
    inject,
    it,
} from 'vitest';
import { EventEmitter } from 'node:events';
import { connect } from 'amqp-connection-manager';
import {
    BrokerError,
    Client,
    ClientError,
    type ConsumeMessage,
    ErrorCode,
    ExchangeType,
    SerializationError,
    TopologyError,
    isClientError,
} from '../../src';

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

const inspect = async (client: Client, queue: string) => {
    const channel = client.connection.createChannel();
    try {
        await channel.waitForConnect();
        return await channel.checkQueue(queue);
    } finally {
        await channel.close();
    }
};

describe('src/module', () => {
    let client: Client;

    beforeAll(async () => {
        client = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
    });

    afterAll(async () => {
        await client.connection.close();
    });

    it('should publish message', async () => {
        const published = await client.publish('foo', 'foo');

        expect(published).toBeTruthy();
    });

    it('should publish and subscribe to topic exchange', async () => {
        const topicExchange = client.of({
            type: 'topic',
            name: 'test',
        });

        const { promise: received, resolve } = Promise.withResolvers<string>();

        await topicExchange.consume('foo', {
            $any: (message) => {
                resolve(message.content.toString());
            },
        });

        await expect(topicExchange.publish('foo', 'fooBar')).resolves.toBeTruthy();
        await expect(received).resolves.toEqual('fooBar');
    });

    it('should publish and subscribe to direct exchange', async () => {
        const { promise: received, resolve } = Promise.withResolvers<string>();

        await client.consume('logs', { noAck: false }, {
            $any: (message) => {
                resolve(message.content.toString());
            },
        });

        await expect(client.publish('logs', 'fooBar', { persistent: true })).resolves.toBeTruthy();
        await expect(received).resolves.toEqual('fooBar');
    });

    it('should deliver to a single active consumer in order', async () => {
        const received: Record<string, string[]> = { a: [], b: [] };

        await client.consume('sac', { singleActiveConsumer: true, prefetchCount: 1 }, {
            $any: (message) => {
                received.a.push(message.content.toString());
            },
        });
        await client.consume('sac', { singleActiveConsumer: true, prefetchCount: 1 }, {
            $any: (message) => {
                received.b.push(message.content.toString());
            },
        });

        const sent = ['1', '2', '3', '4', '5', '6'];
        await sent.reduce(
            (prev, item) => prev.then(() => client.publish('sac', item, { singleActiveConsumer: true })),
            Promise.resolve(true),
        );

        const deadline = Date.now() + 5000;
        while (received.a.length + received.b.length < sent.length && Date.now() < deadline) {
            await new Promise((resolve) => { setTimeout(resolve, 20); });
        }

        const active = received.a.length > 0 ? received.a : received.b;
        const passive = received.a.length > 0 ? received.b : received.a;
        expect(active).toEqual(sent);
        expect(passive).toEqual([]);
    });

    it('should round-trip through a quorum queue', async () => {
        const { promise: received, resolve } = Promise.withResolvers<string>();

        await client.consume('quorum', { queueType: 'quorum' }, { $any: (message) => { resolve(message.content.toString()); } });
        await client.publish('quorum', 'fooBar', { queueType: 'quorum' });

        await expect(received).resolves.toEqual('fooBar');
    });

    it('should reject re-declaring a queue with another queue type', { timeout: 10_000 }, async () => {
        await client.publish('queue-type', 'fooBar', { queueType: 'quorum' });

        await expect(client.publish('queue-type', 'fooBar', { queueType: 'classic' })).rejects.toMatchObject({
            constructor: BrokerError,
            replyCode: 406,
        });
        await expect(client.consume('queue-type', { $any: () => {} })).rejects.toMatchObject({
            constructor: BrokerError,
            replyCode: 406,
        });

        expect(client.connection.isConnected()).toBe(true);
    });

    it('should keep messages for a durable named queue on a topic exchange while no consumer runs', async () => {
        const exchange = { type: 'topic', name: 'durable-topic' } as const;
        const url = inject('MQ_CONNECTION_STRING');

        const first = new Client({ connectionOptions: url, exchange });
        await first.consume('order.*', { queue: 'orders' }, { $any: () => {} });
        await first.close();

        await client.of(exchange).publish('order.created', 'fooBar');

        const { promise: received, resolve } = Promise.withResolvers<string>();
        await using second = new Client({ connectionOptions: url, exchange });
        await second.consume('order.*', { queue: 'orders' }, { $any: (message) => { resolve(message.content.toString()); } });

        await expect(received).resolves.toEqual('fooBar');
    });

    it('should split the messages of a named topic queue between its consumers', async () => {
        const exchange = client.of({ type: 'topic', name: 'shared-topic' });
        const received: Record<string, string[]> = { a: [], b: [] };
        const { promise: done, resolve } = Promise.withResolvers<void>();
        const count = (key: string) => (message: ConsumeMessage) => {
            received[key]!.push(message.content.toString());
            if (received.a!.length + received.b!.length === 10) {
                resolve();
            }
        };

        await exchange.consume('job.*', { queue: 'jobs-shared', prefetchCount: 1 }, { $any: count('a') });
        await exchange.consume('job.*', { queue: 'jobs-shared', prefetchCount: 1 }, { $any: count('b') });

        for (let i = 0; i < 10; i++) {
            await exchange.publish('job.run', `${i}`);
        }

        await done;
        // one shared queue: every message reaches exactly one consumer
        expect([...received.a!, ...received.b!].sort()).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
        expect(received.a!.length).toBeGreaterThan(0);
        expect(received.b!.length).toBeGreaterThan(0);
    });

    it('should use the handlers when empty options are passed', async () => {
        const { promise: received, resolve } = Promise.withResolvers<string>();

        await client.consume('empty-options', {}, { $any: (message) => { resolve(message.content.toString()); } });
        await client.publish('empty-options', 'fooBar');

        await expect(received).resolves.toEqual('fooBar');
    });

    it('should reject when the broker rejects the topology', { timeout: 10_000 }, async () => {
        await client.consume('mismatch', { singleActiveConsumer: true }, { $any: () => {} });

        await expect(client.publish('mismatch', 'fooBar')).rejects.toThrow(/PRECONDITION_FAILED/);
        await expect(client.publish('mismatch', 'fooBar')).rejects.toMatchObject({
            constructor: BrokerError,
            code: 'BROKER_REJECTED',
            replyCode: 406,
        });
        await expect(client.consume('mismatch', { $any: () => {} })).rejects.toThrow(/PRECONDITION_FAILED/);
        await expect(client.consume('mismatch', { $any: () => {} })).rejects.toMatchObject({
            constructor: BrokerError,
            code: 'BROKER_REJECTED',
            replyCode: 406,
        });

        // only the failing channel closed, the connection keeps working
        expect(client.connection.isConnected()).toBe(true);
        await expect(client.publish('foo', 'bar')).resolves.toBe(true);
    });

    it('should reject invalid input with a TopologyError', async () => {
        const nameless = client.of({ type: 'topic' });

        await expect(nameless.consume('foo', { $any: () => {} })).rejects.toThrow(TopologyError);
        await expect(nameless.publish('foo', 'bar')).rejects.toThrow(TopologyError);
        await expect(client.of({ type: 'topic', name: 'test' }).publish('', 'bar')).rejects.toThrow(TopologyError);
    });

    it('should recycle the connection on a channel error after setup', { timeout: 10_000 }, async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
        const disconnected = new Promise((resolve) => { other.connection.once('disconnect', resolve); });

        // acking inside the handler makes the second ack fail: 406 unknown delivery tag
        await other.consume('double-ack', { $any: (message, channel) => { channel.ack(message); } });
        // not awaited: the recycle can race the publish confirm, the publish then waits for the reconnect
        other.publish('double-ack', 'fooBar').catch(() => undefined);

        // the connection is recycled, so the consumer is re-registered instead of silently dying
        await expect(disconnected).resolves.toBeDefined();
        await other.close();
    });

    it('should reject a pending publish when the client is closed', { timeout: 10_000 }, async () => {
        // never connects; a short retry delay keeps close() from waiting for the default 5 s
        const other = new Client({ connection: connect('amqp://root:start123@127.0.0.1:1', { reconnectTimeInSeconds: 0.1 }) });
        const published = other.publish('closed', 'fooBar');

        await other.close();

        await expect(published).rejects.toMatchObject({ constructor: ClientError, code: 'CHANNEL_CLOSED' });
    });

    it('should reject a refused consume without tearing down the connection', { timeout: 10_000 }, async () => {
        await client.consume('exclusive', { exclusive: true }, { $any: () => {} });

        // basic.consume (not a declaration) is refused: 403 ACCESS_REFUSED
        await expect(client.consume('exclusive', { $any: () => {} })).rejects.toThrow(/ACCESS_REFUSED/);
        await expect(client.consume('exclusive', { $any: () => {} })).rejects.toMatchObject({ constructor: BrokerError, replyCode: 403 });

        expect(client.connection.isConnected()).toBe(true);
        await expect(client.publish('foo', 'bar')).resolves.toBe(true);
    });

    it('should keep waiting when the connection drops during setup', { timeout: 10_000 }, async () => {
        const other = new Client({ connection: connect(inject('MQ_CONNECTION_STRING'), { reconnectTimeInSeconds: 0.1 }) });
        await other.publish('warmup', 'fooBar');

        const { promise: received, resolve } = Promise.withResolvers<string>();
        const consumed = other.consume('drop-during-setup', { $any: (message) => { resolve(message.content.toString()); } });
        other.connection.reconnect();

        // a transport error is not a broker rejection: consume() resolves after the reconnect
        await expect(consumed).resolves.toMatchObject({ cancel: expect.any(Function) });
        await other.publish('drop-during-setup', 'fooBar');
        await expect(received).resolves.toEqual('fooBar');
        await other.close();
    });

    it('should honour the publish timeout while the broker is unreachable', { timeout: 10_000 }, async () => {
        const other = new Client({ connection: connect('amqp://root:start123@127.0.0.1:1', { reconnectTimeInSeconds: 0.1 }) });

        await expect(other.publish('unreachable', 'fooBar', { timeout: 100 })).rejects.toMatchObject({ constructor: ClientError, code: 'PUBLISH_TIMEOUT' });
        await other.close();
    });

    it('should reject calls after the client (or a sibling) is closed', { timeout: 10_000 }, async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
        const sibling = other.of({ type: 'fanout', name: 'closed-sibling' });

        await other.close();

        await expect(other.publish('closed', 'fooBar')).rejects.toMatchObject({ constructor: ClientError, code: 'CLIENT_CLOSED' });
        await expect(sibling.consume('', { $any: () => {} })).rejects.toMatchObject({ constructor: ClientError, code: 'CLIENT_CLOSED' });
    });

    it('should reject an unserializable payload with a SerializationError', async () => {
        const circular : Record<string, unknown> = {};
        circular.self = circular;

        await expect(client.publish('serialize', circular)).rejects.toMatchObject({ constructor: SerializationError, cause: expect.any(TypeError) });
        await expect(client.publish('serialize', 1n)).rejects.toThrow(SerializationError);
        await expect(client.publish('serialize', undefined)).rejects.toMatchObject({ code: 'SERIALIZATION_FAILED' });
    });

    it('should publish JSON falsy payloads', async () => {
        await expect(client.publish('falsy', null)).resolves.toBe(true);
        await expect(client.publish('falsy', 0)).resolves.toBe(true);
        await expect(client.publish('falsy', false)).resolves.toBe(true);
    });

    it('should consume a fanout exchange with an empty binding key', async () => {
        const fanout = client.of({ type: 'fanout', name: 'broadcast' });
        const { promise: received, resolve } = Promise.withResolvers<string>();

        await fanout.consume('', { $any: (message) => { resolve(message.content.toString()); } });
        await fanout.publish('any', 'fooBar');

        await expect(received).resolves.toEqual('fooBar');
    });

    it('should declare every named exchange type', async () => {
        const types = Object.values(ExchangeType).filter((type) => type !== ExchangeType.DIRECT);

        for (const type of types) {
            await expect(client.of({ type, name: `exchange-type-${type}` }).consume('', { $any: () => {} })).resolves.toBeDefined();
        }
    });

    it('should pass the connection manager options', async () => {
        const reconnectTime = (other: Client) => (other.connection as unknown as { reconnectTimeInSeconds: number }).reconnectTimeInSeconds;
        const custom = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING'), connectionManagerOptions: { reconnectTimeInSeconds: 0.1 } });
        const fallback = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });

        expect(reconnectTime(custom)).toBe(0.1);
        // amqp-connection-manager's default: the heartbeat interval (5 s)
        expect(reconnectTime(fallback)).toBe(5);

        await custom.close();
        await fallback.close();
    });

    it('should not deliver to a cancelled consumer, also not after a reconnect', { timeout: 10_000 }, async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING'), connectionManagerOptions: { reconnectTimeInSeconds: 0.1 } });
        let calls = 0;

        const cancelled = await other.consume('cancel', { $any: () => { calls++; } });
        await cancelled.cancel();

        // cancelled while the connection goes away
        const racing = await other.consume('cancel-racing', { $any: () => { calls++; } });
        other.connection.reconnect();
        await racing.cancel();

        await expect(other.publish('cancel', 'fooBar')).resolves.toBe(true);
        await expect(other.publish('cancel-racing', 'fooBar')).resolves.toBe(true);
        // a consumer replayed on the reconnect would take the messages now
        await sleep(200);

        expect(calls).toBe(0);
        await expect(inspect(other, 'cancel')).resolves.toMatchObject({ messageCount: 1, consumerCount: 0 });
        await expect(inspect(other, 'cancel-racing')).resolves.toMatchObject({ messageCount: 1, consumerCount: 0 });
        await other.close();
    });

    it('should not register a consumer cancelled while the connection comes back', { timeout: 10_000 }, async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING'), connectionManagerOptions: { reconnectTimeInSeconds: 0.1 } });
        let calls = 0;

        const consumer = await other.consume('cancel-connect', { $any: () => { calls++; } });
        // the consumer's channel is opened on 'connect' (registered before), its setup runs after this cancel
        const cancelled = new Promise((resolve) => {
            other.connection.once('connect', () => { resolve(consumer.cancel()); });
        });
        other.connection.reconnect();
        await cancelled;

        await expect(other.publish('cancel-connect', 'fooBar')).resolves.toBe(true);
        await sleep(200);

        expect(calls).toBe(0);
        await expect(inspect(other, 'cancel-connect')).resolves.toMatchObject({ messageCount: 1, consumerCount: 0 });
        await other.close();
    });

    it('should stop deliveries while waiting for an in-flight handler on cancel', { timeout: 10_000 }, async () => {
        const started = Promise.withResolvers<void>();
        const gate = Promise.withResolvers<void>();
        let deliveries = 0;

        const consumer = await client.consume('cancel-stop', {
            $any: async () => {
                deliveries++;
                started.resolve();
                await gate.promise;
            },
        });
        await client.publish('cancel-stop', 'foo');
        await started.promise;

        const cancelling = consumer.cancel();
        await sleep(100);
        // the consumer still waits for the first handler, but no longer receives
        await client.publish('cancel-stop', 'bar');
        await sleep(100);
        gate.resolve();
        await cancelling;
        await sleep(100);

        expect(deliveries).toBe(1);
        await expect(inspect(client, 'cancel-stop')).resolves.toMatchObject({ messageCount: 1, consumerCount: 0 });
    });

    it('should let an in-flight handler finish and ack on cancel', { timeout: 10_000 }, async () => {
        const started = Promise.withResolvers<void>();
        const gate = Promise.withResolvers<void>();
        let deliveries = 0;

        const consumer = await client.consume('cancel-in-flight', {
            $any: async () => {
                deliveries++;
                started.resolve();
                await gate.promise;
            },
        });
        await client.publish('cancel-in-flight', 'fooBar');
        await started.promise;

        let settled = false;
        const cancelling = consumer.cancel().then(() => { settled = true; });
        await sleep(100);
        expect(settled).toBe(false);

        gate.resolve();
        await cancelling;

        // acked once: nothing is left to redeliver
        expect(deliveries).toBe(1);
        await expect(inspect(client, 'cancel-in-flight')).resolves.toMatchObject({ messageCount: 0, consumerCount: 0 });
    });

    it('should cancel twice and after close()', { timeout: 10_000 }, async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });

        const consumer = await other.consume('cancel-twice', { $any: () => {} });
        await expect(Promise.all([consumer.cancel(), consumer.cancel()])).resolves.toEqual([undefined, undefined]);
        await expect(consumer.cancel()).resolves.toBeUndefined();

        const closing = await other.consume('cancel-closed', { $any: () => {} });
        await other.close();
        await expect(closing.cancel()).resolves.toBeUndefined();
    });

    it('should cancel a consumer when an `await using` scope ends', async () => {
        {
            await using consumer = await client.consume('cancel-dispose', { $any: () => {} });
            expect(consumer).toBeDefined();
            await expect(inspect(client, 'cancel-dispose')).resolves.toMatchObject({ consumerCount: 1 });
        }

        await expect(inspect(client, 'cancel-dispose')).resolves.toMatchObject({ consumerCount: 0 });
    });

    it('should report handler failures to onError, the call-site one first', { timeout: 10_000 }, async () => {
        const fallback: unknown[] = [];
        const other = new Client({
            connectionOptions: inject('MQ_CONNECTION_STRING'),
            consumeOptions: { onError: (error) => { fallback.push(error); } },
        });
        const { promise: reported, resolve } = Promise.withResolvers<unknown>();

        await other.consume('on-error', { onError: (error) => { resolve(error); }, prefetchCount: 1 }, { $any: () => { throw new Error('boom'); } });
        // call-site options without onError: the client default reports
        await other.consume('on-error-default', { prefetchCount: 1 }, { created: () => {} });

        await other.publish('on-error', 'fooBar');
        await other.publish('on-error-default', 'fooBar', { type: 'unknown' });

        await expect(reported).resolves.toMatchObject({ message: 'boom' });
        await expect.poll(() => fallback).toHaveLength(1);
        expect(fallback[0]).toMatchObject({ constructor: ClientError, code: 'HANDLER_MISSING' });
        await other.close();
    });

    it('should retry a failing handler with an x-attempt header, through a queue with arguments', async () => {
        const attempts: unknown[] = [];
        const { promise: done, resolve } = Promise.withResolvers<void>();
        const options = { singleActiveConsumer: true, retry: { delay: 10 } };

        const consumer = await client.consume('retry', options, {
            $any: (message) => {
                attempts.push(message.properties.headers?.['x-attempt']);
                if (attempts.length < 3) {
                    throw new Error('boom');
                }
                resolve();
            },
        });
        await client.publish('retry', 'fooBar', { singleActiveConsumer: true, messageId: 'retry-1' });

        await done;
        expect(attempts).toEqual([undefined, 2, 3]);
        await expect.poll(() => inspect(client, 'retry')).toMatchObject({ messageCount: 0 });
        await consumer.cancel();
    });

    it('should drop a message once its retry attempts are exhausted', async () => {
        let calls = 0;
        const { promise: reported, resolve } = Promise.withResolvers<unknown>();

        const consumer = await client.consume('retry-exhausted', {
            retry: { delay: 10, maxAttempts: 2 },
            onError: (error) => {
                if (isClientError(error) && error.code === ErrorCode.ATTEMPTS_EXHAUSTED) {
                    resolve(error);
                }
            },
        }, { $any: () => { calls++; throw new Error('boom'); } });
        await client.publish('retry-exhausted', 'fooBar');

        await expect(reported).resolves.toMatchObject({ cause: { message: 'boom' } });
        expect(calls).toBe(2);
        await expect.poll(() => inspect(client, 'retry-exhausted')).toMatchObject({ messageCount: 0 });
        await consumer.cancel();
    });

    it('should hold a redelivered copy of an ordered message still being handled after a reconnect', { timeout: 20_000 }, async () => {
        const other = new Client({ connection: connect(inject('MQ_CONNECTION_STRING'), { reconnectTimeInSeconds: 0.1 }) });
        const queueOptions = { singleActiveConsumer: true };
        const seen: string[] = [];
        const { promise: started, resolve: start } = Promise.withResolvers<void>();
        const { promise: gate, resolve: open } = Promise.withResolvers<void>();

        const consumer = await other.consume('redelivery-ordered', {
            ...queueOptions,
            prefetchCount: 1,
            ordered: true,
            retry: { delay: 10 },
        }, {
            $any: async (message) => {
                seen.push(message.content.toString());
                start();
                await gate;
            },
        });
        await other.publish('redelivery-ordered', 'm1', { ...queueOptions, messageId: 'm1' });
        await started;

        // the channel is reset while m1 is handled: the broker redelivers m1 to the re-registered consumer
        const reconnected = new Promise((resolve) => { other.connection.once('connect', resolve); });
        other.connection.reconnect();
        await reconnected;
        await other.publish('redelivery-ordered', 'm2', { ...queueOptions, messageId: 'm2' });

        // the copy of m1 holds the prefetch slot, so m2 waits behind it
        await expect.poll(() => inspect(other, 'redelivery-ordered')).toMatchObject({ messageCount: 1, consumerCount: 1 });
        await sleep(200);
        expect(seen).toEqual(['m1']);

        open();
        await expect.poll(() => seen).toEqual(['m1', 'm2']);
        await consumer.cancel();
        // the copy was acked, not left to be requeued
        await expect(inspect(other, 'redelivery-ordered')).resolves.toMatchObject({ messageCount: 0 });
        await other.close();
    });

    it('should close the connection', async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
        await other.publish('close', 'fooBar');

        await other.close();

        expect(other.connection.isConnected()).toBe(false);
    });

    it('should close the connection when an `await using` scope ends', async () => {
        let other: Client;

        {
            await using scoped = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
            other = scoped;
            await scoped.publish('dispose', 'fooBar');
            expect(scoped.connection.isConnected()).toBe(true);
        }

        expect(other.connection.isConnected()).toBe(false);
    });
});

// amqplib never settles a channel close whose connection drops before the broker's close-ok,
// which cannot be timed against a real broker: a fake channel whose close() never settles stands in
describe('src/module: channel close that never settles', () => {
    function createClient() {
        const channel = Object.assign(new EventEmitter(), {
            publish: () => Promise.resolve(true),
            waitForConnect: () => new Promise(() => {}),
            close: () => new Promise(() => {}),
        });

        return {
            channel,
            client: new Client({ connection: { createChannel: () => channel } as any }),
        };
    }

    it('should not hang publish', async () => {
        const { client } = createClient();

        await expect(client.publish('q', 'x')).resolves.toBe(true);
    }, 2000);

    it('should not hang a rejected consume', async () => {
        const { channel, client } = createClient();

        setImmediate(() => channel.emit('error', Object.assign(new Error('PRECONDITION_FAILED'), { code: 406 })));

        await expect(client.consume('q', { $any: async () => {} })).rejects.toThrow(BrokerError);
    }, 2000);
});
