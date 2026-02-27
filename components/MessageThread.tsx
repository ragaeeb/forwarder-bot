'use client';

import type { SavedMessage } from '../src/types/app.js';
import { cn } from '../lib/utils.js';

interface Props {
    currentUserId: string;
    isLoading: boolean;
    messages: SavedMessage[];
}

/**
 * Formats a relative timestamp.
 */
function formatTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    } catch {
        return '';
    }
}

/**
 * Renders a single message bubble.
 */
function MessageBubble({ message }: { message: SavedMessage }) {
    if (message.type === 'system') {
        return (
            <div className="flex justify-center my-2" data-testid={`message-${message.id}`}>
                <span className="text-xs text-slate-400 italic bg-slate-50 px-3 py-1 rounded-full">{message.text}</span>
            </div>
        );
    }

    const isAdmin = message.type === 'admin';

    return (
        <div
            className={cn('flex', isAdmin ? 'justify-end' : 'justify-start', 'mb-3')}
            data-testid={`message-${message.id}`}
        >
            <div
                className={cn(
                    'max-w-[75%] rounded-2xl px-4 py-2 shadow-sm',
                    isAdmin ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm',
                )}
                data-message-type={message.type}
            >
                <div className="text-xs font-semibold mb-1 opacity-70">
                    {isAdmin ? 'Admin' : message.from.firstName || message.from.userId}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                {message.caption && <p className="text-xs mt-1 opacity-80">{message.caption}</p>}
                {message.mediaType && <p className="text-xs mt-1 opacity-70">[{message.mediaType}]</p>}
                <div className={cn('text-xs mt-1 opacity-60', isAdmin ? 'text-right' : 'text-left')}>
                    {formatTime(message.timestamp)}
                </div>
            </div>
        </div>
    );
}

/**
 * Chat bubble display for one conversation.
 */
export function MessageThread({ messages, currentUserId: _currentUserId, isLoading }: Props) {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-3 p-4" data-testid="message-thread-loading">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className={cn('h-14 rounded-2xl bg-slate-100 animate-pulse', i % 2 === 0 ? 'ml-16' : 'mr-16')}
                        data-testid="message-skeleton"
                    />
                ))}
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div
                className="flex items-center justify-center h-full text-slate-400 text-sm"
                data-testid="message-empty-state"
            >
                No messages yet
            </div>
        );
    }

    return (
        <div className="flex flex-col p-4 gap-1" data-testid="message-thread">
            {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
            ))}
        </div>
    );
}
