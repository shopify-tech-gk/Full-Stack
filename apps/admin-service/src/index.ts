import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'admin', port: config.port, nodeEnv: config.nodeEnv },
    'admin-service started',
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

    close()
      .then(() => {
        logger.info('database connection closed');
        process.exit(err ? 1 : 0);
      })
      .catch((closeErr: unknown) => {
        logger.error({ err: closeErr }, 'error closing database connection');
        process.exit(1);
      });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
