import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, 'api-gateway listening');
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down api-gateway');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
