import env from 'env-var';

const getConfig = () => ({
    BOT_TOKEN: env.get('BOT_TOKEN').default('').asString(),
    SECRET_TOKEN: env.get('SECRET_TOKEN').asString(),
    TABLE_NAME: env.get('TABLE_NAME').default('telegram-forwarder-bot-table').asString(),
    DB_DRIVER: env.get('DB_DRIVER').default('sqlite').asEnum(['sqlite', 'turso', 'mongodb']),
    SQLITE_PATH: env.get('SQLITE_PATH').default('./data/forwarder.db').asString(),
    TURSO_DATABASE_URL: env.get('TURSO_DATABASE_URL').asString(),
    TURSO_AUTH_TOKEN: env.get('TURSO_AUTH_TOKEN').asString(),
    MONGODB_URI: env.get('MONGODB_URI').asString(),
    NEXTAUTH_URL: env.get('NEXTAUTH_URL').default('http://localhost:3000').asString(),
});

type Config = ReturnType<typeof getConfig>;

let _config: Config | undefined;

export const config: Config = new Proxy({} as Config, {
    get(_target, prop: string) {
        if (!_config) {
            _config = getConfig();
        }
        return _config[prop as keyof Config];
    },
});
