import RabbitMQ, {Connection, Options} from "amqplib";
import {Config, getConfig} from "../config";

const connectionMap: Map<string, Connection> = new Map<string, Connection>();

export function clearConnections() : void {
    connectionMap.clear();
}

export function getConnections() : Map<string, Connection> {
    return connectionMap;
}

/* istanbul ignore next */
export async function useConnection(
    key: string | Config,
) : Promise<Connection> {
    const config : Config = getConfig(key);

    if(connectionMap.has(config.alias)) {
        return connectionMap.get(config.alias);
    }

    const connection = await createConnection(config.connection);

    connectionMap.set(config.alias, connection);

    return connection;
}

/* istanbul ignore next */
export async function createConnection(config: Options.Connect | string) {
    return await RabbitMQ.connect(config);
}
