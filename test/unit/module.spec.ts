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
        const connectionOptions = read('MQ_CONNECTION_STRING', '');
        client = new Client({
            connectionOptions
        })
    })

    afterAll(async () => {
        await client.connection.close();

        // @ts-ignore
        client = undefined;
    })

    it('should publish message', async () => {
        const published = await client.publish('foo', 'foo')

        expect(published).toBeTruthy();
    });

    it('should publish and subscribe to topic exchange',  (done) => {
        const topicExchange = client.of({
            type: 'topic',
            name: 'test'
        });

        Promise.resolve()
            .then(() => {
                return topicExchange.consume('foo', {
                    $any: (message) => {
                        const content = message.content.toString();
                        expect(content).toEqual('fooBar')
                        done();
                    }
                });
            }).then(() => {
            topicExchange.publish('foo', 'fooBar');
            })
    });

    it('should publish and subscribe to direct exchange',  (done) => {
        Promise.resolve()
            .then(() => {
                return client.consume('logs', {
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
                return client.publish('logs', 'fooBar')
              })
    })
})
