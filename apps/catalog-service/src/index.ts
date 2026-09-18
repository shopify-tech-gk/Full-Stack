import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'catalog', port: config.port, nodeEnv: config.nodeEnv },
    'catalog-service started',
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

    // No queue is used yet in this service - just release the db pool.
    close()
      .then(() => {
        logger.info('db connection pool closed');
      })
      .catch((closeErr: unknown) => {
        logger.error({ err: closeErr }, 'error closing db pool');
      })
      .finally(() => {
        logger.info('shutdown complete');
        process.exit(0);
      });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
