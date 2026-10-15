/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ErrorInput } from '@ebec/core';
import { hasInstanceof, markInstanceof } from '@ebec/core';
import { AmqpExtensionError } from './base';
import { CLIENT_ERROR_MARKER, ErrorCode } from './constants';

export class ClientError extends AmqpExtensionError {
    static override [Symbol.hasInstance](input: unknown) : boolean {
        return hasInstanceof(input, CLIENT_ERROR_MARKER);
    }

    constructor(input?: ErrorInput) {
        super(input);
        markInstanceof(this, CLIENT_ERROR_MARKER);
    }
    static closed() {
        return new ClientError({ code: ErrorCode.CLIENT_CLOSED, message: 'The client is closed.' });
    }

    static channelClosed(cause?: unknown) {
        return new ClientError({
            code: ErrorCode.CHANNEL_CLOSED,
            message: 'Channel closed',
            cause,
        });
    }

    static handlerMissing(type?: string) {
        return new ClientError({
            code: ErrorCode.HANDLER_MISSING,
            message: typeof type === 'string' ? `No handler for the message type "${type}".` : 'No handler for a message without type.',
        });
    }

    static timeout(cause?: unknown) {
        return new ClientError({
            code: ErrorCode.PUBLISH_TIMEOUT,
            message: 'The publish operation timed out.',
            cause,
        });
    }
}
