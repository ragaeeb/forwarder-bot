'use client';

import { cn } from '../lib/utils';
import { StatusBadge } from './StatusBadge';
import { ScrollArea } from './ui/scroll-area';
import { Skeleton } from './ui/skeleton';

export interface ThreadData {
    createdAt: string;
    lastMessageId: string;
    name: string;
    threadId: string;
    updatedAt: string;
    userId: string;
}

export interface ConversationListProps {
    threads: ThreadData[];
    activeUserId?: string;
    onSelect: (userId: string) => void;
    isLoading: boolean;
    lastMessagePreviews?: Record<string, string>;
    unreadCounts?: Record<string, number>;
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

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

export function ConversationList({
    threads,
    activeUserId,
    onSelect,
    isLoading,
    lastMessagePreviews = {},
    unreadCounts = {},
}: ConversationListProps) {
    if (isLoading) {
        return (
            <ScrollArea className="h-full">
                <div className="space-y-2 p-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 p-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-3 w-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        );
    }

    if (threads.length === 0) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-muted-foreground">
                No conversations yet
            </div>
        );
    }

    return (
        <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
                {threads.map((thread) => {
                    const isActive = activeUserId === thread.userId;
                    const preview = lastMessagePreviews[thread.userId] ?? '';
                    const unread = unreadCounts[thread.userId] ?? 0;

                    return (
                        <button
                            key={thread.threadId}
                            type="button"
                            data-testid={`conversation-${thread.userId}`}
                            onClick={() => onSelect(thread.userId)}
                            className={cn(
                                'flex w-full flex-col gap-1 rounded-lg p-3 text-left transition-colors hover:bg-accent',
                                isActive && 'bg-accent',
                            )}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">{thread.name}</span>
                                <div className="flex shrink-0 items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {formatRelativeTime(thread.updatedAt)}
                                    </span>
                                    <StatusBadge count={unread} />
                                </div>
                            </div>
                            {preview && (
                                <span className="truncate text-sm text-muted-foreground">{truncate(preview, 50)}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </ScrollArea>
    );
}
