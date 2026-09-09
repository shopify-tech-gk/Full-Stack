import { Queue, Worker, type Job, type JobsOptions, type WorkerOptions } from 'bullmq';
import type { ZodType } from 'zod';
import { getConnection } from './connection';
import { DEFAULT_JOB_OPTIONS } from './config';

// BullMQ's Queue/Worker generics also support a "named job union" pattern, resolved via
// conditional types that TypeScript can't fully simplify while TPayload is still a generic
// (unresolved) parameter. We let the underlying Queue/Worker fall back to their untyped
// (`any`) defaults internally, and cast at the boundary so the PUBLIC api of this module
// (enqueue/registerWorker) stays fully typed to TPayload for callers.
type TypedJob<TPayload> = Job<TPayload, unknown, string>;

export interface TypedQueue<TPayload> {
  readonly name: string;
  enqueue(payload: TPayload, opts?: JobsOptions): Promise<TypedJob<TPayload>>;
}

export function createQueue<TPayload>(
  name: string,
  payloadSchema: ZodType<TPayload>,
): TypedQueue<TPayload> {
  const queue = new Queue(name, { connection: getConnection() });

  return {
    name,
    async enqueue(payload, opts) {
      // validated before it ever reaches Redis - never enqueue an unvalidated payload
      const result = payloadSchema.safeParse(payload);
      if (!result.success) {
        throw new Error(`Invalid payload for queue "${name}": ${result.error.message}`);
      }
      const job = await queue.add(name, result.data, { ...DEFAULT_JOB_OPTIONS, ...opts });
      return job as unknown as TypedJob<TPayload>;
    },
  };
}

export type JobHandler<TPayload> = (
  payload: TPayload,
  job: TypedJob<TPayload>,
) => Promise<void> | void;

export function registerWorker<TPayload>(
  name: string,
  payloadSchema: ZodType<TPayload>,
  handler: JobHandler<TPayload>,
  opts?: WorkerOptions,
): Worker<TPayload, unknown, string> {
  const worker = new Worker(
    name,
    async (job) => {
      // re-validated here too (defense in depth) in case Redis ever holds stale/foreign data
      const result = payloadSchema.safeParse(job.data);
      if (!result.success) {
        throw new Error(`Invalid payload received from queue "${name}": ${result.error.message}`);
      }
      await handler(result.data, job as unknown as TypedJob<TPayload>);
    },
    { connection: getConnection(), ...opts },
  );
  return worker as unknown as Worker<TPayload, unknown, string>;
}
