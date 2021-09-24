import RabbitMQ, {Connection} from "amqplib";
import {ConnectionAlias} from "./type";

let connections: Map<ConnectionAlias, Connection> = new Map<string, Connection>();

export function clearConnections() : void {
    connections.clear();
}

export function getConnections() : Map<ConnectionAlias, Connection> {
    return connections;
}

/* istanbul ignore next */
export async function useConnection(alias: ConnectionAlias, config: string) : Promise<Connection> {
    if(connections.has(alias)) {
        return connections.get(alias);
    }

    const connection = await createConnection(config);

    connections.set(alias, connection);

    return connection;
}

/* istanbul ignore next */
export async function createConnection(config: string) {
    return await RabbitMQ.connect(config);
}
