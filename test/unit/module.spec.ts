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
import { Client } from '../../src';

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
        await expect(client.consume('mismatch', { $any: () => {} })).rejects.toThrow(/PRECONDITION_FAILED/);

        // only the failing channel closed, the connection keeps working
        expect(client.connection.isConnected()).toBe(true);
        await expect(client.publish('foo', 'bar')).resolves.toBe(true);
    });

    it('should reject invalid input before opening a channel', async () => {
        const nameless = client.of({ type: 'topic' });

        await expect(nameless.consume('foo', { $any: () => {} })).rejects.toThrow(SyntaxError);
        await expect(nameless.publish('foo', 'bar')).rejects.toThrow(SyntaxError);
        await expect(client.of({ type: 'topic', name: 'test' }).publish('', 'bar')).rejects.toThrow(SyntaxError);
    });

    it('should close the connection', async () => {
        const other = new Client({ connectionOptions: inject('MQ_CONNECTION_STRING') });
        await other.publish('close', 'fooBar');

        await other.close();

        expect(other.connection.isConnected()).toBe(false);
    });
});
