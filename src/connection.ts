import RabbitMQ, {Connection} from 'amqplib';

let connection : Connection | undefined;

export async function useConnection(connectionStr: string) {
    if(typeof connection !== 'undefined') {
        return connection;
    }

    connection = await createConnection(connectionStr);

    return connection;
}

export async function createConnection(connectionStr: string) {
    return await RabbitMQ.connect(connectionStr);
}


