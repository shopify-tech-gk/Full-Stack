# @youmart/config

Shared, Zod-validated environment configuration for YouMart backend services.

## Principle

Config is validated **once, at process start, in one place**. A service
either boots with a fully-typed, frozen config object, or it fails
immediately with a readable error listing every problem at once - never a
mysterious crash mid-request because some env var was missing or malformed.

Services should never scatter raw `process.env` access through their
codebase; they should read from the object `loadConfig()` (or
`loadConfigWith()`) returns.

## Usage

```ts
import { loadConfig } from '@youmart/config';

const config = loadConfig(); // throws with all problems listed, or returns a frozen object
console.log(config.databaseUrl, config.logLevel);
```

## Extending the base schema

Every service shares `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, and
`LOG_LEVEL` (see `baseEnvSchema`). A service adds its own required vars by
extending that schema and validating with `loadConfigWith`:

```ts
import { z } from 'zod';
import { baseEnvSchema, loadConfigWith } from '@youmart/config';

const authServiceEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().default(4001),
});

const config = loadConfigWith(authServiceEnvSchema);
console.log(config.PORT);
```
