/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Options } from 'amqplib';
import { Config } from '../config';
import { Message, MessageContext } from '../message';
import { ConsumeHandlerAnyKey } from './static';

export type ConsumeHandler = (message: Message, context: MessageContext) => Promise<void>;
export type ConsumeHandlerAnyKeyType = typeof ConsumeHandlerAnyKey;

export type ConsumeHandlers = Record<ConsumeHandlerAnyKeyType | string, ConsumeHandler>;

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
    name?: string,
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
