import env from 'env-var';

export const config = {
    BOT_TOKEN: env.get('BOT_TOKEN').required().asString(),
    TABLE_NAME: env.get('TABLE_NAME').default('telegram-forwarder-bot-table').asString(),
};
