/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ErrorInput } from '@ebec/core';
import { BaseError, hasInstanceof, markInstanceof } from '@ebec/core';
import { AMQP_EXTENSION_ERROR_MARKER } from './constants';

/**
 * Root of every error thrown by amqp-extension.
 *
 * instanceof is duck-typed through @ebec/core's marker chain, so it also matches errors
 * from a duplicate copy of the library. Every subclass overrides Symbol.hasInstance with
 * its own marker, otherwise it would inherit this one and match every library error.
 */
export class AmqpExtensionError extends BaseError {
    static override [Symbol.hasInstance](input: unknown) : boolean {
        return hasInstanceof(input, AMQP_EXTENSION_ERROR_MARKER);
    }

    constructor(input?: ErrorInput) {
        super(input);
        markInstanceof(this, AMQP_EXTENSION_ERROR_MARKER);
    }
}
