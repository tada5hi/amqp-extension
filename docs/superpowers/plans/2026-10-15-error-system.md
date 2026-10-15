# Error System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every error that leaves `Client.publish()`/`Client.consume()` is an `AmqpExtensionError` subclass built on `@ebec/core`, with a stable `code` and the original error as `cause`.

**Architecture:** New `src/errors/` holds the class tree. It follows the typeorm-extension layout (subclasses with static factories) on top of `BaseError`. A single internal `toError()` maps foreign errors (amqplib, amqp-connection-manager) onto the tree. `Client` throws factory errors directly and passes everything else through `toError()`.

**Tech Stack:** TypeScript 6 (ESM, `verbatimModuleSyntax`), `@ebec/core` ^1.3.2, Vitest 5 with a RabbitMQ testcontainer, tsdown.

**Spec:** `docs/superpowers/specs/2026-10-15-error-system-design.md`

## Global Constraints

- Dependency: `@ebec/core` `^1.3.2`, as a runtime `dependency` (not dev).
- Existing messages stay exactly as they are:
  - `The queue name can not be empty if the default exchange is selected.`
  - `A non default exchange requires a name.`
  - `The publish operation requires a destination.`
  - `The client is closed.`
  - `Channel closed`
- New messages:
  - `The publish operation timed out.`
  - `The message payload could not be serialized.`
- Codes must be the string values of the `ErrorCode` enum:
  - `QUEUE_NAME_EMPTY`
  - `EXCHANGE_NAME_MISSING`
  - `DESTINATION_MISSING`
  - `CLIENT_CLOSED`
  - `CHANNEL_CLOSED`
  - `PUBLISH_TIMEOUT`
  - `BROKER_REJECTED`
  - `SERIALIZATION_FAILED`
- `toError` (`src/errors/utils.ts`) is internal. It is **not** exported from `src/errors/index.ts`.
- New files:
  - start with the copyright header (year 2026)
  - use 4-space indentation
  - import without file extensions
  - use `import type` for types
  - put exported types in `types.ts`
- Commits: Conventional Commits, with **no** AI-attribution trailer.
- After each task, run `npm run lint` and `npx tsc --noEmit` in addition to the tests.

**Test matcher note:** the tests use `toMatchObject({ constructor: X, ... })` to check the class and the fields at once. If Vitest does not match `constructor` this way (it is a prototype property), split each into `toBeInstanceOf(X)` plus `toMatchObject({...})` without `constructor`.

**Change from the spec:** `BrokerError`'s constructor takes `(input: ErrorInput, reply: BrokerReply)` instead of only `ErrorInput`, so `replyCode` can be `readonly`. `BrokerReply` lives in `src/errors/types.ts`.

## Review Focus

1. A Node system error with a string `code` (`ECONNREFUSED`) must become the base `AmqpExtensionError`, not `BrokerError`. Only a numeric code counts as an AMQP reply. This is pinned in Task 1.
2. Publishing `null`, `0` or `false` still works: `JSON.stringify` gives `'null'`, `'0'` and `'false'`, which are not serialization failures. Pinned in Task 2.
3. A `BigInt` or circular payload rejects with `SerializationError`, with the `TypeError` as `cause`, and is never a raw `TypeError`. Pinned in Task 2.
4. `toError` must not wrap twice: an `AmqpExtensionError` input comes back as the same object, so `TopologyError` keeps its class through the catch in `consume`. Pinned in Tasks 1 and 2.
5. `error.name` is the subclass name (`TopologyError`), and `instanceof Error` and `instanceof BaseError` both hold. Pinned in Task 1.

---

### Task 1: Error classes and `toError`

**Files:**
- Modify: `package.json` / `package-lock.json` (with `npm install @ebec/core@^1.3.2`)
- Create: `src/errors/base.ts`, `src/errors/constants.ts`, `src/errors/types.ts`, `src/errors/topology.ts`, `src/errors/client.ts`, `src/errors/broker.ts`, `src/errors/serialization.ts`, `src/errors/utils.ts`, `src/errors/index.ts`
- Modify: `src/index.ts`
- Test: `test/unit/errors.spec.ts` (new)

**Interfaces:**
- Produces:
  - `AmqpExtensionError` (extends `BaseError`)
  - `TopologyError.queueNameEmpty() / exchangeNameMissing() / destinationMissing()`
  - `ClientError.closed() / channelClosed(cause?: unknown) / timeout(cause?: unknown)`
  - `BrokerError.fromAmqp(err: AmqpReplyError)` with `replyCode: number`, `classId?: number`, `methodId?: number`
  - `SerializationError.payload(cause?: unknown)`
  - `ErrorCode` enum
  - internal `toError(e: unknown): AmqpExtensionError` from `src/errors/utils`

