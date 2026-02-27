'use client';

import { cn } from '../lib/utils.js';

interface StatusBadgeProps {
    unreadCount?: number;
    className?: string;
}

/**
 * Displays an unread count badge. Shows nothing when unreadCount is 0 or undefined.
 */
export function StatusBadge({ unreadCount, className }: StatusBadgeProps) {
    if (!unreadCount || unreadCount <= 0) return null;

    return (
        <span
            className={cn(
                'inline-flex items-center justify-center rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-semibold text-white',
                className,
            )}
            data-testid="status-badge"
        >
            {unreadCount > 99 ? '99+' : unreadCount}
        </span>
    );
}
