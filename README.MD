# AMQP Extension 🏰

[![npm version](https://badge.fury.io/js/amqp-extension.svg)](https://badge.fury.io/js/amqp-extension)
[![codecov](https://codecov.io/gh/Tada5hi/amqp-extension/branch/master/graph/badge.svg?token=6YELWNP9HG)](https://codecov.io/gh/Tada5hi/amqp-extension)
[![Master Workflow](https://github.com/tada5hi/amqp-extension/actions/workflows/main.yml/badge.svg)](https://github.com/Tada5hi/amqp-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/amqp-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/amqp-extension?targetFile=package.json)

This is a library on top of the [amqplib](https://www.npmjs.com/package/amqplib) library and is meant to simplify the process of consuming & publishing queue messages.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Publish](#publish)
  - [Consume](#consume)
- [License](#license)


## Installation

```bash
npm install amqp-extension --save
```

The package is ESM-only and requires Node.js `>=22`.

## Usage

### Publish

The `publish` method allows you to send messages quickly.

```typescript
import { Client } from "amqp-extension";

const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

(async () => {
    await client.publish('<routing-key>', {
        foo: 'bar'
    });
})();
```

### Consume

To consume a queue use the `consume` function.
```typescript
import {
    Client,
    ConsumeMessage,
    ConsumeOptions,
} from "amqp-extension";

const client = new Client({
    connectionOptions: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

(async () => {
    await client.consume('<routing-key>', {
        $any: async (message: ConsumeMessage) => {
            const content = message.content.toString('utf-8');
            const payload = JSON.parse(content);
            console.log(payload);
            // { type: 'resourceCreated', name: 'foo' }
        }
    });
})();
```

## License

Made with 💚

Published under [MIT License](./LICENSE).
