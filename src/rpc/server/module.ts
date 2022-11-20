/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Connection, ConsumeMessage, Message, Options,
} from 'amqplib';
import { Router, setRequestHeader } from 'routup';
import { RPCHeader } from '../constants';
import { RPC } from '../shared';
import { RPCServerRequest } from './request';
import { RPCServerResponse } from './response';
import { useResponseBody } from './utils/response';

export class RPCServer extends RPC {
    protected router : Router;

    // --------------------------------------------------

    constructor(connection: Connection, router: Router) {
        super(connection);

        this.router = router;
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
            useResponseBody(result),
            {
                ...options,
                headers: {
                    ...result.getHeaders(),
                    [RPCHeader.STATUS_CODE]: result.statusCode,
                    [RPCHeader.STATUS_MESSAGE]: result.statusMessage,
                },
            },
        );
    }

    // --------------------------------------------------

    private async dispatchMessage(message: ConsumeMessage) : Promise<RPCServerResponse> {
        const req = this.createServerRequest(message);
        const res = new RPCServerResponse();

        await this.router.dispatchAsync(req, res);

        return res;
    }

    // --------------------------------------------------

    private createServerRequest(message: Message) {
        const request = new RPCServerRequest({
            headers: message.properties.headers,
        });

        if (message.properties.contentType) {
            setRequestHeader(request, RPCHeader.CONTENT_TYPE, message.properties.contentType);
        }

        if (message.properties.contentEncoding) {
            setRequestHeader(request, RPCHeader.CONTENT_ENCODING, message.properties.contentEncoding);
        }

        const contentEncoding = request.headers[RPCHeader.CONTENT_ENCODING] || message.properties.contentEncoding;
        request.push(message.content, contentEncoding);

        return request;
    }
}
