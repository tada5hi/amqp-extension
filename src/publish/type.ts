/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Options } from 'amqplib';
import { Config } from '../config';

export type PublishOptions = {
    /**
     * Config key or object.
     */
    alias?: string | Config;

    /**
     * Queue name if no exchange is specified.
     */
    queueName?: string;

    /**
     * Amqplib publish options.
     */
    options?: Options.Publish;
};

export type PublishMessage = {
    /**
     * Default: <generated uuid>
     */
    id?: string;

    /**
     * Event- or Command-name.
     */
    type?: string;

    /**
     * Metadata object to provide details for the message broker.
     *
     */
    metadata?: Options.Publish;

    /**
     * The message data.
     *
     */
    data: any;

    /**
     * Routing key for message broker,
     * if exchange is used.
     */
    routingKey?: string;

    /**
     * Queue name if no exchange is used.
     */
    queueName?: string;

    /**
     * Connection alias
     */
    alias?: string
};
