import { promises as fs } from 'node:fs';
import path from 'node:path';
import { URL, URLSearchParams } from 'node:url';

import { config } from '../src/config.js';

console.log('Setting webhook...');

type Meta = { serviceProviderAwsCfStackOutputs: { OutputKey: string; OutputValue: string }[] };

const data: Record<string, Meta> = JSON.parse(
    await fs.readFile(path.format({ dir: '.serverless', ext: '.json', name: 'meta' }), 'utf-8'),
);
const [meta] = Object.values(data);

const apiUrl = meta?.serviceProviderAwsCfStackOutputs.find((output) => output.OutputKey === 'HttpApiUrl')?.OutputValue;

const url = new URL(`https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`);
{
    const params = new URLSearchParams();
    params.set('url', `${apiUrl}/${config.BOT_TOKEN}`);
    url.search = params.toString();
}

const response = await fetch(url.toString());

if (response.ok) {
    const result = await response.json();
    console.log('Webhook reset...', JSON.stringify(result));
} else {
    console.error('Error resetting webhook.');
}
