/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';

export class SerializationError extends AmqpExtensionError {
    static payload(cause?: unknown) {
        return new SerializationError({
            code: ErrorCode.SERIALIZATION_FAILED,
            message: 'The message payload could not be serialized.',
            cause,
        });
    }
}
