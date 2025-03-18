import { config } from '../src/config.js';

console.log('Resetting webhook...');

const response = await fetch(`https://api.telegram.org/bot${config.BOT_TOKEN}/setWebhook`);

if (response.ok) {
    const result = await response.json();
    console.log('Webhook reset...', JSON.stringify(result));
} else {
    console.error('Error resetting webhook.');
}
