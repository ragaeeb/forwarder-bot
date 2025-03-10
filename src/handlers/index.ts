import type { DynamoDBService } from '@/services/dynamodb.js';
import type { ForwardContext } from '@/types.js';
import type { Bot, Context, ContextType, DeriveDefinitions, Handler } from 'gramio';

import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';

import { onGenericMessage } from './genericMessage.js';

/**
 * Type for handling bot commands with context
 */
type CommandHandler = (
    context: ContextType<Bot, 'message'> &
        DeriveDefinitions['global'] &
        DeriveDefinitions['message'] & {
            args: null | string;
        },
) => unknown;

/**
 * Middleware for processing requests
 */
type Middleware = Handler<Context<Bot> & DeriveDefinitions['global']>;

/**
 * Handler for processing updates
 */
type UpdateHandler = Handler<ContextType<Bot, any> & DeriveDefinitions & DeriveDefinitions['global']>;

/**
 * Middleware to attach bot information to context
 * @param ctx - Forward context
 * @param next - Next middleware function
 */
const withBot = async (ctx: ForwardContext, next: () => Promise<void>) => {
    const me = await ctx.api?.getMe();
    ctx.me = me;

    if (ctx.from?.id !== ctx.me?.id) {
        return next();
    }
};

/**
 * Middleware to attach database service to context
 * @param db - DynamoDB service instance
 * @returns Middleware function
 */
const withDB = (db: DynamoDBService) => {
    return (ctx: ForwardContext, next: () => Promise<void>) => {
        ctx.db = db;
        return next();
    };
};

/**
 * Register handlers and middleware for the bot
 * @param bot - Bot instance
 * @param db - DynamoDB service instance
 */
export const registerHandlers = (bot: Bot, db: DynamoDBService) => {
    bot.use(withBot as Middleware);
    bot.use(withDB(db) as Middleware);

    bot.command('start', onStart as CommandHandler);
    bot.command('setup', onSetup as CommandHandler); // Handle setup command with token verification

    // Handle direct messages from users
    bot.on('message', onGenericMessage as UpdateHandler);
};
