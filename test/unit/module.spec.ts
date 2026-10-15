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
import { connect } from 'amqp-connection-manager';
import {
    BrokerError,
    Client,
    ClientError,
    SerializationError,
    TopologyError,
} from '../../src';

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
        await expect(client.publish('mismatch', 'fooBar')).rejects.toMatchObject({
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
        // never connects; a short retry delay keeps close() from waiting for the default 60 s
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
        await expect(consumed).resolves.toBeUndefined();
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

    it('should close the connection', async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
        await other.publish('close', 'fooBar');

        await other.close();

        expect(other.connection.isConnected()).toBe(false);
    });
});
