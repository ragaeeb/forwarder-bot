'use client';

import { cn } from '../lib/utils';
import { Skeleton } from './ui/skeleton';

export interface SavedMessage {
    caption?: string;
    chatId: string;
    forwardOrigin?: unknown;
    from: {
        firstName?: string;
        lastName?: string;
        userId: string;
        username?: string;
    };
    id: string;
    mediaId?: string;
    mediaType?: string;
    originalMessageId?: string;
    quote?: string;
    replyToMessageId?: string;
    text: string;
    timestamp: string;
    type: 'admin' | 'user' | 'system';
}

export interface MessageThreadProps {
    messages: SavedMessage[];
    currentUserId: string;
    isLoading: boolean;
}

function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function getSenderLabel(message: SavedMessage): string {
    if (message.type === 'system') return 'System';
    const { firstName, lastName, username } = message.from;
    const name = [firstName, lastName].filter(Boolean).join(' ') || username || 'Unknown';
    return message.type === 'admin' ? `${name} (admin)` : name;
}

export function MessageThread({ messages, currentUserId: _currentUserId, isLoading }: MessageThreadProps) {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-4">
                <div className="flex justify-start">
                    <Skeleton className="h-16 w-48 rounded-lg" />
                </div>
                <div className="flex justify-end">
                    <Skeleton className="h-16 w-56 rounded-lg" />
                </div>
                <div className="flex justify-start">
                    <Skeleton className="h-12 w-32 rounded-lg" />
                </div>
            </div>
        );
    }

    if (messages.length === 0) {
        return <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground">No messages yet</div>;
    }

    return (
        <div className="flex flex-col gap-4 p-4">
            {messages.map((message) => {
                if (message.type === 'system') {
                    return (
                        <div key={message.id} className="flex flex-col items-center justify-center">
                            <span className="mb-1 text-xs font-medium text-muted-foreground">
                                {getSenderLabel(message)}
                            </span>
                            <div className="rounded-lg bg-muted px-4 py-2 text-center">
                                <p className="text-sm italic text-muted-foreground">{message.text}</p>
                                <span className="text-xs text-muted-foreground">
                                    {formatRelativeTime(message.timestamp)}
                                </span>
                            </div>
                        </div>
                    );
                }

                const isAdmin = message.type === 'admin';

                return (
                    <div
                        key={message.id}
                        className={cn('flex max-w-[80%] flex-col', isAdmin ? 'self-end' : 'self-start')}
                    >
                        <span className="mb-1 text-xs font-medium text-muted-foreground">
                            {getSenderLabel(message)}
                        </span>
                        <div
                            className={cn(
                                'rounded-lg px-4 py-2',
                                isAdmin
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100',
                            )}
                        >
                            <p className="text-sm">{message.text}</p>
                        </div>
                        <span className="mt-1 text-xs text-muted-foreground">
                            {formatRelativeTime(message.timestamp)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
