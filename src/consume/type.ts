/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ChannelWrapper } from 'amqp-connection-manager';
import type { ConsumeMessage, Options } from 'amqplib';
import type { ConsumeHandlerAnyKey } from './constants';

export {
    ConsumeMessage,
};

export type ConsumeMessageHandler = (message: ConsumeMessage, channel: ChannelWrapper) => Promise<void> | void;

export type ConsumeHandlers = {
    [ConsumeHandlerAnyKey]?: ConsumeMessageHandler,
} & {
    [key:string] : ConsumeMessageHandler
};

export type ConsumeOptions = Options.Consume & {
    /**
     * Default: false
     */
    requeueOnFailure?: boolean;

    /**
     * Default: undefined
     */
    prefetchCount?: number
};

export type ConsumeContext = {
    from: string,
    options?: ConsumeOptions,
    handlers: ConsumeHandlers
};
