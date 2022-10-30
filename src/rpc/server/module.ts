import { Connection, ConsumeMessage, Options } from 'amqplib';
import { RPC } from '../shared';
import { RPCServerRouter } from './router';
import { RPCServerHandler } from './type';

export class RPCServer extends RPC {
    protected router : RPCServerRouter;

    constructor(connection: Connection) {
        super(connection);

        this.router = new RPCServerRouter();
    }

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

        try {
            const result = await this.dispatchMessage(data);

            this.channel.sendToQueue(
                replyTo,
                result,
                options,
            );
        } catch (e) {
            this.channel.sendToQueue(
                replyTo,
                null,
                options,
            );
        }
    }

    private async dispatchMessage(data: ConsumeMessage) : Promise<Buffer> {
        const content = Buffer.from(data.content).toString('utf-8');

        // find handler for message see: express :)
    }

    get(path: string, handler: RPCServerHandler) : void {
        this.router.get(path, handler);
    }

    post(path: string, handler: RPCServerHandler) : void {
        this.router.post(path, handler);
    }

    delete(path: string, handler: RPCServerHandler) : void {
        this.router.delete(path, handler);
    }

    use(path: string, router: RPCServerRouter) {
        this.router.use(path, router);
    }
}
