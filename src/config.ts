import env from 'env-var';

/**
 * Application configuration object.
 * Loads and validates environment variables for the application.
 *
 * @property {string} BOT_TOKEN - The Telegram bot token used for authentication with the Telegram API
 * @property {string} SECRET_TOKEN - Optional token for webhook validation
 * @property {string} TABLE_NAME - The DynamoDB table name for storing bot data (migration only)
 * @property {string} DB_DRIVER - Database driver: "sqlite" | "turso" | "mongodb"
 * @property {string} SQLITE_PATH - Path to SQLite database file
 * @property {string} TURSO_DATABASE_URL - Turso/libSQL database URL
 * @property {string} TURSO_AUTH_TOKEN - Turso/libSQL auth token
 * @property {string} MONGODB_URI - MongoDB connection URI
 * @property {string} NEXTAUTH_URL - Base URL for the app (used for webhook construction)
 */
export const config = {
    BOT_TOKEN: env.get('BOT_TOKEN').required().asString(),
    DB_DRIVER: env.get('DB_DRIVER').default('sqlite').asString() as 'mongodb' | 'sqlite' | 'turso',
    MONGODB_URI: env.get('MONGODB_URI').default('mongodb://localhost:27017/forwarder-bot').asString(),
    NEXTAUTH_URL: env.get('NEXTAUTH_URL').default('http://localhost:3000').asString(),
    SECRET_TOKEN: env.get('SECRET_TOKEN').asString(),
    SQLITE_PATH: env.get('SQLITE_PATH').default('./data/forwarder.db').asString(),
    TABLE_NAME: env.get('TABLE_NAME').default('telegram-forwarder-bot-table').asString(),
    TURSO_AUTH_TOKEN: env.get('TURSO_AUTH_TOKEN').asString(),
    TURSO_DATABASE_URL: env.get('TURSO_DATABASE_URL').asString(),
};
