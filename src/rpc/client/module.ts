import {
    Channel, Connection, ConsumeMessage, Options,
} from 'amqplib';
import { RPCState } from '../constants';
import { RPC } from '../shared';
import { RPCResponse } from '../type';
import { bufferToData } from '../utils';
import { RPCClientRequest, RPCClientRequestReject, RPCClientRequestResolve } from './type';

export class RPCClient extends RPC {
    protected requests: Record<string, RPCClientRequest<any>> = {};

    protected requestId : number;

    protected timeout : number;

    constructor(connection: Connection) {
        super(connection);

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

        try {
            const response = bufferToData<RPCResponse<any>>(data.content);

            if (response.state === RPCState.SUCCESS) {
                request.resolve(response.data);
            } else {
                const error = new Error(response.data.message);
                request.reject(error);
            }
        } catch (e) {
            if (e instanceof Error) {
                request.reject(e);
            }
        }
    }

    async request<T>(data: T) {
        const correlationId = `${this.requestId++}`;

        const options : Options.Publish = {
            replyTo: this.queueName,
            correlationId,
        };

        let resolve : RPCClientRequestResolve<T>;
        let reject : RPCClientRequestReject;

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

        request.reject(new Error('The request timed out...'));
    }
}
