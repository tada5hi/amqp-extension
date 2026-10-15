/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ConsumeMessage } from 'amqplib';
import {
    describe,
    expect,
    it,
} from 'vitest';
import { TopologyError } from '../../src';
import { handleMessage } from '../../src/consume/utils';
import { planTopology } from '../../src/queue/utils';

describe('src/queue/utils', () => {
    const topic = { type: 'topic', name: 'events' } as const;

    it('should plan a durable named queue for the default exchange', () => {
        expect(planTopology({ type: 'direct' }, 'jobs', {}))
            .toEqual({ queue: { name: 'jobs', options: { durable: true } } });
    });

    it('should add the single active consumer argument', () => {
        expect(planTopology({ type: 'direct' }, 'jobs', { singleActiveConsumer: true }))
            .toEqual({
                queue: {
                    name: 'jobs',
                    options: { durable: true, arguments: { 'x-single-active-consumer': true } },
                },
            });
    });

    it.each([
        [{ queueType: 'quorum' }, { 'x-queue-type': 'quorum' }],
        [{ deliveryLimit: 3 }, { 'x-delivery-limit': 3 }],
        [{ deadLetterExchange: 'dlx' }, { 'x-dead-letter-exchange': 'dlx' }],
        [{ deadLetterRoutingKey: 'dead' }, { 'x-dead-letter-routing-key': 'dead' }],
        [{ messageTtl: 0 }, { 'x-message-ttl': 0 }],
        [{ maxLength: 10 }, { 'x-max-length': 10 }],
        [{ singleActiveConsumer: true, queueType: 'quorum' }, { 'x-single-active-consumer': true, 'x-queue-type': 'quorum' }],
    ] as const)('should map %o to queue arguments', (options, args) => {
        expect(planTopology({ type: 'direct' }, 'jobs', options).queue)
            .toEqual({ name: 'jobs', options: { durable: true, arguments: args } });
    });

    it('should add no queue arguments for unset or disabled options', () => {
        expect(planTopology({ type: 'direct' }, 'jobs', {
            queueType: undefined,
            messageTtl: undefined,
            singleActiveConsumer: false,
        }).queue).toEqual({ name: 'jobs', options: { durable: true } });
    });

    it('should plan only the exchange for publishing to a named exchange', () => {
        expect(planTopology(topic, 'user.created', {}))
            .toEqual({
                exchange: {
                    name: 'events',
                    type: 'topic',
                    options: undefined,
                },
            });
    });

    it('should plan an exclusive server-named queue bound to the key for consuming', () => {
        expect(planTopology(topic, 'user.*', {}, true))
            .toEqual({
                exchange: {
                    name: 'events',
                    type: 'topic',
                    options: undefined,
                },
                queue: {
                    name: '',
                    options: {
                        durable: false,
                        autoDelete: true,
                        exclusive: true,
                    },
                },
                bind: 'user.*',
            });
    });

    it('should allow consuming a named exchange with an empty binding key', () => {
        expect(planTopology({ type: 'fanout', name: 'broadcast' }, '', {}, true).bind).toEqual('');
    });

    it('should reject an empty queue name on the default exchange', () => {
        expect(() => planTopology({ type: 'direct' }, '', {})).toThrow(TopologyError);
        expect(() => planTopology({ type: 'direct' }, '', {}, true)).toThrow(/queue name/);
    });

    it('should reject a named exchange type without a name, for publish and consume', () => {
        expect(() => planTopology({ type: 'topic' }, 'a', {})).toThrow(TopologyError);
        expect(() => planTopology({ type: 'topic', name: '' }, 'a', {}, true)).toThrow(TopologyError);
    });

    it('should reject publishing to a named exchange without a routing key', () => {
        expect(() => planTopology(topic, '', {})).toThrow(TopologyError);
    });
});

describe('src/consume/utils', () => {
    const createMessage = (type?: string) => ({ properties: { type } }) as ConsumeMessage;

    const createChannel = () => {
        const calls: string[] = [];
        return {
            calls,
            ack: () => { calls.push('ack'); },
            nack: (_message: unknown, _allUpTo?: boolean, requeue?: boolean) => { calls.push(`nack:${requeue}`); },
        };
    };

    it('should ack after the handler for the message type resolves', async () => {
        const channel = createChannel();
        const seen: string[] = [];

        await handleMessage(createMessage('created'), channel, {
            created: () => { seen.push('created'); },
            $any: () => { seen.push('$any'); },
        }, {});

        expect(seen).toEqual(['created']);
        expect(channel.calls).toEqual(['ack']);
    });

    it('should not ack before an async handler settles', async () => {
        const channel = createChannel();
        const { promise: gate, resolve } = Promise.withResolvers<void>();

        const handled = handleMessage(createMessage('created'), channel, { created: () => gate }, {});
        await Promise.resolve();
        expect(channel.calls).toEqual([]);

        resolve();
        await handled;
        expect(channel.calls).toEqual(['ack']);
    });

    it('should fall back to $any', async () => {
        const channel = createChannel();
        const seen: string[] = [];

        await handleMessage(createMessage('unknown'), channel, { $any: () => { seen.push('$any'); } }, {});

        expect(seen).toEqual(['$any']);
        expect(channel.calls).toEqual(['ack']);
    });

    it('should not dispatch to inherited properties of the handler map', async () => {
        const channel = createChannel();
        const seen: string[] = [];

        // the type is set by the publisher, i.e. untrusted
        await handleMessage(createMessage('toString'), channel, { $any: () => { seen.push('$any'); } }, {});
        await handleMessage(createMessage('constructor'), channel, {}, {});

        expect(seen).toEqual(['$any']);
        expect(channel.calls).toEqual(['ack', 'nack:false']);
    });

    it('should nack without requeue when no handler matches', async () => {
        const channel = createChannel();

        await handleMessage(createMessage('unknown'), channel, {}, {});

        expect(channel.calls).toEqual(['nack:false']);
    });

    it('should nack with requeueOnFailure when the handler throws', async () => {
        const channel = createChannel();

        await handleMessage(createMessage('created'), channel, { created: () => { throw new Error('boom'); } }, { requeueOnFailure: true });

        expect(channel.calls).toEqual(['nack:true']);
    });

    it('should neither ack nor nack with noAck', async () => {
        const channel = createChannel();

        await handleMessage(createMessage('created'), channel, { created: () => { throw new Error('boom'); } }, { noAck: true });
        await handleMessage(createMessage('created'), channel, {}, { noAck: true });

        expect(channel.calls).toEqual([]);
    });

    it('should ignore a cancelled consumer (null message)', async () => {
        const channel = createChannel();

        await handleMessage(null, channel, {}, {});

        expect(channel.calls).toEqual([]);
    });

    it('should not reject when acking on a closed channel', async () => {
        const channel = {
            ack: () => { throw new Error('Channel closed'); },
            nack: () => { throw new Error('Channel closed'); },
        };

        await expect(handleMessage(createMessage('created'), channel, { created: () => {} }, {})).resolves.toBeUndefined();
        await expect(handleMessage(createMessage('created'), channel, {}, {})).resolves.toBeUndefined();
    });
});
