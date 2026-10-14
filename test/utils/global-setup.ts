/*
 * Copyright (c) 2024.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { GenericContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
    export interface ProvidedContext {
        MQ_CONNECTION_STRING: string
    }
}

export default async function setup(project: TestProject) {
    const container = await new GenericContainer('rabbitmq:3-management')
        .withExposedPorts(5672)
        .withEnvironment({
            RABBITMQ_DEFAULT_USER: 'root',
            RABBITMQ_DEFAULT_PASS: 'start123',
        })
        .start();

    project.provide(
        'MQ_CONNECTION_STRING',
        `amqp://root:start123@${container.getHost()}:${container.getFirstMappedPort()}`,
    );

    return async () => {
        await container.stop();
    };
}
