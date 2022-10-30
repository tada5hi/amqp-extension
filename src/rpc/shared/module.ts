import { Channel, Connection } from 'amqplib';

export class RPC {
    protected connection : Connection;

    protected channel : Channel | undefined;

    protected queueName : string | undefined;

    protected consumerTag : string | undefined;

    private channelConnectPromise : Promise<Channel> | undefined;

    private channelDisconnectPromise : Promise<void> | undefined;

    constructor(connection: Connection) {
        this.connection = connection;
    }

    async connect() : Promise<Channel> {
        if (typeof this.channelConnectPromise !== 'undefined') {
            return this.channelConnectPromise;
        }

        if (typeof this.channel !== 'undefined') {
            return this.channel;
        }

        this.channelConnectPromise = new Promise((resolve, reject) => {
            this.connection.createChannel()
                .then((channel) => resolve(channel))
                .catch((e) => reject(e));
        });

        this.channel = await this.channelConnectPromise;
        this.channelConnectPromise = undefined;

        return this.channel;
    }

    async disconnect() : Promise<void> {
        if (typeof this.channel === 'undefined') {
            return Promise.resolve();
        }

        if (typeof this.channelDisconnectPromise !== 'undefined') {
            return this.channelDisconnectPromise;
        }

        this.channelDisconnectPromise = new Promise((resolve, reject) => {
            this.channel.close()
                .then(() => resolve())
                .catch((e) => reject(e));
        });

        await this.channelDisconnectPromise;

        this.channelDisconnectPromise = undefined;

        return Promise.resolve();
    }
}
