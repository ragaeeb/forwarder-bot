import type { DynamoDBService } from '@/services/dynamodb.js';

export const withDB = (db: DynamoDBService) => async (ctx: any, next: () => Promise<void>) => {
    ctx.db = db;
    return await next();
};
