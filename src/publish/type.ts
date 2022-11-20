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
     * Amqplib publish options.
     */
    options?: Options.Publish;
};
