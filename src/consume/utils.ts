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
 * Track a run by message id until it settles, so redelivered copies can find it.
 */
async function track(inFlight: Map<string, Promise<void>>, id: string, run: Promise<void>) : Promise<void> {
    inFlight.set(id, run);

    try {
        await run;
    } finally {
        if (inFlight.get(id) === run) {
            inFlight.delete(id);
        }
    }
}

/**
 * Dispatch a delivery to the handler for its type (or $any) and settle it:
 * ack on success, nack (requeue = requeueOnFailure) on failure or without handler, nothing with noAck.
 * With retry, a handler failure is re-published with the next attempt and the original acked instead,
 * and redeliveries of messages with a messageId are guarded (see ConsumeOptions.retry).
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

    const id = message.properties.messageId;
    if (!options.retry || options.noAck || !context || typeof id !== 'string') {
        await dispatch(message, channel, handlers, options, context);
        return;
    }

    if (message.fields.redelivered) {
        const running = context.inFlight.get(id);
        if (running) {
            // the channel was reset while this consumer still handles the original: drop the copy.
            // Acking it would free the prefetch slot and let the next message of an ordered
            // stream run next to the original, so with ordered it waits (runs never reject).
            if (options.ordered) {
                await running;
            }

            settle(() => channel.ack(message));
            return;
        }

        // the consumer died mid-handling (crash, consumer timeout), or a channel reset lost the ack
        // of a run that succeeded (that one runs again, at-least-once): a failed attempt.
        // Tracked through the backoff, so a reset during it does not retry it twice.
        // ponytail: in-process only; a redelivery landing on another consumer runs again.
        await track(context.inFlight, id, fail(message, channel, options, context));
        return;
    }

    await track(context.inFlight, id, dispatch(message, channel, handlers, options, context));
}

async function dispatch(
    message: ConsumeMessage,
    channel: Settlement,
    handlers: ConsumeHandlers,
    options: ConsumeOptions,
    context?: HandleMessageContext,
) : Promise<void> {
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
    } catch (error) {
        await fail(message, channel, options, context, { error });
        return;
    }

    if (!options.noAck) {
        settle(() => channel.ack(message));
    }
}

/**
 * Settle a failed message: retry it (with retry), else nack it.
 * failure is undefined for a redelivery of a message whose consumer died: there is no error to report.
 */
async function fail(
    message: ConsumeMessage,
    channel: Settlement,
    options: ConsumeOptions,
    context?: HandleMessageContext,
    failure?: { error: unknown },
) : Promise<void> {
    if (options.noAck) {
        if (failure) await report(options, failure.error, message);
        return;
    }

    if (!options.retry || !context) {
        settle(() => channel.nack(message, false, options.requeueOnFailure ?? false));
        if (failure) await report(options, failure.error, message);
        return;
    }

    let retried : boolean;
    try {
        retried = await retryMessage(message, context.republish, options.retry);
    } catch {
        // the re-publish failed (e.g. broker unavailable): requeue, so it comes back as a redelivery
        settle(() => channel.nack(message, false, true));
        if (failure) await report(options, failure.error, message);
        return;
    }

    // ponytail: a crash between the re-publish and this ack duplicates the message (at-least-once)
    settle(() => channel.ack(message));

    if (!retried) {
        await report(options, ClientError.attemptsExhausted(message.properties.type, failure?.error), message);
    } else if (failure) {
        await report(options, failure.error, message);
    }
}
