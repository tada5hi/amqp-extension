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
            connection,
            exchange: {
                name: 'test',
                type: 'topic',
            },
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
                routingKey: 'foo'
            }
        });

        expect(published).toBeTruthy();
    });

    it('should publish and subscribe',  (done) => {
        Promise.resolve()
            .then(() => {
                return client.consume({
                    exchange: {
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
                        routingKey: 'foo'
                    }
                });
            })
    })
})
