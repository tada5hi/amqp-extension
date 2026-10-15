/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ErrorInput } from '@ebec/core';
import { hasInstanceof, markInstanceof } from '@ebec/core';
import { AmqpExtensionError } from './base';
import { ErrorCode, SERIALIZATION_ERROR_MARKER } from './constants';

export class SerializationError extends AmqpExtensionError {
    static override [Symbol.hasInstance](input: unknown) : boolean {
        return hasInstanceof(input, SERIALIZATION_ERROR_MARKER);
    }

    constructor(input?: ErrorInput) {
        super(input);
        markInstanceof(this, SERIALIZATION_ERROR_MARKER);
    }
    static payload(cause?: unknown) {
        return new SerializationError({
            code: ErrorCode.SERIALIZATION_FAILED,
            message: 'The message payload could not be serialized.',
            cause,
        });
    }
}
