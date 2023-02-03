# AMQP Extension 🏰

[![npm version](https://badge.fury.io/js/amqp-extension.svg)](https://badge.fury.io/js/amqp-extension)
[![codecov](https://codecov.io/gh/Tada5hi/amqp-extension/branch/master/graph/badge.svg?token=6YELWNP9HG)](https://codecov.io/gh/Tada5hi/amqp-extension)
[![Master Workflow](https://github.com/Tada5hi/amqp-extension/workflows/main/badge.svg)](https://github.com/Tada5hi/amqp-extension)
[![Known Vulnerabilities](https://snyk.io/test/github/Tada5hi/amqp-extension/badge.svg?targetFile=package.json)](https://snyk.io/test/github/Tada5hi/amqp-extension?targetFile=package.json)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

This is a library on top of the famous [amqplib](https://www.npmjs.com/package/amqplib) library and defines a [message format](#message-types) for queue messages through a message broker across multiple standalone services.
All utility functions support the usage of multiple registered connections.

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

The `publish` function allows you to send messages quickly.
Existing options can be added or overwritten

```typescript
import {
    useConnection,
    publish,
    setConfig
} from "amqp-extension";

// This will set the default connection :)
setConfig({
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

(async () => {
    await publish({
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
    consume,
    ConsumeMessage,
    ConsumeOptions,
    setConfig
} from "amqp-extension";

// This will set the default connection :)
setConfig({
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
    await consume(options, {
        resourceCreated: async (message: ConsumeMessage) => {
            const content = message.content.toString('utf-8');
            const payload = JSON.parse(content);
            console.log(payload);
            // { type: 'resourceCreated', name: 'foo' }
        }
    });
})();
```

### Multiple Connections

To define multiple concurrent connections just specify a different `alias` in the configuration object, so it does not
get overwritten.

```typescript
import {
    ConsumeOptions,
    publish,
    PublishOptionsExtended,
    setConfig
} from "amqp-extension";

// This will set the default connection :)
setConfig({
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

setConfig({
    alias: 'foo',
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});
(async () => {
    await consume(
        {
            routingKey: '<routing-key>',
            alias: 'foo' // <--- use another connection :)
        },
        {
            // ... handlers
        }
    );

    await publish({
        routingKey: '<routing-key>',
        alias: 'foo', // <--- use another connection :)
        content: {
            foo: 'bar'
        }
    });
})();

```

## Functions

### setConfig

▸ `function` **setConfig**(`key?: string | ConfigInput`, `value?: ConfigInput`): `Config`

Register a connection as `default` alias or specify an `<alias>` as config property.

#### Example
**`Simple`**

Define the default connection config.

```typescript
import {setConfig, useConnection} from "amqp-extension";

(async () => {
    setConfig({
        connection: 'amqp://<user>:<password>@<host>',
        exchange: {
            name: '<name>',
            type: 'topic'
        }
    });

    const connection = await useConnection();
})();

```

Define a non default connection.

```typescript
import { setConfig, useConnection } from "amqp-extension";

(async () => {
    setConfig({
        alias: '<alias>',
        connection: 'amqp://<user>:<password>@<host>',
        exchange: {
            name: '<name>',
            type: 'topic'
        }
    });

    setConfig('foo', {
        connection: 'amqp://<user>:<password>@<host>',
        exchange: {
            name: '<name>',
            type: 'topic'
        }
    });

    const connection = await useConnection('<alias>');
    const fooConnection = await useConnection('foo');
})();

```


#### Type parameters

| Name  | Description |
|:------|:------------|



#### Parameters

| Name    | Type                      | Description                                                |
|:--------|:--------------------------|:-----------------------------------------------------------|
| `key`   | `string` or `ConfigInput` | Config object or alias of config. [more](#config-types)    |
| `value` | `Config`                  | Config object. [more](#config-types)                       |

#### Returns

`Config`

The function returns the Config object.

### useConnection

▸ `function` **useConnection**(`key?: string | ConfigInput`): `Promise<Connection>`

Either register a connection as `default` alias or specify an `alias` as config property.
If you have registered a connection you can receive the connection by specifying no arguments or provide an alias name if specified.


#### Example
**`Simple`**

Receive underlying driver connection.

```typescript
import {useConnection} from "amqp-extension";

(async () => {
    const connection = await useConnection();
})();

```

**`Advanced`**

Use a none `default` connection.

```typescript
import {setConfig, useConnection} from "amqp-extension";

(async () => {
    setConfig({
        alias: '<alias>',
        connection: 'amqp://<user>:<password>@<host>',
        exchange: {
            name: '<name>',
            type: 'topic'
        }
    });

    const connection = await useConnection('<alias>');
})();

```

#### Type parameters

| Name  | Description   |
|:------|:--------------|



#### Parameters

| Name  | Type                 | Description                                      |
|:------|:---------------------|:-------------------------------------------------|
| `key` | `string` or `Config` | Config or alias of config. [more](#config-types) |

#### Returns

`Promise<Connection>`

The function returns the Connection object of the `amqplib`.

### publish

▸ `function` **publish**(`message: Message`, `options?: PublishOptions`): `Promise<void>`

Send the constructed queue message to the message broker.
As second parameter a registered config can be used by specifying the alias or provide the full config object.
#### Example
**`Simple`**

```typescript
import {
    publish
} from "amqp-extension";

(async () => {
    await publish({
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
    consume,
    ConsumeOptions,
    ConsumeMessage,
} from "amqp-extension";

const options: ConsumeOptions = {
    routingKey: '<routing-key>'
}

(async () => {
    await consume(options, {
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
    alias: string,
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
