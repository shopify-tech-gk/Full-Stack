import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';
import { close } from './db';
import { expireUnpaidOrders } from './order/order.service';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { service: 'order', port: config.port, nodeEnv: config.nodeEnv },
    'order-service started',
  );
});

// W9: cancel orders left unpaid past UNPAID_ORDER_TTL_MINUTES (releases stock + wallet holds).
// Every instance may run it - the conditional status flip lets only one cancel each order.
const SWEEP_EVERY_MS = 60 * 1000;
let sweeping = false;
const sweepTimer =
  config.unpaidOrderTtlMinutes > 0
    ? setInterval(() => {
        if (sweeping) return;
        sweeping = true;
        expireUnpaidOrders(config.unpaidOrderTtlMinutes)
          .then((count) => {
            if (count > 0) logger.info({ count }, 'expired unpaid orders');
          })
          .catch((err: unknown) => logger.error({ err }, 'unpaid-order sweep failed'))
          .finally(() => {
            sweeping = false;
          });
      }, SWEEP_EVERY_MS)
    : null;
sweepTimer?.unref();

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  if (sweepTimer) clearInterval(sweepTimer);

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
