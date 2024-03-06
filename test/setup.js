/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

const { GenericContainer } = require('testcontainers');
const { write } = require('envix');

module.exports = async () => {
    const containerConfig = new GenericContainer('rabbitmq:3-management')
        .withExposedPorts(5672)
        .withEnvironment({
            RABBITMQ_DEFAULT_USER: 'root',
            RABBITMQ_DEFAULT_PASS: 'start123',
        });

    const container = await containerConfig.start();
    const connectionString = `amqp://root:start123@${container.getHost()}:${container.getFirstMappedPort()}`;

    write('MQ_CONNECTION_STRING', connectionString);

    // eslint-disable-next-line no-undef
    globalThis.MQ_CONTAINER = container;
};
