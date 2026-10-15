/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import { ClientError } from '../errors';
import { ConsumeHandlerAnyKey } from './constants';
import { retryMessage } from './retry';
import type { ConsumeHandlers, ConsumeOptions, HandleMessageContext } from './types';

type Settlement = Pick<Channel, 'ack' | 'nack'>;

function settle(fn: () => void) : void {
    try {
        fn();
    } catch {
        // the channel closed while the handler ran (e.g. reconnect): the broker redelivers the message anyway
    }
}

async function report(options: ConsumeOptions, error: unknown, message: ConsumeMessage) : Promise<void> {
    if (!options.onError) {
        return;
    }

    try {
        await options.onError(error, message);
    } catch {
        // never reject: amqplib discards the consumer callback's promise
    }
}

/**
 * Dispatch a delivery to the handler for its type (or $any) and settle it:
 * ack on success, nack (requeue = requeueOnFailure) on failure or without handler, nothing with noAck.
 * With retry, a handler failure is re-published with the next attempt and the original acked instead.
 * A failure is then reported to onError.
 */
export async function handleMessage(
    message: ConsumeMessage | null,
    channel: Settlement,
    handlers: ConsumeHandlers,
    options: ConsumeOptions,
    context?: HandleMessageContext,
) : Promise<void> {
    // null = the broker cancelled the consumer
    if (!message) {
        return;
    }

    // the type is set by the publisher (untrusted): never resolve inherited properties like 'toString'
    const { type } = message.properties;
    const handler = (typeof type === 'string' && Object.hasOwn(handlers, type) ? handlers[type] : undefined) ||
        handlers[ConsumeHandlerAnyKey];

    if (!handler) {
        if (!options.noAck) {
            settle(() => channel.nack(message, false, options.requeueOnFailure ?? false));
        }

        await report(options, ClientError.handlerMissing(type), message);
        return;
    }

    try {
        await handler(message, channel as Channel);
    } catch (e) {
        await fail(message, channel, options, context, e);
        return;
    }

    if (!options.noAck) {
        settle(() => channel.ack(message));
    }
}

/**
 * Settle a message whose handler threw: retry it (with retry), else nack it.
 */
async function fail(
    message: ConsumeMessage,
    channel: Settlement,
    options: ConsumeOptions,
    context: HandleMessageContext | undefined,
    error: unknown,
) : Promise<void> {
    if (options.noAck) {
        await report(options, error, message);
        return;
    }

    if (!options.retry || !context) {
        settle(() => channel.nack(message, false, options.requeueOnFailure ?? false));
        await report(options, error, message);
        return;
    }

    let retried : boolean;
    try {
        retried = await retryMessage(message, context.republish, options.retry);
    } catch {
        // the re-publish failed (e.g. broker unavailable): requeue, so it comes back as a redelivery
        settle(() => channel.nack(message, false, true));
        await report(options, error, message);
        return;
    }

    // ponytail: a crash between the re-publish and this ack duplicates the message (at-least-once)
    settle(() => channel.ack(message));
    await report(options, retried ? error : ClientError.attemptsExhausted(message.properties.type, error), message);
}
