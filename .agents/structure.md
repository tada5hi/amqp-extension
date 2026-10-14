# Project Structure

Single npm package, ESM-only output (`"type": "module"`), Node `>=22`.

## Directory Layout

```
amqp-extension/
├── src/
│   ├── index.ts              # Public barrel: re-exports config, consume, exchange, module, publish, type
│   ├── module.ts             # Client class (publish / consume / of)
│   ├── type.ts               # Connection, ConnectionOptions, ClientContext
│   ├── utils.ts              # mergeOptions (smob merger, left priority)
│   ├── config/               # Legacy Config/ConfigInput types + buildConfig() (not used by Client)
│   ├── consume/
│   │   ├── constants.ts      # ConsumeHandlerAnyKey = '$any'
│   │   ├── type.ts           # ConsumeOptions, ConsumeHandlers, ConsumeContext, ConsumeMessageHandler
│   │   └── utils.ts          # isConsumeHandlers()
│   ├── exchange/
│   │   ├── constants.ts      # ExchangeType enum (fanout, direct, topic, match)
│   │   ├── type.ts           # Exchange, ExchangeOptions
│   │   └── utils.ts          # isDefaultExchange(), isExchange()
│   ├── publish/
│   │   └── type.ts           # PublishOptions, PublishContext
│   └── queue/
│       ├── type.ts           # QueueOptions (singleActiveConsumer)
│       └── utils.ts          # buildAssertQueueOptions() → amqplib Options.AssertQueue
├── test/
│   ├── vitest.config.ts      # include glob, globalSetup, timeouts, coverage thresholds
│   ├── utils/global-setup.ts # Starts rabbitmq:3-management container, provides MQ_CONNECTION_STRING
│   ├── unit/module.spec.ts   # Client publish/consume tests against a live broker
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
| `src/utils.ts`    | `mergeOptions`: deep merge where the call-site options win; keeps an `exchange` object whole (no deep merge) |
| `src/consume/`    | Consume option and handler types, `$any` fallback key, handler-map type guard                       |
| `src/publish/`    | Publish option/context types (`amqplib` `Options.Publish` & `QueueOptions`)                          |
| `src/queue/`      | `QueueOptions` (flat on consume/publish options) for the default-exchange queue, mapped to `assertQueue` options/arguments |
| `src/exchange/`   | `ExchangeType` enum, `Exchange` shape, default-exchange detection                                  |
| `src/config/`     | `buildConfig()` from the older API. Still exported but unused internally, kept for compatibility    |

## Key Dependencies

| Dependency                 | Role                                                                  |
|----------------------------|-----------------------------------------------------------------------|
| `amqp-connection-manager`  | Reconnecting connection and channel wrapper (`connect`, `createChannel({ setup })`) |
| `amqplib`                  | Underlying AMQP 0-9-1 client with bundled types; option types (`Options.*`) are re-used directly |
| `smob`                     | `createMerger` for option merging, `isObject`                      |

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

There is no `require` condition. Everything re-exported from `src/index.ts` is public API. `src/utils.ts` (`mergeOptions`) is **not** re-exported and stays internal.
