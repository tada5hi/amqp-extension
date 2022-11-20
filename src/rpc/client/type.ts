/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { RPCResponse } from '../type';

export type RPCClientRequestPromiseResolve<T> = (data: RPCResponse<T>) => void;
export type RPCClientRequestPromiseReject<E = unknown> = (data: RPCResponse<E>) => void;

export type RPCClientRequest<R, E = unknown> = {
    timeout: ReturnType<typeof setTimeout>,
    resolve: RPCClientRequestPromiseResolve<R>,
    reject: RPCClientRequestPromiseReject<E>
};
