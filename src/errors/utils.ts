/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AmqpExtensionError } from './base';
import { BrokerError } from './broker';
import { ClientError } from './client';
import type { AmqpReplyError } from './types';

/**
 * Map anything thrown below the Client (amqplib, amqp-connection-manager) onto the error tree.
 */
export function toError(e: unknown) : AmqpExtensionError {
    if (e instanceof AmqpExtensionError) {
        return e;
    }

    if (!(e instanceof Error)) {
        return new AmqpExtensionError({ message: String(e), cause: e });
    }

    if (typeof (e as Partial<AmqpReplyError>).code === 'number') {
        return BrokerError.fromAmqp(e as AmqpReplyError);
    }

    // ponytail: amqp-connection-manager's errors carry no class or code, only these messages;
    // a reworded message falls through to the base class
    if (e.message === 'timeout') {
        return ClientError.timeout(e);
    }

    if (e.message === 'Channel closed') {
        return ClientError.channelClosed(e);
    }

    return new AmqpExtensionError({ message: e.message, cause: e });
}
