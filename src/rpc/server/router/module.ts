/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { checkInstance } from '../../../utils';
import {
    RPCServerHandler,
    RPCServerRequestInterface,
    RPCServerResponseInterface,
} from '../type';
import { RPCServerLayer, isRPCServerLayerInstance } from '../layer';
import { RPCServerRoute, isRPCServerRouteInstance } from '../route';

export function isRPCServerRouterInstance(input: unknown) : input is RPCServerRouter {
    return checkInstance(input, 'RPCServerRouter');
}

export class RPCServerRouter {
    readonly '@instanceof' = Symbol.for('RPCServerRouter');

    public path : string | undefined;

    protected stack : (RPCServerRouter | RPCServerRoute | RPCServerLayer)[] = [];

    constructor(path?: string) {
        this.path = path;
    }

    dispatch(
        req: RPCServerRequestInterface,
        res: RPCServerResponseInterface,
        done?: CallableFunction,
    ) : void {
        let index = -1;

        const fn = (err?: Error) => {
            if (
                typeof err !== 'undefined' &&
                typeof done === 'undefined'
            ) {
                res.status(500).send(err.message);

                return;
            }

            if (typeof done !== 'undefined') {
                done(err);
            }
        };

        const next = (err?: Error) : void => {
            if (index >= this.stack.length) {
                setImmediate(() => fn(err));
            }

            let layer : RPCServerRoute | RPCServerRouter | RPCServerLayer;
            let match = false;

            while (match !== true && index < this.stack.length) {
                index++;
                layer = this.stack[index];

                if (isRPCServerLayerInstance(layer)) {
                    match = layer.exec(req.path);
                }

                if (isRPCServerRouterInstance(layer)) {
                    match = true;
                }

                if (isRPCServerRouteInstance(layer)) {
                    match = layer.matchPath(req.path) && layer.matchMethod(req.method);
                }
            }

            if (!match) {
                fn(err);
                return;
            }

            if (err) {
                if (
                    isRPCServerLayerInstance(layer) &&
                    layer.isError()
                ) {
                    layer.dispatch(req, res, next, err);

                    return;
                }

                next(err);

                return;
            }

            layer.dispatch(req, res, next);
        };

        next();
    }

    use(router: RPCServerRouter) {
        this.stack.push(router);
    }

    useMiddleware(middleware: RPCServerHandler) {
        const layer = new RPCServerLayer('/', {
            start: false,
            end: false,
        }, middleware);

        this.stack.push(layer);
    }

    private route(
        path: string,
    ) : RPCServerRoute {
        const index = this.stack.findIndex(
            (item) => isRPCServerRouteInstance(item) && item.path === path,
        );
        if (index !== -1) {
            return this.stack[index] as RPCServerRoute;
        }

        const route = new RPCServerRoute(path);
        this.stack.push(route);

        return route;
    }

    get(path: string, fn: RPCServerHandler) {
        const route = this.route(path);
        route.get(fn);
    }

    post(path: string, fn: RPCServerHandler) {
        const route = this.route(path);
        route.post(fn);
    }

    delete(path: string, fn: RPCServerHandler) {
        const route = this.route(path);
        route.delete(fn);
    }
}
