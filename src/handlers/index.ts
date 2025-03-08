import type { Bot, Context, ContextType, DeriveDefinitions, Handler } from 'gramio';

import type { DynamoDBService } from '../services/dynamodb.js';

import { onSetup } from '../commands/setup.js';
import { onStart } from '../commands/start.js';
import { withBot } from '../middlewares/withBot.js';
import { withDB } from '../middlewares/withDB.js';
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

export const registerHandlers = (bot: Bot, db: DynamoDBService) => {
    bot.use(withBot as Middleware);
    bot.use(withDB(db) as Middleware);

    bot.command('start', onStart as CommandHandler);
    bot.command('setup', onSetup as CommandHandler); // Handle setup command with token verification

    // Handle direct messages from users
    bot.on('message', onGenericMessage as UpdateHandler);
};
