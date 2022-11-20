/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { GatewayTimeoutErrorOptions } from '@ebec/http';
import {
    IncomingMessage, OutgoingHttpHeader, OutgoingHttpHeaders,
} from 'http';
import type { Socket } from 'net';
import { Response } from 'routup';
import { Writable } from 'stream';
import { clearTimeout } from 'timers';
import { hasOwnProperty } from '../../../utils';
import { RPCHeader } from '../../constants';
import { setResponseBody } from '../utils/response';

export class RPCServerResponse extends Writable implements Response {
    chunkedEncoding: boolean;

    connection: Socket | null;

    finished: boolean;

    headersSent: boolean;

    req: IncomingMessage;

    sendDate: boolean;

    shouldKeepAlive: boolean;

    statusCode: number;

    statusMessage: string;

    socket: Socket | null;

    useChunkedEncodingByDefault: boolean;

    // --------------------------------------------------

    protected headers : OutgoingHttpHeaders = {};

    protected timeout : ReturnType<typeof setTimeout> | undefined;

    protected bufferParts : Buffer[] = [];

    // --------------------------------------------------

    constructor() {
        super();

        this.chunkedEncoding = true;
        this.connection = null;
        this.finished = false;
        this.headersSent = false;
        this.sendDate = false;
        this.shouldKeepAlive = false;
        this.socket = null;
        this.useChunkedEncodingByDefault = false;

        this.statusCode = 200;
        this.statusMessage = 'OK';

        this.registerEventHandlers();
    }

    // --------------------------------------------------

    protected registerEventHandlers() {
        this.once('close', () => {
            clearTimeout(this.timeout);
        });

        this.once('error', () => {
            clearTimeout(this.timeout);
        });
    }

    // --------------------------------------------------

    _write(chunk: any, encoding: BufferEncoding, callback: (error?: (Error | null)) => void) {
        if (typeof chunk === 'string') {
            this.bufferParts.push(Buffer.from(chunk, encoding));
        }

        if (Buffer.isBuffer(chunk)) {
            this.bufferParts.push(chunk);
        }

        callback();
    }

    _final(callback: (error?: (Error | null)) => void) {
        const output = Buffer.concat(this.bufferParts);
        setResponseBody(this, output);

        this.bufferParts = [];

        this.setHeader(RPCHeader.CONTENT_LENGTH, output.byteLength);

        callback();
    }

    // --------------------------------------------------

    addTrailers(headers: OutgoingHttpHeaders | ReadonlyArray<[string, string]>): void {
        if (!this.chunkedEncoding) {
            return;
        }

        if (typeof headers === 'object') {
            const keys = Object.keys(headers);
            for (let i = 0; i < keys.length; i++) {
                this.setHeader(keys[i], (headers as OutgoingHttpHeaders)[keys[i]]);
            }
        }
    }

    // --------------------------------------------------

    flushHeaders(): void {
        if (this.headersSent) {
            return;
        }

        this.headers = {};
    }

    getHeader(name: string): number | string | string[] | undefined {
        name = name.toLowerCase();

        return this.headers[name];
    }

    getHeaderNames(): string[] {
        return Object.keys(this.headers);
    }

    getHeaders(): OutgoingHttpHeaders {
        return this.headers;
    }

    hasHeader(name: string): boolean {
        return hasOwnProperty(this.headers, name.toLowerCase());
    }

    removeHeader(name: string): void {
        name = name.toLowerCase();
        if (hasOwnProperty(this.headers, name)) {
            delete this.headers[name];
        }
    }

    setHeader(name: string, value: number | string | ReadonlyArray<string>): this {
        name = name.toLowerCase();

        if (Array.isArray(value)) {
            this.headers[name] = [...value];
        } else {
            this.headers[name] = value as string | number;
        }

        return this;
    }

    // --------------------------------------------------

    setTimeout(msecs: number, callback: (() => void) | undefined): this {
        clearTimeout(this.timeout);

        this.timeout = setTimeout(() => {
            this.statusCode = GatewayTimeoutErrorOptions.statusCode;
            this.statusMessage = GatewayTimeoutErrorOptions.message;

            this.end(() => callback());
        }, msecs);

        return this;
    }

    // --------------------------------------------------

    writeContinue(callback: (() => void) | undefined): void {

    }

    writeEarlyHints(hints: Record<string, string | string[]>, callback: (() => void) | undefined): void {

    }

    // --------------------------------------------------

    writeHead(statusCode: number, headers?: (OutgoingHttpHeaders | OutgoingHttpHeader[])) : this;

    writeHead(statusCode: number, statusMessage?: string, headers?: (OutgoingHttpHeaders | OutgoingHttpHeader[])) : this;

    writeHead(statusCode: number, statusMessage?: unknown, headers?: (OutgoingHttpHeaders | OutgoingHttpHeader[])) : this {
        return this;
    }

    // --------------------------------------------------

    writeProcessing(): void {

    }

    // --------------------------------------------------

    assignSocket(socket: Socket): void {

    }

    detachSocket(socket: Socket): void {

    }
}
