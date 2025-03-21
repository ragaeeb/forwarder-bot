import process from 'node:process';
import pino, { type Logger } from 'pino';
import pretty from 'pino-pretty';

/**
 * Creates a pretty-printed stream for the logger.
 * Adds colorization for better readability in development.
 */
const stream = pretty({ colorize: true });

/**
 * Application logger instance.
 * Configured to remove default pino metadata and use the LOG_LEVEL
 * environment variable to control logging verbosity.
 *
 * @type {Logger} - Pino logger instance
 */
const logger: Logger = pino.default(
    {
        base: { hostname: undefined, pid: undefined }, // This will remove pid and hostname but keep time
        level: process.env.LOG_LEVEL || 'debug',
    },
    stream,
);

export default logger;
