/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Connection, ConsumeMessage, Options } from 'amqplib';
import { RPC } from '../shared';
import { bufferFromData } from '../utils';
import { RPCServerResponse } from './response';
import { RPCServerRouter } from './router';
import {
    RPCServerHandler, RPCServerRequestInterface, RPCServerResponseCallbackContext,
} from './type';

export class RPCServer extends RPC {
    protected router : RPCServerRouter;

    // --------------------------------------------------

    constructor(connection: Connection) {
        super(connection);

        this.router = new RPCServerRouter();
    }

    // --------------------------------------------------

    async listen() {
        const channel = await this.connect();

        const assertQueue = await channel.assertQueue('', {
            durable: false,
            autoDelete: true,
        });

        this.queueName = assertQueue.queue;

        await channel.consume(
            this.queueName,
            (data) => this.handleIncomingMessage(data),
        );

        return channel;
    }

    // --------------------------------------------------

    private async handleIncomingMessage(data: ConsumeMessage | null) {
        if (typeof data === 'undefined') {
            return;
        }

        this.channel.ack(data);

        const { replyTo, deliveryMode, correlationId } = data.properties;
        const options : Options.Publish = {
            persistent: deliveryMode !== 1,
            correlationId,
        };

        const result = await this.dispatchMessage(data);

        this.channel.sendToQueue(
            replyTo,
            bufferFromData(result),
            options,
        );
    }

    private async dispatchMessage(message: ConsumeMessage) : Promise<RPCServerResponseCallbackContext> {
        const content = Buffer.from(message.content).toString('utf-8');
        const body = JSON.parse(content);

        let timeout : ReturnType<typeof setTimeout> | undefined;

        return new Promise<RPCServerResponseCallbackContext>((resolve) => {
            const handleError = (e: unknown) => {
                clearTimeout(timeout);

                const response = new RPCServerResponse((data) => resolve(data));
                response.status(500);
                response.send({
                    message: e instanceof Error ? e.message : 'Unknown',
                    statusCode: 500,
                    code: 'xxx',
                });
            };

            timeout = setTimeout(() => handleError(new Error('The request handler timed out.')), 60_000);

            const req = this.createRequest({
                body,
            });

            const res = new RPCServerResponse((data) => {
                clearTimeout(timeout);

                resolve(data);
            });

            try {
                this.router.dispatch(req, res);
            } catch (e) {
                handleError(e);
            }
        });
    }

    private createRequest(data: Partial<RPCServerRequestInterface>) : RPCServerRequestInterface {
        return {
            body: {},
            path: '', // todo: fill form message queue message
            method: '', // todo: fill form message queue message
            ...data,
        };
    }

    // --------------------------------------------------

    get(path: string, handler: RPCServerHandler) : void {
        this.router.get(path, handler);
    }

    post(path: string, handler: RPCServerHandler) : void {
        this.router.post(path, handler);
    }

    delete(path: string, handler: RPCServerHandler) : void {
        this.router.delete(path, handler);
    }

    use(router: RPCServerRouter) {
        this.router.use(router);
    }

    useMiddleware(middleware: RPCServerHandler) {
        this.router.useMiddleware(middleware);
    }
}
