/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';

export class TopologyError extends AmqpExtensionError {
    static queueNameEmpty() {
        return new TopologyError({
            code: ErrorCode.QUEUE_NAME_EMPTY,
            message: 'The queue name can not be empty if the default exchange is selected.',
        });
    }

    static exchangeNameMissing() {
        return new TopologyError({
            code: ErrorCode.EXCHANGE_NAME_MISSING,
            message: 'A non default exchange requires a name.',
        });
    }

    static destinationMissing() {
        return new TopologyError({
            code: ErrorCode.DESTINATION_MISSING,
            message: 'The publish operation requires a destination.',
        });
    }
}
