# AMQP Extension 🏰

[![npm version](https://badge.fury.io/js/amqp-extension.svg)](https://badge.fury.io/js/amqp-extension)
[![codecov](https://codecov.io/gh/Tada5hi/amqp-extension/branch/master/graph/badge.svg?token=6YELWNP9HG)](https://codecov.io/gh/Tada5hi/amqp-extension)
[![Master Workflow](https://github.com/tada5hi/amqp-extension/actions/workflows/main.yml/badge.svg)](https://github.com/Tada5hi/amqp-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/amqp-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/amqp-extension?targetFile=package.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

This is a library on top of the [amqplib](https://www.npmjs.com/package/amqplib) library and is meant to simplify the process of consuming & publishing queue messages.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Publish](#publish-to-queue)
  - [Consume](#consume-queue)
- [Functions](#functions)
  - [setConfig](#setconfig)
  - [useConnection](#useconnection)
  - [publish](#publish)
  - [consume](#consume)
- [Types](#types)
  - [Config](#config-types)
- [License](#license)


## Installation

```bash
npm install amqp-extension --save
```

## Usage

### Publish to Queue

The `publish` method allows you to send messages quickly.
Existing options can be added or overwritten

```typescript
import { Client } from "amqp-extension";

const client = new Client({
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

(async () => {
    await client.publish({
        content: {
            type: 'resourceCreated',
            name: 'foo'
        }
    });
})();
```

### Consume Queue

To consume a queue use the `consume` function. As first argument it accepts a configuration object
and as second argument and object to specify an async callback function handler for a specific message `type`.

```typescript
import {
    Client,
    ConsumeMessage,
    ConsumeOptions,
} from "amqp-extension";

const client = new Client({
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

const options: ConsumeOptions = {
    exchange: {
        routingKey: '<routing-key>'
    }
}

(async () => {
    await client.consume(options, {
        resourceCreated: async (message: ConsumeMessage) => {
            const content = message.content.toString('utf-8');
            const payload = JSON.parse(content);
            console.log(payload);
            // { type: 'resourceCreated', name: 'foo' }
        }
    });
})();
```

## Functions

### publish

▸ `function` **publish**(`message: Message`, `options?: PublishOptions`): `Promise<void>`

Send the constructed queue message to the message broker.
As second parameter a registered config can be used by specifying the alias or provide the full config object.
#### Example
**`Simple`**

```typescript
import { Client } from "amqp-extension";

const client = new Client({
    // ...
});

(async () => {
    await client.publish({
        content: {
            type: 'resourceCreated'
        }
    });
})();
```

#### Type parameters

| Name  | Description |
|:------|:------------|

#### Parameters

| Name      | Type             | Description                 |
|:----------|:-----------------|:----------------------------|
| `message` | `Message`        | Constructed message object. |
| `options` | `PublishOptions` | Publish options.            |

#### Returns

`Promise<void>`

The function does not return a value.

### consume

▸ `function` **consume**(`options: ConsumeOptions`, `cb: ConsumeHandlers`): `Promise<void>`

Send the constructed queue message to the message broker.
As second parameter a registered config can be used by specifying the alias or provide the full config object.
#### Example
**`Simple`**

```typescript
import {
    Client,
    ConsumeOptions,
    ConsumeMessage,
} from "amqp-extension";

const client = new Client({
    // ...
});

const options: ConsumeOptions = {
    routingKey: '<routing-key>'
}

(async () => {
    await client.consume(options, {
        '<type>': async (message: ConsumeMessage) => {
            // do some async action :)
        }
    });
})();

```

#### Type parameters

| Name   | Description |
|:-------|:------------|



#### Parameters

| Name       | Type              | Description        |
|:-----------|:------------------|:-------------------|
| `options`  | `ConsumeOptions`  | Consume options. ) |
| `handlers` | `ConsumeHandlers` | Handlers object.   |

#### Returns

`Promise<void>`

The function does not return a value.

## Types

### Config Types

```typescript
import { Options } from 'amqplib';
import { ExchangeOptions } from '../exchange';
import { ConsumeOptions, PublishOptions } from '../type';

export type Config = {
    connection: Options.Connect | string,
    exchange: ExchangeOptions,
    publish: PublishOptions,
    consume: ConsumeOptions
};

export type ConfigInput = Partial<Exclude<Config, 'connection'>> &
    Pick<Config, 'connection'>;
```

## License

Made with 💚

Published under [MIT License](./LICENSE).
