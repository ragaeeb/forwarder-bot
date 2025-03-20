import env from 'env-var';

export const config = {
    BOT_TOKEN: env.get('BOT_TOKEN').required().asString(),
    SECRET_TOKEN: env.get('SECRET_TOKEN').asString(),
    TABLE_NAME: env.get('TABLE_NAME').default('telegram-forwarder-bot-table').asString(),
};
