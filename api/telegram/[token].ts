import type { IncomingMessage, ServerResponse } from 'node:http';

import { processWebhookUpdate } from '../../src/webhook.js';

type VercelRequest = IncomingMessage & {
    body?: unknown;
    query: Record<string, string | string[]>;
};

type VercelResponse = ServerResponse & {
    status: (statusCode: number) => VercelResponse;
    send: (body: string) => VercelResponse;
};

const readBody = async (req: VercelRequest): Promise<string | undefined> => {
    if (typeof req.body === 'string') {
        return req.body;
    }

    if (Buffer.isBuffer(req.body)) {
        return req.body.toString('utf-8');
    }

    if (req.body && typeof req.body === 'object') {
        return JSON.stringify(req.body);
    }

    return new Promise<string | undefined>((resolve, reject) => {
        let data = '';

        req.on('data', (chunk) => {
            data += chunk;
        });

        req.on('end', () => {
            resolve(data || undefined);
        });

        req.on('error', (error) => {
            reject(error);
        });
    });
};

const normalizeHeaders = (headers: IncomingMessage['headers']): Record<string, string | undefined> => {
    return Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value ?? undefined,
        ]),
    );
};

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const tokenParam = req.query.token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam ?? '';
    const headers = normalizeHeaders(req.headers);

    try {
        const body = await readBody(req);
        const result = await processWebhookUpdate({ body, headers, token });

        res.setHeader('content-type', 'application/json');
        res.status(result.statusCode).send(result.body);
    } catch (error: any) {
        res.status(500).send(
            JSON.stringify({ error: error?.message || String(error), ok: false }),
        );
    }
}