- [ ] **Step 1: Install the dependency**

Run: `npm install @ebec/core@^1.3.2`
Expected: `package.json` `dependencies` now lists `"@ebec/core": "^1.3.2"`.

- [ ] **Step 2: Write the failing test** at `test/unit/errors.spec.ts`

```ts
/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BaseError } from '@ebec/core';
import {
    describe,
    expect,
    it,
} from 'vitest';
import {
    AmqpExtensionError,
    BrokerError,
    ClientError,
    ErrorCode,
    SerializationError,
    TopologyError,
} from '../../src';
import { toError } from '../../src/errors/utils';

describe('src/errors', () => {
    it('should build errors with code, message and class name', () => {
        const error = TopologyError.queueNameEmpty();

        expect(error).toBeInstanceOf(TopologyError);
        expect(error).toBeInstanceOf(AmqpExtensionError);
        expect(error).toBeInstanceOf(BaseError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe('TopologyError');
        expect(error.code).toBe(ErrorCode.QUEUE_NAME_EMPTY);
        expect(error.message).toBe('The queue name can not be empty if the default exchange is selected.');
        expect(error.toJSON()).toMatchObject({ name: 'TopologyError', code: 'QUEUE_NAME_EMPTY' });
    });

    it('should keep the existing messages', () => {
        expect(TopologyError.exchangeNameMissing()).toMatchObject({ code: 'EXCHANGE_NAME_MISSING', message: 'A non default exchange requires a name.' });
        expect(TopologyError.destinationMissing()).toMatchObject({ code: 'DESTINATION_MISSING', message: 'The publish operation requires a destination.' });
        expect(ClientError.closed()).toMatchObject({ code: 'CLIENT_CLOSED', message: 'The client is closed.' });
        expect(ClientError.channelClosed()).toMatchObject({ code: 'CHANNEL_CLOSED', message: 'Channel closed' });
        expect(ClientError.timeout()).toMatchObject({ code: 'PUBLISH_TIMEOUT', message: 'The publish operation timed out.' });
        expect(SerializationError.payload()).toMatchObject({ code: 'SERIALIZATION_FAILED', message: 'The message payload could not be serialized.' });
    });

    it('should lift the AMQP reply fields onto a BrokerError', () => {
        const cause = Object.assign(new Error('Operation failed: QueueDeclare; 406 (PRECONDITION-FAILED)'), { code: 406, classId: 50, methodId: 10 });
        const error = BrokerError.fromAmqp(cause);

        expect(error).toMatchObject({
            code: 'BROKER_REJECTED',
            message: cause.message,
            replyCode: 406,
            classId: 50,
            methodId: 10,
        });
        expect(error.cause).toBe(cause);
    });

    describe('toError', () => {
        it('should pass a library error through unchanged', () => {
            const error = ClientError.closed();
            expect(toError(error)).toBe(error);
        });

        it('should wrap an error with a numeric reply code as BrokerError', () => {
            const cause = Object.assign(new Error('403 (ACCESS-REFUSED)'), { code: 403 });
            expect(toError(cause)).toMatchObject({ constructor: BrokerError, replyCode: 403, cause });
        });

        it('should map the connection manager timeout and close errors', () => {
            const timeout = new Error('timeout');
            const closed = new Error('Channel closed');

            expect(toError(timeout)).toMatchObject({ constructor: ClientError, code: 'PUBLISH_TIMEOUT', cause: timeout });
            expect(toError(closed)).toMatchObject({ constructor: ClientError, code: 'CHANNEL_CLOSED', cause: closed });
        });

        it('should wrap anything else in the base class', () => {
            const system = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });

            expect(toError(system)).toMatchObject({ constructor: AmqpExtensionError, message: 'connect ECONNREFUSED', cause: system });
            expect(toError('x')).toMatchObject({ constructor: AmqpExtensionError, message: 'x', cause: 'x' });
        });
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest --config test/vitest.config.ts --run test/unit/errors.spec.ts`
Expected: FAIL. The imports from `../../src` (`AmqpExtensionError`, …) and `../../src/errors/utils` do not resolve.

- [ ] **Step 4: Write the implementation**

