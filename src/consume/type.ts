/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Channel, MessageFields, MessageProperties, Options,
} from 'amqplib';
import { Config } from '../config';
import { ConsumeHandlerAnyKey } from './static';

export type ConsumeMessage = {
    /**
     *
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
     * Default: {}
     */
    metadata: MessageProperties & MessageFields;

    /**
     * The message data.
     *
     */
    data: any;
};
export type ConsumeMessageHandler = (message: ConsumeMessage, channel: Channel) => Promise<void>;
export type ConsumeHandlerAnyKeyType = typeof ConsumeHandlerAnyKey;

export type ConsumeHandlers = Record<ConsumeHandlerAnyKeyType | string, ConsumeMessageHandler>;

export type ConsumeOptions = {
    /**
     * Queue routing key(s).
     */
    routingKey?: string | string[],

    /**
     * Config key or object.
     */
    alias?: string | Config,

    /**
     * Queue name.
     *
     * Default: ''
     */
    queueName?: string,

    /**
     * Amqplib consume options.
     *
     * Default: { }
     */
    options?: Options.Consume;

    /**
     * Default: false
     */
    requeueOnFailure?: boolean;
};
