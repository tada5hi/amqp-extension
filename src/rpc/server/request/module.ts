/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { IncomingHttpHeaders } from 'http';
import { Socket } from 'net';
import { Request } from 'routup';
import { Readable } from 'stream';
import { RPCServerRequestContext } from './type';

export class RPCServerRequest extends Readable implements Request {
    aborted: boolean;

    complete: boolean;

    connection: Socket;

    headers: IncomingHttpHeaders;

    httpVersion: string;

    httpVersionMajor: number;

    httpVersionMinor: number;

    method: string | undefined;

    rawHeaders: string[];

    rawTrailers: string[];

    socket: Socket;

    statusCode: number | undefined;

    statusMessage: string | undefined;

    trailers: NodeJS.Dict<string>;

    url: string | undefined;

    // --------------------------------------------------

    constructor(context?: RPCServerRequestContext) {
        super();

        this.aborted = false;
        this.complete = true;
        this.httpVersion = '1.1';
        this.httpVersionMajor = 1;
        this.httpVersionMinor = 1;
        this.rawHeaders = [];
        this.rawTrailers = [];
        this.trailers = {};

        context = context || {};

        this.headers = this.transformHeaders(context.headers || {});
        this.method = context.method || 'GET';
        this.statusCode = 200;
        this.statusMessage = 'OK';
        this.url = context.url || '/';

        this.socket = new Socket();
    }

    // --------------------------------------------------

    setTimeout(msecs: number, callback?: () => void): this {
        return undefined;
    }

    // --------------------------------------------------

    private transformHeaders(input: Record<string, any>) : IncomingHttpHeaders {
        const output : IncomingHttpHeaders = {};
        const keys = Object.keys(input);

        for (let i = 0; i < keys.length; i++) {
            output[keys[i].toLowerCase()] = input[keys[i]];
        }

        return output;
    }
}
