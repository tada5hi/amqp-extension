/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { hasOwnProperty } from '../../utils';
import { RPCServerResponseCallback, RPCServerResponseInterface } from './type';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime');

export class RPCServerResponse implements RPCServerResponseInterface {
    protected fn : RPCServerResponseCallback;

    public statusCode : number;

    public headers : Record<string, unknown>;

    constructor(fn: RPCServerResponseCallback) {
        this.fn = fn;

        this.statusCode = 200;
        this.headers = {};
    }

    type(input: string) {
        if (this.get('Content-Type')) {
            return;
        }

        const type = mime.getType(input);
        if (!type) {
            return;
        }

        this.set('Content-Type', type);
    }

    set(key: string, value: unknown) {
        this.headers[key] = value;
    }

    get(key: string) {
        return hasOwnProperty(this.headers, key);
    }

    status(code: number) {
        this.statusCode = code;

        return this;
    }

    json(input: unknown) {
        const body = JSON.stringify(input);

        if (!this.get('Content-Type')) {
            this.set('Content-Type', 'application/json');
        }

        this.send(body);

        return this;
    }

    send(chunk: unknown) {
        switch (typeof chunk) {
            case 'string': {
                this.type('html');
                break;
            }
            case 'boolean':
            case 'number':
            case 'object':
                if (chunk === null) {
                    chunk = '';
                } else if (Buffer.isBuffer(chunk)) {
                    this.type('bin');
                } else {
                    return this.json(chunk);
                }
                break;
        }

        if (typeof chunk === 'string') {
            const type = this.get('Content-Type');

            this.set('Content-Encoding', 'utf-8');

            if (typeof type === 'string') {
                this.set('Content-Type', `${type}; charset=utf-8`);
            }
        }

        this.end(chunk);

        return this;
    }

    end(data?: unknown) {
        this.fn({
            statusCode: this.statusCode,
            headers: this.headers,
            data,
        });

        return this;
    }
}
