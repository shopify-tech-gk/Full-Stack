import { closeConnection } from '@youmart/queue';
import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { initSearchIndex } from './search/index.service';
import { startReindexWorker, closeReindexWorker } from './search/reindex.queue';
import {
  startFullReindexWorker,
  closeFullReindexWorker,
  scheduleNightlyFullReindex,
} from './search/full-reindex.queue';

const app = createApp();

initSearchIndex()
  .then(() => {
    logger.info('typesense products collection ready');
  })
  .catch((err: unknown) => {
    logger.error({ err }, 'failed to ensure typesense collection at startup');
  });

startReindexWorker();
logger.info({ queue: 'search-reindex' }, 'search-reindex worker registered');

startFullReindexWorker();
logger.info({ queue: 'search-full-reindex' }, 'search-full-reindex worker registered');

scheduleNightlyFullReindex().catch((err: unknown) => {
  logger.error({ err }, 'failed to schedule nightly full reindex');
});

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'search', port: config.port, nodeEnv: config.nodeEnv },
    'search-service started',
  );
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal }, 'shutdown signal received');

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error closing http server');
    } else {
      logger.info('http server closed');
    }

    // Order matters: stop both workers before closing the shared queue
    // connection they depend on. No db pool to close - there is none.
    closeReindexWorker()
      .then(() => closeFullReindexWorker())
      .then(() => {
        logger.info('workers closed');
        return closeConnection();
      })
      .then(() => {
        logger.info('queue connection closed');
      })
      .catch((shutdownErr: unknown) => {
        logger.error({ err: shutdownErr }, 'error during shutdown');
      })
      .finally(() => {
        logger.info('shutdown complete');
        process.exit(0);
      });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
