/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Channel, Connection, ConsumeMessage,
} from 'amqplib';
import { publishMessage } from '../../publish';
import { RPCHeader } from '../constants';
import { RPC } from '../shared';
import { RPCClientRequest, RPCClientRequestPromiseReject, RPCClientRequestPromiseResolve } from './type';

export class RPCClient extends RPC {
    protected requests: Record<string, RPCClientRequest<any>> = {};

    protected requestId : number;

    protected timeout : number;

    constructor(connection: Connection, queueName: string) {
        super(connection);

        this.queueName = queueName;

        this.requestId = 0;
        this.timeout = 60_000;
    }

    async connect() : Promise<Channel> {
        const channel = await super.connect();

        const { queue } = await channel.assertQueue('', {
            durable: false,
            autoDelete: true,
        });

        this.queueName = queue;

        const { consumerTag } = await this.channel.consume(
            queue,
            (data) => this.handleResponse(data),
        );

        this.consumerTag = consumerTag;

        return channel;
    }

    async disconnect() : Promise<void> {
        if (typeof this.channel === 'undefined') {
            return;
        }

        await this.channel.cancel(this.consumerTag);

        if (this.queueName) {
            await this.channel.deleteQueue(this.queueName);
            this.queueName = undefined;
        }

        const keys = Object.keys(this.requests);
        for (let i = 0; i < keys.length; i++) {
            this.cancelRequest(keys[i]);
        }

        await super.disconnect();
    }

    private async handleResponse(data: ConsumeMessage | null) {
        if (typeof data === 'undefined') {
            return;
        }

        this.channel.ack(data);

        if (!Object.prototype.hasOwnProperty.call(this.requests, data.properties.correlationId)) {
            return;
        }

        const request = { ...this.requests[data.properties.correlationId] };

        delete this.requests[data.properties.correlationId];

        clearTimeout(request.timeout);

        const { [RPCHeader.STATUS_CODE]: statusCode } = data.properties.headers;

        // todo: format content, depending on content-type.

        if (statusCode >= 400 && statusCode <= 599) {
            request.reject({
                headers: data.properties.headers,
                data: data.content,
                statusCode,
            });
        } else {
            request.resolve({
                headers: data.properties.headers,
                data: data.content,
                statusCode,
            });
        }
    }

    async request<T>(data: T) {
        const correlationId = `${this.requestId++}`;

        const options : Options.Publish = {
            replyTo: this.queueName,
            correlationId,
        };

        let resolve : RPCClientRequestPromiseResolve<T>;
        let reject : RPCClientRequestPromiseReject<any>;

        const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
        });

        this.requests[correlationId] = {
            resolve,
            reject,
            timeout: setTimeout(() => this.cancelRequest(correlationId), this.timeout),
        };

        // todo: send message to queue

        return promise;
    }

    protected cancelRequest(id: string) {
        if (!Object.prototype.hasOwnProperty.call(this.requests, id)) {
            return;
        }

        const request = { ...this.requests[id] };

        clearTimeout(request.timeout);

        delete this.requests[id];

        request.reject({
            data: new Error('The request timed out...'),
            statusCode: 500,
            headers: {},
        });
    }
}
