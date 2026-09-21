import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';
import {
  startSettlementRunWorker,
  closeSettlementRunWorker,
  scheduleWeeklySettlementRun,
} from './settlement/settlement.queue';
import { closeConnection } from '@youmart/queue';

const app = createApp();

startSettlementRunWorker();
logger.info({ queue: 'settlement-run' }, 'settlement-run worker registered');

scheduleWeeklySettlementRun()
  .then(() => {
    logger.info({ cron: config.settlementScheduleCron }, 'weekly settlement-run scheduled');
  })
  .catch((err: unknown) => {
    logger.error({ err }, 'failed to schedule weekly settlement-run');
  });

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'settlement', port: config.port, nodeEnv: config.nodeEnv },
    'settlement-service started',
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

    // Order matters: stop the worker before closing the shared queue
    // connection it depends on, then release the db pool.
    closeSettlementRunWorker()
      .then(() => {
        logger.info('settlement-run worker closed');
        return closeConnection();
      })
      .then(() => {
        logger.info('queue connection closed');
        return close();
      })
      .then(() => {
        logger.info('db connection pool closed');
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

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
