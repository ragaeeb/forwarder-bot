import type { DynamoDBService } from '@/services/dynamodb.js';
import type { ForwardContext } from '@/types.js';

export const withDB = (db: DynamoDBService) => {
    return (ctx: ForwardContext, next: () => Promise<void>) => {
        ctx.db = db;
        return next();
    };
};
