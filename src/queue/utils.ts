/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, Options } from 'amqplib';
import type { Exchange } from '../exchange';
import { TopologyError } from '../errors';
import { isDefaultExchange } from '../exchange';
import type { QueueOptions, Topology } from './types';


const QueueArguments = {
    queueType: 'x-queue-type',
    deliveryLimit: 'x-delivery-limit',
    deadLetterExchange: 'x-dead-letter-exchange',
    deadLetterRoutingKey: 'x-dead-letter-routing-key',
    messageTtl: 'x-message-ttl',
    maxLength: 'x-max-length',
    singleActiveConsumer: 'x-single-active-consumer',
} as const satisfies Record<keyof QueueOptions, string>;

function planQueueOptions(options: QueueOptions) : Options.AssertQueue {
    const queueOptions : Options.AssertQueue = { durable: true };

    const keys = Object.keys(QueueArguments) as (keyof QueueOptions)[];
    for (const key of keys) {
        const value = options[key];
        // false is left out like undefined, so a queue declared without the option stays equivalent
        if (typeof value !== 'undefined' && value !== false) {
            queueOptions.arguments = { ...queueOptions.arguments, [QueueArguments[key]]: value };
        }
    }

    return queueOptions;
}

/**
 * Plan the topology for publishing to or consuming from (consume = true) a key.
 * Throws on invalid input, before anything touches the broker.
 */
export function planTopology(
    exchange: Exchange,
    key: string,
    options: QueueOptions & { queue?: string },
    consume?: boolean,
) : Topology {
    if (isDefaultExchange(exchange.type)) {
        if (!key) {
            throw TopologyError.queueNameEmpty();
        }

        return { queue: { name: key, options: planQueueOptions(options) } };
    }

    if (!exchange.name) {
        throw TopologyError.exchangeNameMissing();
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
            throw TopologyError.destinationMissing();
        }

        return topology;
    }

    if (options.queue === '') {
        throw TopologyError.queueNameEmpty();
    }

    topology.queue = options.queue ?
        { name: options.queue, options: planQueueOptions(options) } :
        {
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
}
