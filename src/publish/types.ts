/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Options } from 'amqplib';
import type { QueueOptions } from '../queue';

export type PublishOptions = Options.Publish & QueueOptions;
export type PublishContext = {
    to: string,
    data: any,
    options?: PublishOptions,
};
