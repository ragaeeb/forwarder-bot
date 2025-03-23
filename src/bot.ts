import type { TelegramMessage, TelegramUpdate, TelegramUser } from './types/telegram.js';

import { TelegramAPI } from './services/telegramAPI.js';
import logger from './utils/logger.js';

/**
 * Command handler type
 */
export type CommandHandler = (ctx: Context) => Promise<void> | void;

/**
 * Context object for commands and updates
 */
export interface Context {
    args?: string;
    bot: Bot;
    chat: {
        id: number;
        type: string;
    };
    from: TelegramUser;
    id?: number;
    me: TelegramUser;
    message?: TelegramMessage;
    reply: (text: string) => Promise<TelegramMessage>;
    text?: string;
    update: TelegramUpdate;
}

/**
 * Middleware function type
 */
export type Middleware = (ctx: Context, next: NextFunction) => Promise<void> | void;

export type NextFunction = () => Promise<void>;

/**
 * Update handler type
 */
export type UpdateHandler = (ctx: Context) => Promise<void> | void;

/**
 * Bot class to handle Telegram Bot operations
 */
export class Bot {
    public api: TelegramAPI;
    private commandHandlers: Map<string, CommandHandler[]> = new Map();
    private derives: ((ctx: Context) => Promise<Record<string, any>>)[] = [];
    private me?: TelegramUser;
    private middlewares: Middleware[] = [];
    private token: string;
    private updateHandlers: Map<string, UpdateHandler[]> = new Map();

    /**
     * Create a new Bot instance
     *
     * @param {string} token - Telegram Bot token
     */
    constructor(token: string) {
        this.token = token;
        this.api = new TelegramAPI();
    }

    /**
     * Register a command handler with optional middleware
     *
     * @param {string} command - Command name without slash
     * @param {...(Middleware|CommandHandler)} handlers - Middleware and command handler functions
     * @returns {Bot} - The bot instance for chaining
     */
    command(command: string, ...handlers: (CommandHandler | Middleware)[]): Bot {
        if (!this.commandHandlers.has(command)) {
            this.commandHandlers.set(command, []);
        }

        // The last handler is the command handler, everything before is middleware
        const cmdHandler = handlers.pop() as CommandHandler;
        const middleware = handlers as Middleware[];

        // Store the handler with its middleware chain
        this.commandHandlers.get(command)!.push(async (ctx: Context) => {
            // Create middleware chain
            let index = 0;

            const next = async (): Promise<void> => {
                if (index < middleware.length) {
                    await middleware[index++](ctx, next);
                } else {
                    await cmdHandler(ctx);
                }
            };

            await next();
        });

        return this;
    }

    /**
     * Add a derive function to extend context
     *
     * @param {Function} derive - Function to derive additional context
     * @returns {Bot} - The bot instance for chaining
     */
    derive(derive: (ctx?: any) => Promise<Record<string, any>>): Bot {
        this.derives.push(derive);
        return this;
    }

    /**
     * Process an update
     *
     * @param {TelegramUpdate} update - The update to process
     * @returns {Promise<void>}
     */
    async handleUpdate(update: TelegramUpdate): Promise<void> {
        logger.debug('Processing update', update.update_id);

        try {
            // Determine the update type
            let updateType = null;
            let message = null;

            if (update.message) {
                updateType = 'message';
                message = update.message;
            } else if (update.edited_message) {
                updateType = 'edited_message';
                message = update.edited_message;
            }

            if (!updateType || !message) {
                logger.warn('Unsupported update type', update);
                return;
            }

            // Parse command if present
            let command: null | string = null;
            let args: string | undefined;

            if (message.text && message.text.startsWith('/')) {
                const parts = message.text.slice(1).split(' ');
                command = parts[0];
                args = parts.length > 1 ? parts.slice(1).join(' ') : undefined;
            }

            // Create base context
            const baseContext: Context = {
                args,
                bot: this,
                chat: message.chat && {
                    id: message.chat.id,
                    type: message.chat.type,
                },
                from: {
                    first_name: message.from?.first_name,
                    id: message.from?.id,
                    is_bot: message.from?.is_bot,
                    last_name: message.from?.last_name,
                    username: message.from?.username,
                } as TelegramUser,
                id: message.message_id,
                me: this.me!,
                message,
                reply: async (text: string) => {
                    return this.api.sendMessage({
                        chat_id: message.chat.id,
                        message_thread_id: message.message_thread_id,
                        text,
                    });
                },
                text: message.text,
                update,
            };

            // Apply derives
            let context = { ...baseContext };
            for (const derive of this.derives) {
                const derived = await derive(context);
                context = { ...context, ...derived };
            }

            // Apply middlewares
            let middlewareIndex = 0;
            const runMiddleware = async (): Promise<void> => {
                if (middlewareIndex < this.middlewares.length) {
                    const middleware = this.middlewares[middlewareIndex++];
                    await middleware(context, runMiddleware);
                } else {
                    // Process command or update after middlewares
                    if (command && this.commandHandlers.has(command)) {
                        for (const handler of this.commandHandlers.get(command)!) {
                            await handler(context);
                        }
                    } else if (updateType && this.updateHandlers.has(updateType)) {
                        for (const handler of this.updateHandlers.get(updateType)!) {
                            await handler(context);
                        }
                    }
                }
            };

            await runMiddleware();
        } catch (error) {
            logger.error('Error handling update', error);
        }
    }

    /**
     * Initialize the bot
     *
     * @returns {Promise<TelegramUser>} - Bot info
     */
    async init(): Promise<TelegramUser> {
        if (!this.me) {
            this.me = await this.api.getMe();
            logger.info(`Bot initialized: @${this.me.username}`);
        }
        return this.me;
    }

    /**
     * Register an update handler with optional middleware
     *
     * @param {string} updateType - Update type ('message', 'edited_message', etc.)
     * @param {...(Middleware|UpdateHandler)} handlers - Middleware and update handler functions
     * @returns {Bot} - The bot instance for chaining
     */
    on(updateType: string, ...handlers: (Middleware | UpdateHandler)[]): Bot {
        if (!this.updateHandlers.has(updateType)) {
            this.updateHandlers.set(updateType, []);
        }

        // The last handler is the update handler, everything before is middleware
        const updateHandler = handlers.pop() as UpdateHandler;
        const middleware = handlers as Middleware[];

        // Store the handler with its middleware chain
        this.updateHandlers.get(updateType)!.push(async (ctx: Context) => {
            // Create middleware chain
            let index = 0;

            const next = async (): Promise<void> => {
                if (index < middleware.length) {
                    await middleware[index++](ctx, next);
                } else {
                    await updateHandler(ctx);
                }
            };

            await next();
        });

        return this;
    }

    /**
     * Start the bot
     *
     * @returns {Promise<TelegramUser>} - Bot info
     */
    async start(): Promise<TelegramUser> {
        await this.init();
        logger.info(`Bot @${this.me?.username} started`);
        return this.me!;
    }

    /**
     * Stop the bot
     *
     * @returns {Promise<void>}
     */
    async stop(): Promise<void> {
        logger.info('Bot stopped');
    }

    /**
     * Add a middleware function
     *
     * @param {Middleware} middleware - Middleware function
     * @returns {Bot} - The bot instance for chaining
     */
    use(middleware: Middleware): Bot {
        this.middlewares.push(middleware);
        return this;
    }
}
