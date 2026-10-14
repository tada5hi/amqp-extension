# Project Structure

Single npm package, CommonJS output.

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
│   └── publish/
│       └── type.ts           # PublishOptions, PublishContext
├── test/
│   ├── jest.config.js        # rootDir '../', globalSetup/teardown, coverage thresholds
│   ├── setup.js              # Starts rabbitmq:3-management container, writes MQ_CONNECTION_STRING
│   ├── teardown.js           # Stops the container
│   ├── unit/module.spec.ts   # Client publish/consume tests against a live broker
│   └── data/                 # Git-ignored scratch dir
├── dist/                     # Build output (git-ignored, published)
├── .github/workflows/main.yml
├── commitlint.config.js, release.config.js
└── tsconfig.json, tsconfig.eslint.json, .eslintrc
```

## Module Responsibilities

| Module            | Purpose                                                                                               |
|-------------------|-------------------------------------------------------------------------------------------------------|
| `src/module.ts`   | `Client`: owns the connection, default publish/consume options and the bound exchange              |
| `src/type.ts`     | `ClientContext` (constructor input), `Connection` (`ReturnType<typeof connect>`)                     |
| `src/utils.ts`    | `mergeOptions`: deep merge where the call-site options win; keeps an `exchange` object whole (no deep merge) |
| `src/consume/`    | Consume option and handler types, `$any` fallback key, handler-map type guard                       |
| `src/publish/`    | Publish option/context types (thin aliases over `amqplib` `Options.Publish`)                         |
| `src/exchange/`   | `ExchangeType` enum, `Exchange` shape, default-exchange detection                                  |
| `src/config/`     | `buildConfig()` from the older API. Still exported but unused internally, kept for compatibility    |

## Key Dependencies

| Dependency                 | Role                                                                  |
|----------------------------|-----------------------------------------------------------------------|
| `amqp-connection-manager`  | Reconnecting connection and channel wrapper (`connect`, `createChannel({ setup })`) |
| `amqplib`, `@types/amqplib`| Underlying AMQP 0-9-1 client; option types (`Options.*`) are re-used directly |
| `smob`                     | `createMerger` for option merging, `isObject`                      |
| `uuid`                     | Declared dependency, currently not imported in `src/`               |

## Package Exports

```json
{
    "main": "./dist/index.js",
    "typings": "dist/index.d.ts"
}
```

There is no `exports` map. Everything re-exported from `src/index.ts` is public API. `src/utils.ts` (`mergeOptions`) is **not** re-exported and stays internal.
