/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import { ClientError } from '../errors';
import { ConsumeHandlerAnyKey } from './constants';
import type { ConsumeHandlers, ConsumeOptions } from './types';

/**
 * Dispatch a delivery to the handler for its type (or $any) and settle it:
 * ack on success, nack (requeue = requeueOnFailure) on failure or without handler, nothing with noAck.
 * A failure is then reported to onError.
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
    let error : unknown;
    if (handler) {
        try {
            await handler(message, channel as Channel);
        } catch (e) {
            ok = false;
            error = e;
        }
    } else {
        error = ClientError.handlerMissing(type);
    }

    if (!options.noAck) {
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

    if (!ok && options.onError) {
        try {
            await options.onError(error, message);
        } catch {
            // never reject: amqplib discards the consumer callback's promise
        }
    }
}
