[![npm version](https://badge.fury.io/js/amqp-extension.svg)](https://badge.fury.io/js/amqp-extension)
[![codecov](https://codecov.io/gh/Tada5hi/amqp-extension/branch/master/graph/badge.svg?token=6YELWNP9HG)](https://codecov.io/gh/Tada5hi/amqp-extension)
[![Master Workflow](https://github.com/Tada5hi/amqp-extension/workflows/main/badge.svg)](https://github.com/Tada5hi/amqp-extension)

# AMQP Extension 🏰

This is a library on top of the famous `amqplib` library and defines a message format for queue message through a message broker across multiple standalone services.

**Table of Contents**

- [Installation](#installation)
- [Usage](#usage)
  - [Publish](#publish)
  - [Consume](#consume)
- [Functions](#functions)
  - [useConnection](#useconnection)
  - [publishMessage](#publishmessage)
  - [consumeQueue](#consumequeue)
- [Types](#types)
  - [Config](#config-types)
  - [Consume](#consume-types)
  - [ConsumeMessage](#consume-message-types)
  - [Message](#message-types)



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
    useConnection
} from "amqp-extension";

// This will set the default connection :)
useConnection({
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
    ConsumeQueueOptions,
    Message,
    MessageContext,
    useConnection,
    publishMessage
} from "amqp-extension";

// This will set the default connection :)
useConnection({
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});

const options: ConsumeQueueOptions = {
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

## Functions

### useConnection

▸ `function` **useConnection**(`key?: string | Config`): `Promise<Connection>`

Either register a connection as `default` alias or specify an `alias` as config property.
If you have registered a connection you can receive the connection by specifying no arguments or provide an alias name if specified.
#### Example
**`Simple`**

```typescript
import {useConnection} from "amqp-extension";

(async () => {

})();
const connection = useConnection({
    alias: '<alias>',
    connection: 'amqp://<user>:<password>@<host>',
    exchange: {
        name: '<name>',
        type: 'topic'
    }
});
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

▸ `function` **publishMessage**(`message: Message`, `key?: string | Config`): `Promise<void>`

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
| `message` | `Message` | Constructed message object.|
| `key` | `string` or `Config` | Config or alias of config. [more](#config-types) |

#### Returns

`Promise<void>`

The function does not return a value.

### consumeQueue

▸ `function` **consumeQueue**(`options: ConsumeQueueOptions`, `cb: ConsumeQueueCallback`): `Promise<void>`

Send the constructed queue message to the message broker.
As second parameter a registered config can be used by specifying the alias or provide the full config object.
#### Example
**`Simple`**

```typescript
import {
    consumeQueue,
    ConsumeQueueOptions,
    ConsumeMessageContext,
    Message,
    MessageContext,
    publishMessage
} from "amqp-extension";

const options: ConsumeQueueOptions = {
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
| `options` | `ConsumeQueueOptions` | Consume queue options.|
| `handlers` | `ConsumeMessageHandlers` | Handlers object. |

#### Returns

`Promise<void>`

The function does not return a value.

## Types

### Config Types

```typescript
import {Options} from "amqplib";

export type ExchangeType = 'fanout' | 'direct' | 'topic' | 'match' | string;

export type Config = {
    alias?: string,
    connection: Options.Connect | string,
    exchange: {
        name: string,
        type: ExchangeType,
        options?: Options.AssertExchange
    },
    publish?: {
        options?: Options.Publish
    },
    consume?: {
        /**
         * Default: false
         */
        requeueOnFailure?: boolean
    }
};
```

### Consume Types


```typescript
import {Options} from "amqplib";
import {
    Config,
    MessageContext,
    Message
} from "amqp-extension";

export type ConsumeMessageHandler = (message: Message, context: MessageContext) => Promise<void>;
export type ConsumeMessageHandlers = Record<'$any' | string, ConsumeMessageHandler>;

export type ConsumeQueueOptions = {
    /**
     * Queue routing key(s).
     */
    routingKey?: string | string[],

    key?: string | Config,
    /**
     * Queue name
     *
     * Default: ''
     */
    name?: string,
    /**
     * Queue options
     *
     * Default: {
     *     durable: false,
     *     autoDelete: true
     * }
     */
    options?: Options.AssertQueue
}
```

### Consume Message Types

```typescript
import {Channel, Connection, MessageFields, MessageProperties} from "amqplib";

export type ConsumeMessageContext = {
    channel: Channel,
    connection: Connection,
    messageFields?: MessageFields,
    messageProperties?: MessageProperties
};
```

### Message Types

```typescript
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
