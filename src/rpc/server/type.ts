/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RPCServerRequestInterface = {
    body: Record<string, any>
    path: string,
    method: string,
    params?: Record<string, any>
    next?: CallableFunction
};

export interface RPCServerResponseInterface {
    set: (key: string, value: unknown) => void,
    get: (key: string) => boolean,
    status: (code: number) => this,
    json: (data: unknown) => this,
    send: (data?: unknown) => this,
    end: (data?: unknown) => this,
}

export type RPCServerResponseCallbackContext = {
    statusCode: number,
    headers: Record<string, any>,
    data: unknown
};

export type RPCServerResponseCallback = (context: RPCServerResponseCallbackContext) => void;

export type RPCServerErrorHandler = (err: Error, req: RPCServerRequestInterface, res: RPCServerResponseInterface, next: CallableFunction) => unknown;
export type RPCServerHandler = (req: RPCServerRequestInterface, res: RPCServerResponseInterface, next: CallableFunction) => unknown;
