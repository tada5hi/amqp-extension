/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PublishOptions } from '../type';

export type PublishOptionsExtended<T = any> = {
    /**
     * Alias for: messageId
     *
     * Default: <generated uuid>
     */
    id?: string;

    /**
     * The message data.
     */
    content: T,
} & PublishOptions;
