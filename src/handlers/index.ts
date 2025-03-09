import type { DynamoDBService } from '@/services/dynamodb.js';
import type { ForwardContext } from '@/types.js';
import type { Bot, Context, ContextType, DeriveDefinitions, Handler } from 'gramio';

import { onSetup } from '@/commands/setup.js';
import { onStart } from '@/commands/start.js';

import { onGenericMessage } from './genericMessage.js';

type CommandHandler = (
    context: ContextType<any, 'message'> &
        DeriveDefinitions['global'] &
        DeriveDefinitions['message'] & {
            args: null | string;
        },
) => unknown;
type Middleware = Handler<Context<any> & DeriveDefinitions['global']>;
type UpdateHandler = Handler<ContextType<any, any> & DeriveDefinitions & DeriveDefinitions['global']>;

const withBot = async (ctx: ForwardContext, next: () => Promise<void>) => {
    const me = await ctx.api?.getMe();
    ctx.me = me;

    if (ctx.from?.id !== ctx.me?.id) {
        return next();
    }
};

const withDB = (db: DynamoDBService) => {
    return (ctx: ForwardContext, next: () => Promise<void>) => {
        ctx.db = db;
        return next();
    };
};

export const registerHandlers = (bot: Bot, db: DynamoDBService) => {
    bot.use(withBot as Middleware);
    bot.use(withDB(db) as Middleware);

    bot.command('start', onStart as CommandHandler);
    bot.command('setup', onSetup as CommandHandler); // Handle setup command with token verification

    // Handle direct messages from users
    bot.on('message', onGenericMessage as UpdateHandler);
};
