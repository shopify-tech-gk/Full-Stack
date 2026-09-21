import pino from 'pino';
import { config } from './config';

const destination = pino.destination({ sync: true });

export const logger = pino({ level: config.logLevel }, destination);
