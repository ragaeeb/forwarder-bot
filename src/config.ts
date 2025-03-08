import env from 'env-var';
import process from 'node:process';

export const config = {
    BOT_TOKEN: env.get('BOT_TOKEN').required().asString(),
    NODE_ENV: env.get('NODE_ENV').default('development').asEnum(['development', 'dev', 'production', 'prod', 'test']),
    TABLE_NAME: env
        .get('TABLE_NAME')
        .default(`telegram-forwarder-bot-${process.env.NODE_ENV || 'dev'}-threads`)
        .asString(),
};
