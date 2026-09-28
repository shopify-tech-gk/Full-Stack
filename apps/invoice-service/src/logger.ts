import pino from 'pino';
import { config } from './config';

// sync:true so shutdown log lines actually flush before process.exit -
// otherwise the last few lines of the shutdown trace are silently lost.
const destination = pino.destination({ sync: true });

export const logger = pino({ level: config.logLevel, name: 'invoice' }, destination);
