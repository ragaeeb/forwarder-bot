# Telegram Forwarder Bot Setup Guide

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/6a20ebdb-2180-45e8-b924-c7ca363bbf5b.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/6a20ebdb-2180-45e8-b924-c7ca363bbf5b)

This guide will help you set up a Telegram bot that forwards messages between users and a group with topics.

## Features

- Users can send messages to the bot, which forwards them to a specified Telegram group
- For each unique user, the bot creates a new topic in the group
- Subsequent messages from the same user are forwarded to their existing topic
- Group members can reply to forwarded messages, and the replies are sent back to the user
- The bot maintains anonymity of the group members by sending all responses through the bot
- Persistent storage of user-thread relationships and message history using DynamoDB
- Message history can be used later to build a web interface for admins

## Prerequisites

- Bun `v1.0.25` or later
- An AWS account for serverless deployment
- A Telegram bot token (obtained from [@BotFather](https://t.me/BotFather))
- A Telegram group with topics enabled

## Setup Instructions

### 1. Create a Telegram Bot

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram
2. Use the `/newbot` command to create a new bot
3. Follow the instructions and save your bot token

### 2. Create a Telegram Group with Topics

1. Create a new group in Telegram
2. Go to group settings and enable "Topics"
3. Add your bot to the group as an administrator with these permissions:
    - Manage topics
    - Send messages
    - Read messages

### 3. Get Group ID

1. Send a message to the group
2. Forward this message to [@getidsbot](https://t.me/getidsbot)
3. Note the "Forwarded from chat" ID (will be negative, like `-1001234567890`)

### 4. Configure AWS Credentials

1. Configure AWS CLI with your credentials:

    ```bash
    aws configure
    ```

2. Make sure your credentials have permissions to create and access DynamoDB tables

### 5. Clone and Configure the Project

1. Clone the repository:

    ```bash
    git clone https://github.com/yourusername/telegram-forwarder-bot.git
    cd telegram-forwarder-bot
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Create a `.env` file from the example:

    ```bash
    cp .env.example .env
    ```

4. Edit the `.env` file with your configuration:
    ```
    BOT_TOKEN=your_bot_token_here
    CONTACT_GROUP_ID=your_group_id_here
    NODE_ENV=development
    ```

### 6. Local Development (Optional)

Run the bot locally for testing:

```bash
bun run dev
```

### 7. Deploy to AWS

1. Configure AWS credentials:

    ```bash
    aws configure
    ```

2. Deploy the bot:

    ```bash
    bun run deploy
    ```

3. After deployment, you'll receive a webhook URL from the Serverless Framework output.

4. Set the webhook URL for your bot (replace values with your own):
    ```bash
    curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook?url={YOUR_WEBHOOK_URL}/{YOUR_BOT_TOKEN}"
    ```

## Usage

1. Users can start a conversation with your bot
2. When a user sends a message, it creates a new topic in your group
3. Team members can reply to messages in the group, and replies are sent back to the user
4. The bot handles the mapping between users and topics automatically

## Environment Variables

| Variable         | Description                                  | Required | Default     |
| ---------------- | -------------------------------------------- | -------- | ----------- |
| BOT_TOKEN        | Telegram Bot API token                       | Yes      | -           |
| CONTACT_GROUP_ID | ID of the group where messages are forwarded | Yes      | -           |
| REDIS_URL        | URL for Redis connection                     | Yes      | -           |
| NODE_ENV         | Environment (development/production)         | No       | development |
| SENTRY_DSN       | Sentry DSN for error tracking                | No       | -           |
| LOG_LEVEL        | Logging level (debug/info/warn/error)        | No       | info        |
| API_URL          | API Gateway URL after deployment             | No       | -           |

## Customization

- To customize the welcome message, edit the response in the `"start"` command handler in `src/handlers.ts`
- To support additional message types, add handling in the `replyToUser` function in `src/handlers.ts`

## Advanced Configuration

### Security

The bot accepts requests only from Telegram's official API. For additional security:

1. Add IP restrictions in AWS API Gateway
2. Consider implementing a token validation mechanism

### Scaling

The serverless architecture automatically scales with usage. For high-volume applications:

1. Consider optimizing Redis connections
2. Implement caching strategies
3. Monitor AWS Lambda concurrent executions

## Troubleshooting

### Common Issues

1. **Bot doesn't respond**: Check if the webhook is set correctly
2. **Redis connection errors**: Verify Redis URL and network access
3. **Missing thread information**: Check Redis data persistence
4. **Deployment failures**: Ensure AWS credentials are configured correctly

### Logs

Access AWS CloudWatch logs for detailed error information.
