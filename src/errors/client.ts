/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';

export class ClientError extends AmqpExtensionError {
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

    static timeout(cause?: unknown) {
        return new ClientError({
            code: ErrorCode.PUBLISH_TIMEOUT,
            message: 'The publish operation timed out.',
            cause,
        });
    }
}
