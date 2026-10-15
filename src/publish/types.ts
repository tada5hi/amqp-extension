/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';
import type { QueueOptions } from '../queue';

/**
 * The AMQP properties of a published message (type, messageId, headers, persistent, …).
 */
export type PublishProperties = Options.Publish;

export type PublishOptions = PublishProperties & QueueOptions & {
    /**
     * Reject with ClientError (PUBLISH_TIMEOUT) when the message is not
     * handed to the broker within this many milliseconds, e.g. while the
     * broker is unreachable and the connection manager is reconnecting.
     *
     * Default: undefined (wait for the reconnect)
     */
    timeout?: number
};
export type PublishContext = {
    to: string,
    data: any,
    options?: PublishOptions,
};
