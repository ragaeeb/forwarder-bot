import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import logger from '@/utils/logger.js';

import { Bot } from './bot.js';
import { config, type BotEnvironmentConfig } from './config.js';
import { registerHandlers } from './handlers/index.js';
import { DynamoDBService } from './services/dynamodb.js';
import { MongoDataService } from './services/mongodb.js';
import { MockDataService } from './services/mockDataService.js';
import type { DataService } from './services/types.js';
import { TelegramAPI } from './services/telegramAPI.js';

interface BotInstance {
    bot: Bot;
    dataService: DataService;
    secretToken?: string;
    username: string;
}

interface ProcessWebhookOptions {
    body?: string | null;
    headers: Record<string, string | undefined>;
    token: string;
}

interface WebhookResult {
    body: string;
    statusCode: number;
}

let mockDatabaseFactory: ((botUsername: string) => DataService) | undefined;
const botCache = new Map<string, Promise<BotInstance>>();

const buildResponse = (statusCode: number, payload: Record<string, unknown>): WebhookResult => ({
    body: JSON.stringify(payload),
    statusCode,
});

const normalizeHeaders = (headers: APIGatewayProxyEvent['headers']): Record<string, string | undefined> => {
    return Object.fromEntries(
        Object.entries(headers || {}).map(([key, value]) => [key.toLowerCase(), value ?? undefined]),
    );
};

const getHeaderValue = (headers: Record<string, string | undefined>, headerName: string) => {
    return headers[headerName.toLowerCase()];
};

const createDataService = (botUsername: string): DataService => {
    if (mockDatabaseFactory) {
        return mockDatabaseFactory(botUsername);
    }

    switch (config.databaseProvider) {
        case 'mongodb':
            return new MongoDataService(botUsername);
        case 'dynamodb':
            return new DynamoDBService(botUsername);
        case 'mock':
            return new MockDataService(botUsername);
        default:
            throw new Error(`Unsupported database provider: ${config.databaseProvider}`);
    }
};

const initBot = async (token: string, botConfig: BotEnvironmentConfig): Promise<BotInstance> => {
    logger.info({ token: token.slice(0, 6) }, 'Bootstrapping bot instance');

    const bot = new Bot(token);
    const me = await bot.api.getMe();

    if (!me.username) {
        throw new Error('Bot username is required to initialize handlers');
    }

    bot.username = me.username;

    const dataService = createDataService(me.username);
    registerHandlers(bot, dataService);

    return {
        bot,
        dataService,
        secretToken: botConfig.secretToken,
        username: me.username,
    };
};

const resolveBotInstance = async (token: string): Promise<BotInstance> => {
    const botConfig = config.botsByToken[token];

    if (!botConfig) {
        throw Object.assign(new Error('Bot token is not configured'), { statusCode: 404 });
    }

    if (!botCache.has(token)) {
        const instancePromise = initBot(token, botConfig).catch((error) => {
            botCache.delete(token);
            throw error;
        });

        botCache.set(token, instancePromise);
    }

    return botCache.get(token)!;
};

export const setMockDatabase = (db?: DataService | ((botUsername: string) => DataService)) => {
    if (!db) {
        mockDatabaseFactory = undefined;
    } else {
        mockDatabaseFactory = typeof db === 'function' ? db : () => db;
    }

    botCache.clear();
};

export const processWebhookUpdate = async ({ body, headers, token }: ProcessWebhookOptions): Promise<WebhookResult> => {
    logger.info({ token: token.slice(0, 6) }, 'Webhook invoked');

    if (!token) {
        return buildResponse(400, { error: 'Missing bot token', ok: false });
    }

    const botConfig = config.botsByToken[token];

    if (!botConfig) {
        logger.warn({ token: token.slice(0, 6) }, 'Received webhook for unknown bot token');
        return buildResponse(404, { error: 'Bot not configured', ok: false });
    }

    const providedSecret = getHeaderValue(headers, 'x-telegram-bot-api-secret-token');

    if (botConfig.secretToken && providedSecret !== botConfig.secretToken) {
        logger.warn({ token: token.slice(0, 6) }, 'Invalid secret token in webhook request');
        return buildResponse(403, { error: 'Unauthorized', ok: false });
    }

    try {
        const { bot } = await resolveBotInstance(token);

        if (body) {
            logger.info({ token: token.slice(0, 6) }, 'Processing Telegram update');
            await bot.handleUpdate(JSON.parse(body));
        } else {
            logger.debug('Skipping update due to empty body');
        }

        return buildResponse(200, { ok: true });
    } catch (error: any) {
        logger.error({ error, token: token.slice(0, 6) }, 'Error processing webhook');
        return buildResponse(200, { error: error.message || String(error), ok: false });
    }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    process.on('uncaughtException', (err) => {
        logger.error(err, 'Uncaught Exception:');
        logger.error(err.stack, 'Stack trace:');
    });

    const headers = normalizeHeaders(event.headers);
    const token = event.pathParameters?.token || event.queryStringParameters?.token;

    return processWebhookUpdate({ body: event.body, headers, token: token || '' });
};

export const initWebhook = async (apiUrl: string, token?: string): Promise<boolean> => {
    const resolvedToken = token || config.defaultBot?.token;

    if (!resolvedToken) {
        throw new Error('No bot token configured for webhook initialization');
    }

    const botConfig = config.botsByToken[resolvedToken];
    const telegramAPI = new TelegramAPI(resolvedToken);

    return telegramAPI.setWebhook({
        drop_pending_updates: true,
        secret_token: botConfig?.secretToken,
        url: `${apiUrl}/${resolvedToken}`,
    });
};

export const resetHook = async (token?: string): Promise<boolean> => {
    const resolvedToken = token || config.defaultBot?.token;

    if (!resolvedToken) {
        throw new Error('No bot token configured for webhook removal');
    }

    const telegramAPI = new TelegramAPI(resolvedToken);

    return telegramAPI.deleteWebhook({
        drop_pending_updates: true,
    });
};
