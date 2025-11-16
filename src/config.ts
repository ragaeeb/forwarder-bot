import env from 'env-var';

export type DatabaseProvider = 'mongodb' | 'dynamodb' | 'mock';

export interface BotEnvironmentConfig {
    secretToken?: string;
    token: string;
}

const normalizeBotConfig = (config: Partial<BotEnvironmentConfig>): BotEnvironmentConfig => {
    if (!config.token) {
        throw new Error('Each bot configuration must include a token');
    }

    return {
        secretToken: config.secretToken,
        token: config.token,
    };
};

const parseBotConfigs = (): BotEnvironmentConfig[] => {
    const rawConfig = env.get('BOT_CONFIGS').asString();

    if (rawConfig) {
        try {
            const parsed = JSON.parse(rawConfig);

            if (Array.isArray(parsed)) {
                return parsed.map((entry) => normalizeBotConfig(entry));
            }

            if (parsed && typeof parsed === 'object') {
                return [normalizeBotConfig(parsed as BotEnvironmentConfig)];
            }

            throw new Error('BOT_CONFIGS must be a JSON array or object');
        } catch (error) {
            throw new Error(`Failed to parse BOT_CONFIGS: ${(error as Error).message}`);
        }
    }

    const token = env.get('BOT_TOKEN').required().asString();
    const secretToken = env.get('SECRET_TOKEN').asString();

    return [normalizeBotConfig({ secretToken, token })];
};

const botConfigs = parseBotConfigs();
const botsByToken = Object.fromEntries(botConfigs.map((config) => [config.token, config])) as Record<
    string,
    BotEnvironmentConfig
>;

const databaseProvider = env
    .get('DATABASE_PROVIDER')
    .default('mongodb')
    .asEnum(['mongodb', 'dynamodb', 'mock']) as DatabaseProvider;

const mongoUri =
    databaseProvider === 'mongodb'
        ? env.get('MONGODB_URI').required().asString()
        : env.get('MONGODB_URI').asString();

const mongoDbName = env.get('MONGODB_DB').default('forwarder-bot').asString();

const tableName = env.get('TABLE_NAME').default('telegram-forwarder-bot-table').asString();

export const config = {
    bots: botConfigs,
    botsByToken,
    databaseProvider,
    defaultBot: botConfigs[0],
    dynamo: {
        tableName,
    },
    mongo: {
        dbName: mongoDbName,
        uri: mongoUri,
    },
} as const;
