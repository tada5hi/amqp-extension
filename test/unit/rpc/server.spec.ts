/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {RPCServerMethod, RPCServerRouter} from "../../../src/rpc";
import {RPCServerResponse} from "../../../src/rpc/server/response";
import {RPCServerRequestInterface} from "../../../src/rpc/server/type";

describe('src/rpc/server/**', () => {
    it('should handle static path',  (done) => {
        const router = new RPCServerRouter();

        router.get('/test', async (req, res) => {
            const data = await new Promise((resolve) => {
                setTimeout(() => resolve('foo'), 0);
            });

            res.send(data);
        })

        const req : RPCServerRequestInterface = {
            method: RPCServerMethod.GET,
            body: {},
            path: '/test',
        };

        const res = new RPCServerResponse((e) => {
            expect(e.data).toEqual('foo');
            expect(e.statusCode).toEqual(200);

            done();
        })

        router.dispatch(req, res);
    })

    it('should handle dynamic path',  (done) => {
        const router = new RPCServerRouter();

        router.get('/test/:id', async (req, res) => {
            const data = await new Promise((resolve) => {
                setTimeout(() => resolve(req.params.id), 0);
            });

            res.send(data);
        })

        const req : RPCServerRequestInterface = {
            method: RPCServerMethod.GET,
            body: {},
            path: '/test/abc',
        };

        const res = new RPCServerResponse((e) => {
            expect(e.data).toEqual('abc');
            expect(e.statusCode).toEqual(200);

            done();
        })

        router.dispatch(req, res);
    })

    it('should handle error',  (done) => {
        const router = new RPCServerRouter();

        router.get('/test/:id',  (req, res) => {
            throw new Error('foo');
        })

        const req : RPCServerRequestInterface = {
            method: RPCServerMethod.GET,
            body: {},
            path: '/test/abc',
        };

        const res = new RPCServerResponse((e) => {
            expect(e.data).toEqual('foo');
            expect(e.statusCode).toEqual(500);

            done();
        })

        router.dispatch(req, res);
    })
})
