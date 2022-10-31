/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RPCClientRequestResolve<T> = (data: T) => void;
export type RPCClientRequestReject = (error: Error) => void;

export type RPCClientRequest<T> = {
    timeout: ReturnType<typeof setTimeout>,
    resolve: RPCClientRequestResolve<T>,
    reject: RPCClientRequestReject,
};