`src/errors/constants.ts`:
```ts
/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum ErrorCode {
    QUEUE_NAME_EMPTY = 'QUEUE_NAME_EMPTY',
    EXCHANGE_NAME_MISSING = 'EXCHANGE_NAME_MISSING',
    DESTINATION_MISSING = 'DESTINATION_MISSING',
    CLIENT_CLOSED = 'CLIENT_CLOSED',
    CHANNEL_CLOSED = 'CHANNEL_CLOSED',
    PUBLISH_TIMEOUT = 'PUBLISH_TIMEOUT',
    BROKER_REJECTED = 'BROKER_REJECTED',
    SERIALIZATION_FAILED = 'SERIALIZATION_FAILED',
}
```

`src/errors/types.ts`:
```ts
/* copyright header */

export type BrokerReply = {
    replyCode: number,
    classId?: number,
    methodId?: number,
};

/**
 * An amqplib error for a broker rejection (code = AMQP reply code).
 */
export type AmqpReplyError = Error & {
    code: number,
    classId?: number,
    methodId?: number,
};
```

`src/errors/base.ts`:
```ts
/* copyright header */

import { BaseError } from '@ebec/core';

/**
 * Root of every error thrown by amqp-extension.
 */
export class AmqpExtensionError extends BaseError {}
```

`src/errors/topology.ts`:
```ts
/* copyright header */

import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';

export class TopologyError extends AmqpExtensionError {
    static queueNameEmpty() {
        return new TopologyError({
            code: ErrorCode.QUEUE_NAME_EMPTY,
            message: 'The queue name can not be empty if the default exchange is selected.',
        });
    }

    static exchangeNameMissing() {
        return new TopologyError({
            code: ErrorCode.EXCHANGE_NAME_MISSING,
            message: 'A non default exchange requires a name.',
        });
    }

    static destinationMissing() {
        return new TopologyError({
            code: ErrorCode.DESTINATION_MISSING,
            message: 'The publish operation requires a destination.',
        });
    }
}
```

`src/errors/client.ts`:
```ts
/* copyright header */

import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';

export class ClientError extends AmqpExtensionError {
    static closed() {
        return new ClientError({ code: ErrorCode.CLIENT_CLOSED, message: 'The client is closed.' });
    }

    static channelClosed(cause?: unknown) {
        return new ClientError({ code: ErrorCode.CHANNEL_CLOSED, message: 'Channel closed', cause });
    }

    static timeout(cause?: unknown) {
        return new ClientError({ code: ErrorCode.PUBLISH_TIMEOUT, message: 'The publish operation timed out.', cause });
    }
}
```

`src/errors/broker.ts`:
```ts
/* copyright header */

import type { ErrorInput } from '@ebec/core';
import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';
import type { AmqpReplyError, BrokerReply } from './types';

/**
 * The broker rejected an operation, e.g. 406 PRECONDITION_FAILED or 403 ACCESS_REFUSED.
 */
export class BrokerError extends AmqpExtensionError {
    readonly replyCode: number;

    readonly classId?: number;

    readonly methodId?: number;

    constructor(input: ErrorInput, reply: BrokerReply) {
        super(input);

        this.replyCode = reply.replyCode;
        this.classId = reply.classId;
        this.methodId = reply.methodId;
    }

    static fromAmqp(err: AmqpReplyError) {
        return new BrokerError(
            { code: ErrorCode.BROKER_REJECTED, message: err.message, cause: err },
            { replyCode: err.code, classId: err.classId, methodId: err.methodId },
        );
    }
}
```

`src/errors/serialization.ts`:
```ts
/* copyright header */

import { AmqpExtensionError } from './base';
import { ErrorCode } from './constants';

export class SerializationError extends AmqpExtensionError {
    static payload(cause?: unknown) {
        return new SerializationError({
            code: ErrorCode.SERIALIZATION_FAILED,
            message: 'The message payload could not be serialized.',
            cause,
        });
    }
}
```

`src/errors/utils.ts` (internal):
```ts
/* copyright header */

import { AmqpExtensionError } from './base';
import { BrokerError } from './broker';
import { ClientError } from './client';
import type { AmqpReplyError } from './types';

/**
 * Map anything thrown below the Client (amqplib, amqp-connection-manager) onto the error tree.
 */
export function toError(e: unknown) : AmqpExtensionError {
    if (e instanceof AmqpExtensionError) {
        return e;
    }

    if (!(e instanceof Error)) {
        return new AmqpExtensionError({ message: String(e), cause: e });
    }

    if (typeof (e as Partial<AmqpReplyError>).code === 'number') {
        return BrokerError.fromAmqp(e as AmqpReplyError);
    }

    // ponytail: amqp-connection-manager's errors carry no class or code, only these messages;
    // a reworded message falls through to the base class
    if (e.message === 'timeout') {
        return ClientError.timeout(e);
    }

    if (e.message === 'Channel closed') {
        return ClientError.channelClosed(e);
    }

    return new AmqpExtensionError({ message: e.message, cause: e });
}
```

