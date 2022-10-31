/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { pathToRegexp } from 'path-to-regexp';
import { RPCServerMethod } from '../constants';
import { RPCServerLayer } from '../layer';
import { RPCServerRequestInterface, RPCServerResponseInterface } from '../type';

export class RPCServerRoute {
    readonly '@instanceof' = Symbol.for('RPCServerRoute');

    public path : string | undefined;

    protected regexp : RegExp;

    protected layers : Record<string, RPCServerLayer> = {};

    constructor(path: string) {
        this.path = path;

        this.regexp = pathToRegexp(path);
    }

    matchPath(path: string) : boolean {
        return this.regexp.exec(path) !== null;
    }

    matchMethod(method: string) : boolean {
        return Object.prototype.hasOwnProperty.call(this.layers, method);
    }

    dispatch(
        req: RPCServerRequestInterface,
        res: RPCServerResponseInterface,
        done: CallableFunction,
    ) : void {
        const name = req.method.toLowerCase();
        const layer = this.layers[name];

        if (typeof layer === 'undefined') {
            done();

            return;
        }

        layer.exec(req.path);

        layer.dispatch(req, res, done);
    }

    register(method: `${RPCServerMethod}`, fn: CallableFunction) {
        this.layers[method] = new RPCServerLayer(
            this.path,
            {
                end: true,
            },
            fn,
        );
    }

    get(fn: CallableFunction) {
        return this.register(RPCServerMethod.GET, fn);
    }

    post(fn: CallableFunction) {
        return this.register(RPCServerMethod.POST, fn);
    }

    delete(fn: CallableFunction) {
        return this.register(RPCServerMethod.DELETE, fn);
    }
}
