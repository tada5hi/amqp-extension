[![npm version](https://badge.fury.io/js/amqp-extension.svg)](https://badge.fury.io/js/amqp-extension)
[![codecov](https://codecov.io/gh/Tada5hi/amqp-extension/branch/master/graph/badge.svg?token=6YELWNP9HG)](https://codecov.io/gh/Tada5hi/amqp-extension)
[![Master Workflow](https://github.com/Tada5hi/amqp-extension/workflows/main/badge.svg)](https://github.com/Tada5hi/amqp-extension)

# AMQP Extension 🏰

This is a library on top of the famous [amqplib](https://www.npmjs.com/package/amqplib) library and defines a [message format](#message-types) for queue messages through a message broker across multiple standalone services.
All utility functions support the usage of multiple registered connections.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Publish](#publish)
  - [Consume](#consume)
- [Functions](#functions)
  - [setConfig](#setconfig)
  - [useConnection](#useconnection)
  - [publishMessage](#publishmessage)
  - [consumeQueue](#consumequeue)
- [Types](#types)
  - [Config](#config-types)
  - [Consume](#consume-types)
  - [Message](#message-types)
  - [Publish](#publish-types)



## Installation

```bash
npm install amqp-extension --save
```

## Usage

### Publish

To publish a queue message according the [Message Scheme](#message-types), use the `buildMessage` helper function
to build a message and the `publishMessage` function to submit it to the message broker.

```typescript
import {
    buildMessage,
    Message,
    useConnection,
    publishMessage,
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

const message: Message = buildMessage({
    type: 'resourceCreated',
    options: {
        routingKey: '<routing-key>'
    }
});

console.log(message);
// {id: 'xxxx-xxxx-xxxx-xxxx', type: 'resourceCreated', options: {routingKey: '<routing-key>'}, data: {}, metadata: {}}

(async () => {
    await publishMessage(message);
})();
```

### Consume

To consume a queue message use the `consumeMessage` function. As first argument it accepts a configuration object
and as second argument and object to specify an async callback function handler for a specific message `type`.

```typescript
import {
    buildMessage,
    ConsumeOptions,
    Message,
    MessageContext,
    publishMessage,
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
    routingKey: '<routing-key>'
}

(async () => {
    await consumeQueue(options, {
        resourceCreated: async (message: Message, messageContext: MessageContext) => {
            // do some async operation :)
            console.log(message);
            // {id: 'xxxx-xxxx-xxxx-xxxx', type: 'resourceCreated', data: {}, metadata: {}}
        }
    });
})();
```

### Multiple Connections

To define multiple concurrent connections just specify a different `alias` in the configuration object, so it does not
get overwritten.

```typescript
import {
    buildMessage,
    ConsumeOptions,
    Message,
    MessageContext,
    publishMessage,
    PublishOptions,
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

useConnection({
    alias: 'foo',
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

const consumeOptions: ConsumeOptions = {
    routingKey: '<routing-key>',
    alias: 'foo' // <--- use another connection :)
}

const publishOptions: PublishOptions = {
    alias: 'foo' // <--- use another connection :)
}

(async () => {
    await consumeQueue({/* handlers */}, consumeOptions);
    await publishMessage({/* message */}, publishOptions);
})();

```

## Functions

### setConfig

▸ `function` **setConfig**(`key?: string | Config`, `value?: Config`): `Config`

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

| Name | Description |
| :------ | :------ |



#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` or `Config` | Config object or alias of config. [more](#config-types) |
| `value` | `Config` | Config object. [more](#config-types) |

#### Returns

`Config`

The function returns the Config object.

### useConnection

▸ `function` **useConnection**(`key?: string | Config`): `Promise<Connection>`

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

| Name | Description |
| :------ | :------ |



#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `key` | `string` or `Config` | Config or alias of config. [more](#config-types) |

#### Returns

`Promise<Connection>`

The function returns the Connection object of the `amqplib`.

### publishMessage

▸ `function` **publishMessage**(`message: Message`, `options?: PublishOptions`): `Promise<void>`

Send the constructed queue message to the message broker.
As second parameter a registered config can be used by specifying the alias or provide the full config object.
#### Example
**`Simple`**

```typescript
import {
    buildMessage,
    publishMessage
} from "amqp-extension";

const message: Message = buildMessage({
    type: 'resourceCreated',
    options: {
        routingKey: '<routing-key>'
    }
});

console.log(message);
// {id: 'xxxx-xxxx-xxxx-xxxx', type: 'resourceCreated', options: {routingKey: '<routing-key>'}, data: {}, metadata: {}}

(async () => {
    await publishMessage(message);
})();
```

#### Type parameters

| Name | Description |
| :------ | :------ |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `message` | `Message` | Constructed message object. [more](#message-types)|
| `options` | `PublishOptions` | Publish options. [more](#publish-types) |

#### Returns

`Promise<void>`

The function does not return a value.

### consumeQueue

▸ `function` **consumeQueue**(`options: ConsumeOptions`, `cb: ConsumeHandlers`): `Promise<void>`

Send the constructed queue message to the message broker.
As second parameter a registered config can be used by specifying the alias or provide the full config object.
#### Example
**`Simple`**

```typescript
import {
    consumeQueue,
    ConsumeOptions,
    Message,
    MessageContext
} from "amqp-extension";

const options: ConsumeOptions = {
    routingKey: '<routing-key>'
}

(async () => {
    await consumeQueue(options, {
        '<type>': async (message: Message, messageContext: MessageContext) => {
            // do some async action :)
            console.log(message);
            // {id: 'xxxx-xxxx-xxxx-xxxx', type: 'resourceCreated', data: {}, metadata: {}}
        }
    });
})();

```

#### Type parameters

| Name | Description |
| :------ | :------ |



#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | `ConsumeOptions` | Consume options. [more](#consume-types)|
| `handlers` | `ConsumeHandlers` | Handlers object. [more](#consume-types) |

#### Returns

`Promise<void>`

The function does not return a value.

## Types

### Config Types

```typescript
import {Options} from "amqplib";
import {PublishOptions} from "amqp-extension";

export type ExchangeType = 'fanout' | 'direct' | 'topic' | 'match' | string;

export type Config = {
    alias?: string,
    connection: Options.Connect | string,
    exchange: {
        name: string,
        type: ExchangeType,
        options?: Options.AssertExchange
    },
    publish?: PublishOptions,
    consume?: ConsumeOptions
};
```

### Consume Types
```typescript
import {Options} from "amqplib";
import {Config, MessageContext, Message} from "amqp-extension";

export type ConsumeHandler = (message: Message, context: MessageContext) => Promise<void>;
export type ConsumeHandlers = Record<'$any' | string, ConsumeHandler>;

export type ConsumeOptions = {
    /**
     * Queue routing key(s).
     */
    routingKey?: string | string[],

    /**
     * Config key or object.
     */
    alias?: string | Config,
    /**
     * Queue name.
     *
     * Default: ''
     */
    name?: string,
    /**
     * Amqplib consume options.
     *
     * Default: {}
     */
    options?: Options.Consume
}
```

### Message Types

```typescript
import {Options} from "amqplib";

export interface MessageOptions {
    /**
     * Routing key for message broker.
     */
    routingKey?: string;
    /**
     * Override default publish options.
     */
    publish?: Options.Publish;
}

export type Message = {
    /**
     * Routing information for amqp library.
     * This property will be removed, before it is passed to the message queue.
     */
    options?: MessageOptions;

    /**
     *
     * Default: <generated uuid>
     */
    id: string;

    /**
     * Event- or Command-name.
     */
    type: string;

    /**
     * Metadata object to provide details for the message broker.
     *
     * Default: {}
     */
    metadata: Record<string, any>;

    /**
     * The message data.
     *
     * Default: {}
     */
    data: Record<string, any>;
};
```

### Publish Types

```typescript
import {Options} from "amqplib";
import {Config} from "amqp-extension";

export type PublishOptions = {
    /**
     * Config key or object.
     */
    alias?: string | Config;

    /**
     * Amqplib publish options.
     */
    options?: Options.Publish;
}

```