`src/errors/index.ts`:
```ts
/* copyright header */

export * from './base';
export * from './broker';
export * from './client';
export * from './constants';
export * from './serialization';
export * from './topology';
export * from './types';
```

`src/index.ts`: add `export * from './errors';` in alphabetical order, between `./consume` and `./exchange`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest --config test/vitest.config.ts --run test/unit/errors.spec.ts`
Expected: PASS (8 tests).

Then run `npm run lint` and `npx tsc --noEmit`. Both must be clean. If `tsc` reports `exactOptionalPropertyTypes` errors on the `classId`/`methodId` assignment, type those fields as `readonly classId: number | undefined;`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/errors src/index.ts test/unit/errors.spec.ts
git commit -m "feat: add error classes based on @ebec/core"
```

---

### Task 2: Throw and wrap errors in `Client` and `planTopology`

**Files:**
- Modify: `src/queue/utils.ts:26,38,51`
- Modify: `src/module.ts` (imports, `failure()` :57, `assertOpen()` :104, `consume()` ~:131-150, `publish()` ~:173-195)
- Test: `test/unit/utils.spec.ts:70-82`, `test/unit/module.spec.ts:107-190`

**Interfaces:**
- Consumes: `TopologyError`, `ClientError`, `SerializationError`, `BrokerError` from `./errors` and `toError` from `./errors/utils` (Task 1).
- Produces: `publish()` and `consume()` reject only with `AmqpExtensionError` subclasses.

- [ ] **Step 1: Update the tests so they fail**

`test/unit/utils.spec.ts`:
- Add `import { TopologyError } from '../../src';`.
- In the validation tests (lines 70-82), replace the assertions with:
```ts
        expect(() => planTopology({ type: 'direct' }, '', {})).toThrow(TopologyError);
        expect(() => planTopology({ type: 'direct' }, '', {}, true)).toThrow(/queue name/);
        // ...
        expect(() => planTopology({ type: 'topic' }, 'a', {})).toThrow(TopologyError);
        expect(() => planTopology({ type: 'topic', name: '' }, 'a', {}, true)).toThrow(TopologyError);
        // ...
        expect(() => planTopology(topic, '', {})).toThrow(TopologyError);
```
Keep each test's other lines and the surrounding `it(...)` titles. Change the `SyntaxError` wording in those titles to `TopologyError`.

`test/unit/module.spec.ts`:
- Change the import to `import { BrokerError, Client, ClientError, SerializationError, TopologyError } from '../../src';`. Let lint reflow it to one member per line.
- 406 test (line ~110-111): after each `rejects.toThrow(/PRECONDITION_FAILED/)` line, add:
```ts
        await expect(client.publish('mismatch', 'fooBar')).rejects.toMatchObject({ constructor: BrokerError, code: 'BROKER_REJECTED', replyCode: 406 });
```
- Invalid input test (line ~118): rename it to `'should reject invalid input with a TopologyError'`, and replace the three `toThrow(SyntaxError)` with `toThrow(TopologyError)`.
- Pending publish on close (line ~147): `await expect(published).rejects.toMatchObject({ constructor: ClientError, code: 'CHANNEL_CLOSED' });`
- 403 test (line ~154): add `await expect(client.consume('exclusive', { $any: () => {} })).rejects.toMatchObject({ constructor: BrokerError, replyCode: 403 });`
- Timeout test (line ~178): `await expect(other.publish('unreachable', 'fooBar', { timeout: 100 })).rejects.toMatchObject({ constructor: ClientError, code: 'PUBLISH_TIMEOUT' });`
- Closed test (lines ~188-189): replace both with `rejects.toMatchObject({ constructor: ClientError, code: 'CLIENT_CLOSED' })`.
- New test after the closed test:
```ts
    it('should reject an unserializable payload with a SerializationError', async () => {
        const circular : Record<string, unknown> = {};
        circular.self = circular;

        await expect(client.publish('serialize', circular)).rejects.toMatchObject({ constructor: SerializationError, cause: expect.any(TypeError) });
        await expect(client.publish('serialize', 1n)).rejects.toThrow(SerializationError);
        await expect(client.publish('serialize', undefined)).rejects.toMatchObject({ code: 'SERIALIZATION_FAILED' });
    });

    it('should publish JSON falsy payloads', async () => {
        await expect(client.publish('falsy', null)).resolves.toBe(true);
        await expect(client.publish('falsy', 0)).resolves.toBe(true);
        await expect(client.publish('falsy', false)).resolves.toBe(true);
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test`
Expected: FAIL. `TopologyError`, `BrokerError`, `ClientError` and `SerializationError` assertions mismatch (the actual errors are still `SyntaxError`/`Error`/raw). The falsy-payload test already passes.

