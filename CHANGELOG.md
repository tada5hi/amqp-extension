# [4.0.0](https://github.com/Tada5hi/amqp-extension/compare/v3.3.0...v4.0.0) (2025-03-31)


### Bug Fixes

* **deps:** bump amqplib from 0.10.3 to 0.10.4 ([#368](https://github.com/Tada5hi/amqp-extension/issues/368)) ([dae6c84](https://github.com/Tada5hi/amqp-extension/commit/dae6c840ad69e74a6c5dc37ea7f0fbb6c8ea1bae))
* **deps:** bump smob from 1.4.1 to 1.5.0 ([#334](https://github.com/Tada5hi/amqp-extension/issues/334)) ([0b2935a](https://github.com/Tada5hi/amqp-extension/commit/0b2935af145d4844510c19b6d3f9d23ac0e3386a))
* **deps:** bump the minorandpatch group with 10 updates ([#428](https://github.com/Tada5hi/amqp-extension/issues/428)) ([3ffb425](https://github.com/Tada5hi/amqp-extension/commit/3ffb425c3ff7e987791d80172fe4166a3b9f7dc5))
* **deps:** bump uuid from 9.0.1 to 11.1.0 in the majorprod group ([#426](https://github.com/Tada5hi/amqp-extension/issues/426)) ([2c6bdc0](https://github.com/Tada5hi/amqp-extension/commit/2c6bdc095aeb6760467d0eed678fe2b4cd421f70))
* ensure (n)ack is send on same channel ([ab7026f](https://github.com/Tada5hi/amqp-extension/commit/ab7026f4e65f9cff33cb509dc25a77b72ddc25f1))
* only ack message if noAck option is false ([d6102e3](https://github.com/Tada5hi/amqp-extension/commit/d6102e3df431c6710257b5bdf59c8e99672e7df6))


### Features

* adjusted test suite ([a5cc771](https://github.com/Tada5hi/amqp-extension/commit/a5cc7714a141d671d1e97ed67216df0ffc53af49))
* change publish/consume signature ([ff316ec](https://github.com/Tada5hi/amqp-extension/commit/ff316ec27ac1077c7a6949ea5e5adf6ad1e5e5f5))
* initial refactoring of config, consume- &p publish-behaviour ([1102aa8](https://github.com/Tada5hi/amqp-extension/commit/1102aa8a8b000336312d89c92434d8c77e7a0424))


### BREAKING CHANGES

* public api changed

# [4.0.0-beta.3](https://github.com/Tada5hi/amqp-extension/compare/v4.0.0-beta.2...v4.0.0-beta.3) (2024-06-12)


### Bug Fixes

* only ack message if noAck option is false ([d6102e3](https://github.com/Tada5hi/amqp-extension/commit/d6102e3df431c6710257b5bdf59c8e99672e7df6))

# [4.0.0-beta.2](https://github.com/Tada5hi/amqp-extension/compare/v4.0.0-beta.1...v4.0.0-beta.2) (2024-06-11)


### Bug Fixes

* ensure (n)ack is send on same channel ([ab7026f](https://github.com/Tada5hi/amqp-extension/commit/ab7026f4e65f9cff33cb509dc25a77b72ddc25f1))

# [4.0.0-beta.1](https://github.com/Tada5hi/amqp-extension/compare/v3.3.0...v4.0.0-beta.1) (2024-06-06)


### Bug Fixes

* **deps:** bump amqplib from 0.10.3 to 0.10.4 ([#368](https://github.com/Tada5hi/amqp-extension/issues/368)) ([dae6c84](https://github.com/Tada5hi/amqp-extension/commit/dae6c840ad69e74a6c5dc37ea7f0fbb6c8ea1bae))
* **deps:** bump smob from 1.4.1 to 1.5.0 ([#334](https://github.com/Tada5hi/amqp-extension/issues/334)) ([0b2935a](https://github.com/Tada5hi/amqp-extension/commit/0b2935af145d4844510c19b6d3f9d23ac0e3386a))


### Features

* adjusted test suite ([a5cc771](https://github.com/Tada5hi/amqp-extension/commit/a5cc7714a141d671d1e97ed67216df0ffc53af49))
* change publish/consume signature ([ff316ec](https://github.com/Tada5hi/amqp-extension/commit/ff316ec27ac1077c7a6949ea5e5adf6ad1e5e5f5))
* initial refactoring of config, consume- &p publish-behaviour ([1102aa8](https://github.com/Tada5hi/amqp-extension/commit/1102aa8a8b000336312d89c92434d8c77e7a0424))


### BREAKING CHANGES

* public api changed

# [3.3.0](https://github.com/Tada5hi/amqp-extension/compare/v3.2.0...v3.3.0) (2024-03-20)


### Features

* use amqp-connection-manager for connection/reconnect buisness ([#331](https://github.com/Tada5hi/amqp-extension/issues/331)) ([aa6a21e](https://github.com/Tada5hi/amqp-extension/commit/aa6a21e391ad2c07aa645ec2241e47b177e825e9))

# [3.2.0](https://github.com/Tada5hi/amqp-extension/compare/v3.1.1...v3.2.0) (2024-03-11)


### Bug Fixes

* remove unnecessary alias option ([8027d0a](https://github.com/Tada5hi/amqp-extension/commit/8027d0afb2063e5d0387dacf26cd77444dc933e4))


### Features

* allways close channel after publishing ([a9b300f](https://github.com/Tada5hi/amqp-extension/commit/a9b300f6ab64d176a656cf9fc485f31a36168a7f))

## [3.1.1](https://github.com/Tada5hi/amqp-extension/compare/v3.1.0...v3.1.1) (2024-03-07)


### Bug Fixes

* don't register consumer multiple times ([b45defa](https://github.com/Tada5hi/amqp-extension/commit/b45defa4dbd5a7abf6d2568586e2ff5bf2e62d16))

# [3.1.0](https://github.com/Tada5hi/amqp-extension/compare/v3.0.0...v3.1.0) (2024-03-06)


### Features

* reconnect strategy ([#320](https://github.com/Tada5hi/amqp-extension/issues/320)) ([4c31551](https://github.com/Tada5hi/amqp-extension/commit/4c31551029916dcaf055f78d53a8af7c626c393d))
* reconnect strategy ([#320](https://github.com/Tada5hi/amqp-extension/issues/320)) ([17b141f](https://github.com/Tada5hi/amqp-extension/commit/17b141f6bd6256172e8c03a1006bfc1cab6225eb))

# [3.0.0](https://github.com/Tada5hi/amqp-extension/compare/v2.0.2...v3.0.0) (2024-02-28)


### Bug Fixes

* **deps:** bump @types/amqplib from 0.10.4 to 0.10.5 ([#310](https://github.com/Tada5hi/amqp-extension/issues/310)) ([984294e](https://github.com/Tada5hi/amqp-extension/commit/984294e7ac9dd04853ebd75e70b09841340b3239))


### Features

* bind consume & publish to client class & remove singleton patterns ([9160408](https://github.com/Tada5hi/amqp-extension/commit/9160408038b1d48210735c843674817bb0ac45c6))


### BREAKING CHANGES

* refactor public api

## [2.0.2](https://github.com/Tada5hi/amqp-extension/compare/v2.0.1...v2.0.2) (2024-02-28)


### Bug Fixes

* **deps:** bump @types/amqplib from 0.10.3 to 0.10.4 ([#264](https://github.com/Tada5hi/amqp-extension/issues/264)) ([fb85e39](https://github.com/Tada5hi/amqp-extension/commit/fb85e39317d9b1bc2e08452f70bde7ea48957bef))

## [2.0.1](https://github.com/Tada5hi/amqp-extension/compare/v2.0.0...v2.0.1) (2023-11-05)


### Bug Fixes

* bump (dev-) dependencies & resolved linting issues ([25b74ce](https://github.com/Tada5hi/amqp-extension/commit/25b74ceb3b83581b1f67bc7b09c6c68029e87252))

# [2.0.0](https://github.com/Tada5hi/amqp-extension/compare/v1.1.1...v2.0.0) (2023-02-03)


### Bug Fixes

* add generic type to publish option ([6f67912](https://github.com/Tada5hi/amqp-extension/commit/6f679129b4e295757b728e0df625ce276d708fe4))
* **deps:** bump @types/amqplib ([de1316b](https://github.com/Tada5hi/amqp-extension/commit/de1316bd33885387ca88b761d03962692ba01d7f))


### BREAKING CHANGES

* bump version

## [1.1.1](https://github.com/Tada5hi/amqp-extension/compare/v1.1.0...v1.1.1) (2023-02-03)


### Bug Fixes

* expose amqplib types \n\n BREAKING CHANGE: bump to v2 ([5156649](https://github.com/Tada5hi/amqp-extension/commit/515664904e54c0767fb495bf7c6993101b0f169f))

# [1.1.0](https://github.com/Tada5hi/amqp-extension/compare/v1.0.5...v1.1.0) (2023-02-03)


### Features

* refactored and enhance publish & subscribe pattern \n\n BREAKING CHANGE: api rewritten ([#224](https://github.com/Tada5hi/amqp-extension/issues/224)) ([5bc43c2](https://github.com/Tada5hi/amqp-extension/commit/5bc43c235113ec8d604ad259434ad94fb7bb09f8))
