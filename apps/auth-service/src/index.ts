import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';
import { closeConnection } from '@youmart/queue';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'auth', port: config.port, nodeEnv: config.nodeEnv },
    'auth-service started',
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

    // OTP sending is now notification-service's job (Ch6.2) - auth-service
    // only ENQUEUES via @youmart/notifications-client, it has no worker of
    // its own to stop; still closes its own queue connection (used to
    // enqueue) before the db pool.
    closeConnection()
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
