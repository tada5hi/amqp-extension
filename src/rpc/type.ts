/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { OutgoingHttpHeaders } from 'http';

export type RPCResponse<T = any> = {
    data: T,
    headers: OutgoingHttpHeaders,
    statusCode: number
};
