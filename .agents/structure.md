# Project Structure

Single npm package, ESM-only output (`"type": "module"`), Node `>=22`.

## Directory Layout

```
amqp-extension/
├── src/
│   ├── index.ts              # Public barrel: re-exports consume, exchange, module, publish, queue, type
│   ├── module.ts             # Client class (publish / consume / of)
│   ├── type.ts               # Connection, ConnectionOptions, ClientContext
│   ├── utils.ts              # mergeOptions (smob merger, left priority)
│   ├── consume/
│   │   ├── constants.ts      # ConsumeHandlerAnyKey = '$any'
│   │   ├── type.ts           # ConsumeOptions, ConsumeHandlers, ConsumeContext, ConsumeMessageHandler
│   │   └── utils.ts          # handleMessage(): dispatch + ack/nack (internal, not re-exported)
│   ├── exchange/
│   │   ├── constants.ts      # ExchangeType enum (fanout, direct, topic, match)
│   │   ├── type.ts           # Exchange, ExchangeOptions
│   │   └── utils.ts          # isDefaultExchange()
│   ├── publish/
│   │   └── type.ts           # PublishOptions, PublishContext
│   └── queue/
│       ├── type.ts           # QueueOptions (singleActiveConsumer)
│       └── utils.ts          # Topology, planTopology() (pure), assertTopology() (internal)
├── test/
│   ├── vitest.config.ts      # include glob, globalSetup, timeouts, coverage thresholds
│   ├── utils/global-setup.ts # Starts rabbitmq:3-management container, provides MQ_CONNECTION_STRING
│   ├── unit/module.spec.ts   # Client publish/consume tests against a live broker
│   ├── unit/utils.spec.ts    # Broker-free tests: planTopology table, handleMessage settlement
│   └── data/                 # Git-ignored scratch dir
├── dist/                     # Build output (git-ignored, published)
├── .github/
│   ├── actions/              # Composite install/build actions (cached)
│   └── workflows/            # main.yml (CI), release.yml (release-please + publish)
├── .husky/commit-msg         # commitlint
├── eslint.config.js, commitlint.config.mjs
├── release-please-config.json, .release-please-manifest.json
└── tsconfig.json (noEmit), tsdown.config.ts
```

## Module Responsibilities

| Module            | Purpose                                                                                               |
|-------------------|-------------------------------------------------------------------------------------------------------|
| `src/module.ts`   | `Client`: owns the connection, default publish/consume options and the bound exchange              |
| `src/type.ts`     | `ClientContext` (constructor input), `Connection` (`ReturnType<typeof connect>`)                     |
| `src/utils.ts`    | `mergeOptions`: deep merge where the call-site options win                                          |
| `src/consume/`    | Consume option and handler types, `$any` fallback key, `handleMessage` (dispatch + ack/nack policy) |
| `src/publish/`    | Publish option/context types (`amqplib` `Options.Publish` & `QueueOptions`)                          |
| `src/queue/`      | `QueueOptions` (flat on consume/publish options) plus topology planning/declaration for every exchange kind |
| `src/exchange/`   | `ExchangeType` enum, `Exchange` shape, default-exchange detection                                  |

## Key Dependencies

| Dependency                 | Role                                                                  |
|----------------------------|-----------------------------------------------------------------------|
| `amqp-connection-manager`  | Reconnecting connection and channel wrapper (`connect`, `createChannel({ setup })`) |
| `amqplib`                  | Underlying AMQP 0-9-1 client with bundled types; option types (`Options.*`) are re-used directly |
| `smob`                     | `createMerger` for option merging                                     |

## Package Exports

```json
{
    "type": "module",
    "main": "dist/index.mjs",
    "types": "dist/index.d.mts",
    "exports": {
        "./package.json": "./package.json",
        ".": {
            "types": "./dist/index.d.mts",
            "import": "./dist/index.mjs"
        }
    }
}
```

There is no `require` condition. Everything re-exported from `src/index.ts` is public API. `src/utils.ts` (`mergeOptions`), `src/consume/utils.ts` (`handleMessage`) and `src/queue/utils.ts` (`Topology`, `planTopology`, `assertTopology`) are **not** re-exported and stay internal.
