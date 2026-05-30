'use client';

import { Badge } from './ui/badge';

interface StatusBadgeProps {
    count: number;
}

export function StatusBadge({ count }: StatusBadgeProps) {
    if (count <= 0) return null;
    return (
        <Badge variant="destructive" className="text-xs">
            {count > 99 ? '99+' : count}
        </Badge>
    );
}
