/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RPCState } from './constants';

export type RPCError = {
    code: string,
    message: string,
    statusCode?: number
};

export type RPCSuccessResponse<T> = {
    state: `${RPCState.SUCCESS}`,
    data: T
};

export type RPCErrorResponse = {
    state: `${RPCState.ERROR}`,
    data: RPCError
};

export type RPCResponse<T> = RPCSuccessResponse<T> | RPCErrorResponse;
