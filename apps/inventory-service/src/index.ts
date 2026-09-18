import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';
import { closeRedis } from './redis';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'inventory', port: config.port, nodeEnv: config.nodeEnv },
    'inventory-service started',
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

    Promise.all([close(), closeRedis()])
      .then(() => {
        logger.info('db pool and redis connection closed');
      })
      .catch((closeErr: unknown) => {
        logger.error({ err: closeErr }, 'error during shutdown cleanup');
      })
      .finally(() => {
        logger.info('shutdown complete');
        process.exit(0);
      });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