- [ ] **Step 3: Implement**

`src/queue/utils.ts`:
- Add `import { TopologyError } from '../errors';`.
- Line 26: `throw TopologyError.queueNameEmpty();`
- Line 38: `throw TopologyError.exchangeNameMissing();`
- Line 51: `throw TopologyError.destinationMissing();`

`src/module.ts`:
- Imports: add `import { ClientError, SerializationError } from './errors';` and `import { toError } from './errors/utils';`.
- `failure()`: change `channel.once('close', () => reject(new Error('Channel closed')));` to `channel.once('close', () => reject(ClientError.channelClosed()));`
- `assertOpen()`: `throw ClientError.closed();`
- `consume()`: wrap everything after the `ctx` construction:
```ts
        try {
            this.assertOpen();

            const options = ctx.options ? mergeOptions(ctx.options, this.consumeOptions) : this.consumeOptions;
            const topology = planTopology(this.exchange, ctx.from, options, true);

            const channel = this.connection.createChannel({
                setup: guard(async (ch: Channel) => {
                    const queue = await assertTopology(ch, topology) as string;

                    if (typeof options.prefetchCount === 'number') {
                        await ch.prefetch(options.prefetchCount);
                    }

                    await ch.consume(queue, (message) => handleMessage(message, ch, ctx.handlers, options), options);
                }),
            });

            try {
                await Promise.race([channel.waitForConnect(), failure(channel)]);
            } catch (e) {
                await channel.close().catch(noop);
                throw e;
            }
        } catch (e) {
            throw toError(e);
        }
```
- `publish()`: wrap everything after the `ctx` construction, and replace serialization:
```ts
        try {
            this.assertOpen();

            const options = ctx.options ? mergeOptions(ctx.options, this.publishOptions) : this.publishOptions;
            const topology = planTopology(this.exchange, ctx.to, options);

            let content : Buffer;
            if (Buffer.isBuffer(ctx.data)) {
                content = ctx.data;
            } else if (typeof ctx.data === 'string') {
                content = Buffer.from(ctx.data, 'utf-8');
            } else {
                let json : string | undefined;
                try {
                    json = JSON.stringify(ctx.data);
                } catch (e) {
                    throw SerializationError.payload(e);
                }

                // undefined, functions and symbols serialize to undefined
                if (typeof json === 'undefined') {
                    throw SerializationError.payload();
                }

                content = Buffer.from(json, 'utf-8');
            }

            // ponytail: one channel per publish (self-healing, no shared state), reuse channels when throughput matters
            const channel = this.connection.createChannel({ setup: guard((ch: Channel) => assertTopology(ch, topology)) });

            // queued right away: sent once the setup ran, bounded by options.timeout, rejected by close()
            const published = channel.publish(this.exchange.name || '', ctx.to, content, options);
            published.catch(noop);

            try {
                return await Promise.race([published, failure(channel)]);
            } finally {
                await channel.close().catch(noop);
            }
        } catch (e) {
            throw toError(e);
        }
```
Keep the existing comments verbatim. Only the indentation changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test`
Expected: PASS, with all tests in `errors.spec.ts`, `utils.spec.ts` and `module.spec.ts` passing.

Then run `npm run test:coverage` (must meet 80% thresholds), `npm run lint`, `npx tsc --noEmit` and `npm run build`. All must be clean.

- [ ] **Step 5: Commit**

```bash
git add src/queue/utils.ts src/module.ts test/unit/utils.spec.ts test/unit/module.spec.ts
git commit -m "feat!: reject publish and consume with library errors

