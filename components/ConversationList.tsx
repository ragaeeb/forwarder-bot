'use client';

import { cn } from '../lib/utils.js';
import type { ThreadData } from '../src/types/app.js';
import { StatusBadge } from './StatusBadge.js';

interface Props {
    activeUserId?: string;
    isLoading: boolean;
    onSelect: (userId: string) => void;
    threads: ThreadData[];
}

/**
 * Formats a relative timestamp for display.
 */
function formatRelativeTime(isoString: string): string {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    } catch {
        return '';
    }
}

/**
 * Sidebar list of user conversations.
 */
export function ConversationList({ threads, activeUserId, onSelect, isLoading }: Props) {
    if (isLoading) {
        return (
            <div className="flex flex-col gap-2 p-4" data-testid="conversation-list-loading">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" data-testid="skeleton" />
                ))}
            </div>
        );
    }

    if (threads.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center p-8 text-center text-slate-500"
                data-testid="empty-state"
            >
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1">Messages will appear here once users start chatting.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col" data-testid="conversation-list">
            {threads.map((thread) => (
                <button
                    className={cn(
                        'flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors border-b border-slate-100',
                        activeUserId === thread.userId && 'bg-indigo-50 border-l-2 border-l-indigo-600',
                    )}
                    data-testid={`thread-item-${thread.userId}`}
                    key={thread.userId}
                    onClick={() => onSelect(thread.userId)}
                    type="button"
                >
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800 truncate">{thread.name}</span>
                            <span className="text-xs text-slate-400 shrink-0">
                                {formatRelativeTime(thread.updatedAt)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-slate-500 truncate">ID: {thread.userId}</span>
                            <StatusBadge unreadCount={thread.unreadCount} />
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
