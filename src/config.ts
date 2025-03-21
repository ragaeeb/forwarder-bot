import env from 'env-var';

/**
 * Application configuration object.
 * Loads and validates environment variables for the application.
 *
 * @property {string} BOT_TOKEN - The Telegram bot token used for authentication with the Telegram API
 * @property {string} SECRET_TOKEN - Optional token for webhook validation
 * @property {string} TABLE_NAME - The DynamoDB table name for storing bot data
 */
export const config = {
    BOT_TOKEN: env.get('BOT_TOKEN').required().asString(),
    SECRET_TOKEN: env.get('SECRET_TOKEN').asString(),
    TABLE_NAME: env.get('TABLE_NAME').default('telegram-forwarder-bot-table').asString(),
};