BREAKING CHANGE: publish() and consume() now reject with AmqpExtensionError subclasses.
Validation errors are TopologyError (was SyntaxError/Error), calls after close() and
closed channels reject with ClientError, broker rejections with BrokerError (amqplib
error as cause, reply code as replyCode), unserializable payloads with SerializationError,
and publish timeouts with ClientError (PUBLISH_TIMEOUT)."
```

---

### Task 3: Documentation

**Files:**
- Modify: `README.MD` (new `### Errors` under Usage, after `### Multiple exchanges`; API table; Notes)
- Modify: `.agents/structure.md`, `.agents/architecture.md`

- [ ] **Step 1: README `### Errors` section.** Insert it before `## Options`:

````markdown
### Errors

`publish()` and `consume()` reject only with subclasses of `AmqpExtensionError` (built on [`@ebec/core`](https://www.npmjs.com/package/@ebec/core)). Check the category with `instanceof` and the specific failure with `code`:

| Class | `code` |
|---|---|
| `TopologyError` | `QUEUE_NAME_EMPTY`, `EXCHANGE_NAME_MISSING`, `DESTINATION_MISSING` |
| `ClientError` | `CLIENT_CLOSED`, `CHANNEL_CLOSED`, `PUBLISH_TIMEOUT` |
| `BrokerError` | `BROKER_REJECTED`, with the AMQP reply code as `replyCode` |
| `SerializationError` | `SERIALIZATION_FAILED` |

```typescript
import { BrokerError, ErrorCode } from 'amqp-extension';

try {
    await client.publish('jobs', payload, { timeout: 5_000 });
} catch (e) {
    if (e instanceof BrokerError && e.replyCode === 406) {
        // queue re-declared with different arguments
    } else if (e instanceof ClientError && e.code === ErrorCode.PUBLISH_TIMEOUT) {
        // broker unreachable
    }
}
```

The original amqplib / amqp-connection-manager error is available as `cause`.
````

Fix the import in the snippet to `import { BrokerError, ClientError, ErrorCode } from 'amqp-extension';`.

- [ ] **Step 2: README API table and Notes**
- API table: add the row `| `AmqpExtensionError`, `TopologyError`, `ClientError`, `BrokerError`, `SerializationError` | class | Error tree, see [Errors](#errors) |` and the row `| `ErrorCode` | enum | Stable error codes |`.
- Notes:
  - "Broker errors reject the call": change "reject with that error" to "reject with a `BrokerError` (the amqplib error is its `cause`)".
  - "Calls after `close()` reject": change to "reject with a `ClientError` (`CLIENT_CLOSED`)".
  - "Invalid input rejects": append "with a `TopologyError`".

- [ ] **Step 3: `.agents/structure.md`**
- Directory tree: add, between `consume/` and `exchange/`:
```
│   ├── errors/
│   │   ├── base.ts           # AmqpExtensionError (extends @ebec/core BaseError)
│   │   ├── topology.ts, client.ts, broker.ts, serialization.ts  # subclasses with static factories
│   │   ├── constants.ts      # ErrorCode enum
│   │   ├── types.ts          # BrokerReply, AmqpReplyError
│   │   └── utils.ts          # toError(): foreign error → error tree (internal, not re-exported)
```
- Module table: add the row `| `src/errors/` | Error tree on `@ebec/core`, `ErrorCode`, internal `toError()` |`.
- Dependency table: add the row `| `@ebec/core` | `BaseError` (code, cause, toJSON) for the error tree |`.
- The internal-exports sentence: add `src/errors/utils.ts` (`toError`).

- [ ] **Step 4: `.agents/architecture.md` "Error Handling"**
- Replace the configuration-errors bullet with: "Configuration errors reject with `TopologyError` (`QUEUE_NAME_EMPTY`, `EXCHANGE_NAME_MISSING`, `DESTINATION_MISSING`) before any channel is opened."
- Replace the broker-rejection bullet with: "Broker rejections become `BrokerError` (`replyCode`, `classId`, `methodId`; amqplib error as `cause`). Only that channel closes."
- Add the bullet: "`publish`/`consume` pass every rejection through `toError()` (`src/errors/utils.ts`), so callers only ever see `AmqpExtensionError` subclasses. It maps amqp-connection-manager's `timeout` / `Channel closed` by message (`ponytail:`, they carry no class or code)."
- In §4: change `` reject with `The client is closed.` `` to `` reject with `ClientError.closed()` (`The client is closed.`) ``.

- [ ] **Step 5: Verify and commit**

Run: `npm run lint` (README is not linted, but this confirms nothing else changed).
```bash
git add README.MD .agents/structure.md .agents/architecture.md
git commit -m "docs: document the error classes"
```
