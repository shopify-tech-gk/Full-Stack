# @youmart/queue

Generic background job machinery shared across YouMart backend services, built on
[BullMQ](https://docs.bullmq.io/) + Redis.

## Hard rule: all background work goes through `@youmart/queue`

Everything off the checkout critical path - notifications, invoice generation, search
reindexing, settlement runs, analytics rollups - runs as an async job through this package.
Retries, backoff, and dead-letter handling are solved once, here, so no service reinvents them.

Redis persistence (AOF, enabled in the Docker infra from prompt 1.2) is what lets queued jobs
survive a Redis restart.

## What's here

- `connection.ts` - a singleton ioredis connection factory (`maxRetriesPerRequest: null`, as
  BullMQ requires) and `closeConnection()` for graceful shutdown.
- `queue.ts` - `createQueue(name, payloadSchema)` and `registerWorker(name, payloadSchema, handler)`,
  a type-safe, Zod-validated wrapper around BullMQ's `Queue`/`Worker`.
- `config.ts` - the platform-wide default `JobsOptions` (attempts, backoff, retention).

## What's NOT here

No domain jobs (send-email, generate-invoice, reindex-product, settlement, etc.) are defined in
this package. Each service defines its own job names and payload schemas, and calls
`createQueue`/`registerWorker` from here to run them.
