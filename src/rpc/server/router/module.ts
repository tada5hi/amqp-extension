import { RPCServerHandler, RPCServerRequest, RPCServerResponse } from '../type';
import { RPCServerRoute } from './route';

export class RPCServerRouter {
    protected path : string | undefined;

    protected params : Record<any, any> = {};

    protected stack : RPCServerRoute[] = [];

    constructor(path?: string) {
        this.path = path;
    }

    handle(
        req: RPCServerRequest,
        res: RPCServerResponse,
        fn: CallableFunction,
    ) {
        let idx = -1;

        const next = () => {
            if (idx >= this.stack.length) {
                setImmediate(() => fn());
            }

            let layer : RPCServerRoute;
            let match = false;

            while (match !== true && idx < this.stack.length) {
                layer = this.stack[idx++];

                match = layer.matchPath(req.path);
                if (!match) {
                    continue;
                }

                match = layer.matchMethod(req.method);
            }

            if (!match) {
                fn();
            }

            return layer.dispatch(req, res, next);
        };

        next();
    }

    use(
        path: string,
        router: RPCServerRouter,
    ) {

    }

    route(
        method: 'get' | 'post' | 'delete',
        path: string,
    ) : RPCServerRoute {
        const index = this.stack.findIndex(
            (item) => item.path === path,
        );
        if (index !== -1) {
            return this.stack[index];
        }

        const route = new RPCServerRoute(path);
        this.stack.push(route);

        return route;
    }

    get(path: string, fn: RPCServerHandler) {
        const route = this.route('get', path);
        route.get(fn);
    }

    post(path: string, fn: RPCServerHandler) {
        const route = this.route('post', path);
        route.post(fn);
    }

    delete(path: string, fn: RPCServerHandler) {
        const route = this.route('delete', path);
        route.delete(fn);
    }
}
