import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';
import { resyncDeliveredItems } from './logistics/logistics.service';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'logistics', port: config.port, nodeEnv: config.nodeEnv },
    'logistics-service started',
  );
});

// Every 10 minutes: re-send DELIVERED for recently delivered shipments whose order item may have
// missed the first update (idempotent; see resyncDeliveredItems).
const RESYNC_EVERY_MS = 10 * 60 * 1000;
let resyncing = false;
const resyncTimer = setInterval(() => {
  if (resyncing) return;
  resyncing = true;
  resyncDeliveredItems()
    .catch((err: unknown) => logger.error({ err }, 'delivered re-sync failed'))
    .finally(() => {
      resyncing = false;
    });
}, RESYNC_EVERY_MS);
resyncTimer.unref();

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  clearInterval(resyncTimer);

  logger.info({ signal }, 'shutdown signal received');

  server.close((err) => {
    if (err) {
      logger.error({ err }, 'error closing http server');
    } else {
      logger.info('http server closed');
    }

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
