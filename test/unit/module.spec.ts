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
});
