/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, Options } from 'amqplib';
import type { Exchange, ExchangeOptions } from '../exchange';
import { isDefaultExchange } from '../exchange';
import type { QueueOptions } from './type';

/**
 * What must exist on the broker before publishing or consuming.
 */
export type Topology = {
    exchange?: {
        name: string,
        type: Exchange['type'],
        options?: ExchangeOptions
    },
    // name '' = server-named queue
    queue?: { name: string, options: Options.AssertQueue },
    // routing key binding the queue to the exchange
    bind?: string,
};

/**
 * Plan the topology for publishing to or consuming from (consume = true) a key.
 * Throws on invalid input, before anything touches the broker.
 */
export function planTopology(
    exchange: Exchange,
    key: string,
    options: QueueOptions,
    consume?: boolean,
) : Topology {
    if (isDefaultExchange(exchange.type)) {
        if (!key) {
            throw new Error('The queue name can not be empty if the default exchange is selected.');
        }

        const queueOptions : Options.AssertQueue = { durable: true };
        if (options.singleActiveConsumer) {
            queueOptions.arguments = { 'x-single-active-consumer': true };
        }

        return { queue: { name: key, options: queueOptions } };
    }

    if (!exchange.name) {
        throw new SyntaxError('A non default exchange requires a name.');
    }

    const topology : Topology = {
        exchange: {
            name: exchange.name,
            type: exchange.type,
            options: exchange.options,
        },
    };

    if (!consume) {
        if (!key) {
            throw new SyntaxError('The publish operation requires a destination.');
        }

        return topology;
    }

    topology.queue = {
        name: '',
        options: {
            durable: false,
            autoDelete: true,
            exclusive: true,
        },
    };
    topology.bind = key;

    return topology;
}

/**
 * Declare a planned topology. Returns the (possibly server generated) queue name.
 * Must run inside a channel setup function, so it is replayed on reconnect.
 */
export async function assertTopology(channel: Channel, topology: Topology) : Promise<string | undefined> {
    // A rejected declaration closes the channel with an 'error' event. Without a listener, amqplib rethrows it
    // and tears down the whole connection. The failed setup still rejects, so the caller sees the error.
    // Only while declaring: a channel error after setup must still recycle the connection, so
    // amqp-connection-manager re-runs the setup (a channel-only close is never recovered by it).
    const ignore = () => undefined;
    channel.on('error', ignore);

    try {
        if (topology.exchange) {
            await channel.assertExchange(topology.exchange.name, topology.exchange.type, topology.exchange.options);
        }

        if (!topology.queue) {
            return undefined;
        }

        const { queue } = await channel.assertQueue(topology.queue.name, topology.queue.options);
        if (topology.exchange && typeof topology.bind === 'string') {
            await channel.bindQueue(queue, topology.exchange.name, topology.bind);
        }

        return queue;
    } finally {
        channel.off('error', ignore);
    }
}
