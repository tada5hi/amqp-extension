/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import { ConsumeHandlerAnyKey } from './constants';
import type { ConsumeHandlers, ConsumeOptions } from './type';

/**
 * Dispatch a delivery to the handler for its type (or $any) and settle it:
 * ack on success, nack (requeue = requeueOnFailure) on failure or without handler, nothing with noAck.
 */
export async function handleMessage(
    message: ConsumeMessage | null,
    channel: Pick<Channel, 'ack' | 'nack'>,
    handlers: ConsumeHandlers,
    options: ConsumeOptions,
) : Promise<void> {
    // null = the broker cancelled the consumer
    if (!message) {
        return;
    }

    // the type is set by the publisher (untrusted): never resolve inherited properties like 'toString'
    const { type } = message.properties;
    const handler = (typeof type === 'string' && Object.hasOwn(handlers, type) ? handlers[type] : undefined) ||
        handlers[ConsumeHandlerAnyKey];

    let ok = !!handler;
    if (handler) {
        try {
            await handler(message, channel as Channel);
        } catch {
            // ponytail: handler errors are swallowed (nack only), add an onError option when visibility is needed
            ok = false;
        }
    }

    if (options.noAck) {
        return;
    }

    try {
        if (ok) {
            channel.ack(message);
        } else {
            channel.nack(message, false, options.requeueOnFailure ?? false);
        }
    } catch {
        // the channel closed while the handler ran (e.g. reconnect): the broker redelivers the message anyway
    }
}
