/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */


import {read} from "envix";
import {Client} from "../../src";

describe('src/module', () => {
    let client: Client;

    beforeAll(async () => {
        const connection = read('MQ_CONNECTION_STRING', '');
        client = new Client({
            connection
        })
    })

    afterAll(async () => {
        const connection = await client.useConnection();
        await connection.close();

        // @ts-ignore
        client = undefined;
    })

    it('should establish connection', async () => {
        const connection = await client.useConnection();
        expect(connection).toBeDefined();
    });

    it('should publish message', async () => {
        const published = await client.publish({
            content: 'foo',
            exchange: {
                type: 'topic',
                name: 'test',
                routingKey: 'foo'
            }
        });

        expect(published).toBeTruthy();
    });

    it('should publish and subscribe (topic)',  (done) => {
        Promise.resolve()
            .then(() => {
                return client.consume({
                    exchange: {
                        type: 'topic',
                        name: 'test',
                        routingKey: 'foo'
                    }
                }, {
                    $any: (message) => {
                        const content = message.content.toString();
                        expect(content).toEqual('fooBar')
                        done();
                    }
                });
            }).then(() => {
                client.publish({
                    content: 'fooBar',
                    exchange: {
                        type: 'topic',
                        name: 'test',
                        routingKey: 'foo'
                    }
                });
            })
    });

    it('should publish and subscribe (direct)',  (done) => {
        Promise.resolve()
            .then(() => {
                return client.consume({
                    exchange: {
                        type: 'direct',
                        name: '',
                        routingKey: 'logs'
                    },
                    noAck: false
                }, {
                    $any: (message, channel) => {
                        const content = message.content.toString();
                        expect(content).toEqual('fooBar');
                        channel.ack(message, true);
                        setTimeout(() => {
                            done();
                        }, 100);
                    }
                });
            }).then(() => {
                return client.publish({
                    content: 'fooBar',
                    exchange: {
                        type: 'direct',
                        name: '',
                        routingKey: 'logs'
                    }
                })
              })
    })
})
