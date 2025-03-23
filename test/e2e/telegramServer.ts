import { TelegramChat, TelegramMessage, TelegramUpdate, TelegramUser } from '../../src/types/telegram';

/**
 * Mock server for Telegram API during tests
 */
export class TelegramTestServer {
    private botInfo: TelegramUser = {
        first_name: 'TestBot',
        id: 12345,
        is_bot: true,
        username: 'test_bot',
    };
    private interceptFetch: (originalFetch: typeof fetch) => typeof fetch;
    private requests: { method: string; params: any }[] = [];
    private responses: Map<string, (params?: any) => any> = new Map();

    constructor(botInfo?: Partial<TelegramUser>) {
        if (botInfo) {
            this.botInfo = { ...this.botInfo, ...botInfo };
        }

        // Setup default responses
        this.setupDefaultResponses();

        // Create fetch interceptor
        this.interceptFetch = (originalFetch) => {
            return async (input: RequestInfo | URL, init?: RequestInit) => {
                // Only intercept telegram API calls
                const url = input.toString();
                if (url.includes('/bot')) {
                    // Extract method name from URL
                    const methodMatch = url.match(/\/bot[^/]+\/([^?]+)/);
                    if (!methodMatch) {
                        throw new Error(`Invalid Telegram API URL: ${url}`);
                    }

                    const method = methodMatch[1];
                    let params = {};

                    // Extract params from body
                    if (init?.body) {
                        params = JSON.parse(init.body.toString());
                    }

                    // Record the request
                    this.requests.push({ method, params });

                    // Get response handler
                    const responseHandler = this.responses.get(method);
                    if (!responseHandler) {
                        return new Response(
                            JSON.stringify({
                                description: `No handler for method: ${method}`,
                                ok: false,
                            }),
                            { status: 404 },
                        );
                    }

                    // Get response
                    const responseData = responseHandler(params);

                    return new Response(
                        JSON.stringify({
                            ok: true,
                            result: responseData,
                        }),
                        { status: 200 },
                    );
                }

                // Pass through non-telegram requests
                return originalFetch(input, init);
            };
        };
    }

    /**
     * Clear recorded requests
     */
    clearRequests() {
        this.requests = [];
    }

    /**
     * Create a user update to simulate a message from a user
     */
    createUserMessage(options: {
        chatId?: number;
        firstName?: string;
        isGroupChat?: boolean;
        lastName?: string;
        messageId?: number;
        text?: string;
        userId?: number;
        username?: string;
    }): TelegramUpdate {
        const userId = options.userId || 987654;
        const chatId = options.chatId || options.userId || 987654;
        const messageId = options.messageId || Math.floor(Math.random() * 10000);
        const isGroupChat = options.isGroupChat || false;

        const user: TelegramUser = {
            first_name: options.firstName || 'Test',
            id: userId,
            is_bot: false,
            last_name: options.lastName,
            username: options.username || 'testuser',
        };

        const chat: TelegramChat = isGroupChat
            ? {
                  id: -Math.abs(chatId),
                  is_forum: true,
                  title: 'Test Group',
                  type: 'supergroup',
              }
            : {
                  first_name: user.first_name,
                  id: chatId,
                  last_name: user.last_name,
                  type: 'private',
                  username: user.username,
              };

        const message: TelegramMessage = {
            chat: chat,
            date: Math.floor(Date.now() / 1000),
            from: user,
            message_id: messageId,
            text: options.text || 'Test message',
        };

        return {
            message,
            update_id: Math.floor(Math.random() * 1000000),
        };
    }

    /**
     * Get all recorded requests
     */
    getRequests() {
        return [...this.requests];
    }

    /**
     * Install the mock server
     */
    install() {
        // Store original fetch
        const originalFetch = global.fetch;

        // Replace global fetch with interceptor
        global.fetch = this.interceptFetch(originalFetch) as typeof fetch;

        return () => {
            // Restore original fetch
            global.fetch = originalFetch;
        };
    }

    /**
     * Simulate sending an update to the bot
     */
    async sendUpdate(update: TelegramUpdate) {
        // Add update to getUpdates response
        const currentHandler = this.responses.get('getUpdates')!;
        this.responses.set('getUpdates', () => [update]);

        // Reset after one call
        setTimeout(() => {
            this.responses.set('getUpdates', currentHandler);
        }, 1000);
    }

    /**
     * Set custom response for a method
     */
    setResponse(method: string, handler: (params?: any) => any) {
        this.responses.set(method, handler);
    }

    /**
     * Setup default responses for common API methods
     */
    private setupDefaultResponses() {
        // getMe response
        this.responses.set('getMe', () => this.botInfo);

        // sendMessage response
        this.responses.set('sendMessage', (params) => ({
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            from: this.botInfo,
            message_id: Math.floor(Math.random() * 10000),
            text: params.text,
        }));

        // forwardMessage response
        this.responses.set('forwardMessage', (params) => ({
            chat: {
                id: params.chat_id,
                type: params.chat_id < 0 ? 'supergroup' : 'private',
            },
            date: Math.floor(Date.now() / 1000),
            forward_origin: {
                date: Math.floor(Date.now() / 1000),
                type: 'user',
            },
            from: this.botInfo,
            message_id: Math.floor(Math.random() * 10000),
            text: 'Forwarded message',
        }));

        // createForumTopic response
        this.responses.set('createForumTopic', (params) => ({
            icon_color: 7322096,
            message_thread_id: Math.floor(Math.random() * 1000),
            name: params.name,
        }));

        // deleteForumTopic response
        this.responses.set('deleteForumTopic', () => true);

        // deleteWebhook response
        this.responses.set('deleteWebhook', () => true);

        // getUpdates response - empty by default
        this.responses.set('getUpdates', () => []);

        // getChatMember response
        this.responses.set('getChatMember', () => ({
            status: 'administrator',
            user: this.botInfo,
        }));
    }
}
