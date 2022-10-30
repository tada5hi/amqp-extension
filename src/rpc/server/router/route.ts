import { pathToRegexp } from 'path-to-regexp';
import { RPCServerRequest, RPCServerResponse } from '../type';
import { RPCServerLayer } from './layer';

export class RPCServerRoute {
    public path : string;

    protected regexp : RegExp;

    protected stack : RPCServerLayer[] = [];

    protected methods : Record<string, boolean> = {};

    constructor(path: string) {
        this.path = path;

        this.regexp = pathToRegexp(path);
    }

    matchPath(path: string) : boolean {
        if (this.stack.length === 0) {
            return false;
        }

        return this.regexp.exec(path) !== null;
    }

    matchMethod(method: string) : boolean {
        const name = method.toLowerCase();

        return !!this.methods[name];
    }

    dispatch(
        req: RPCServerRequest,
        res: RPCServerResponse,
        done: CallableFunction,
    ) {
        if (this.stack.length === 0) {
            done();

            return;
        }

        let index = -1;

        const next = (err?: Error) => {
            const layer = this.stack[index++];
            if (!layer) {
                done(err);
            }

            layer.exec(req.path);

            if (err) {
                layer.handleError(err, req, res, next);
            } else {
                layer.handleRequest(req, res, next);
            }
        };

        next();
    }

    handle(method: 'get' | 'post' | 'delete', fn: CallableFunction) {
        const layer = new RPCServerLayer('/', {
            end: true,
        }, fn);
        this.stack.push(layer);

        this.methods[method] = true;
    }

    get(fn: CallableFunction) {
        return this.handle('get', fn);
    }

    post(fn: CallableFunction) {
        return this.handle('post', fn);
    }

    delete(fn: CallableFunction) {
        return this.handle('delete', fn);
    }
}
