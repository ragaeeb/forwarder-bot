import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { MessageThread, type SavedMessage } from './MessageThread';

const userMessage: SavedMessage = {
    id: 'm1',
    type: 'user',
    text: 'Hello from user',
    timestamp: new Date().toISOString(),
    chatId: 'c1',
    from: { userId: 'u1', firstName: 'Alice' },
};

const adminMessage: SavedMessage = {
    id: 'm2',
    type: 'admin',
    text: 'Hello from admin',
    timestamp: new Date().toISOString(),
    chatId: 'c1',
    from: { userId: 'u2', firstName: 'Bob' },
};

const systemMessage: SavedMessage = {
    id: 'm3',
    type: 'system',
    text: 'User joined the conversation',
    timestamp: new Date().toISOString(),
    chatId: 'c1',
    from: { userId: 'system', firstName: 'System' },
};

describe('MessageThread', () => {
    it('should render user messages correctly', () => {
        render(<MessageThread messages={[userMessage]} currentUserId="admin" isLoading={false} />);

        expect(screen.getByText('Hello from user')).toBeInTheDocument();
        expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should render admin messages correctly', () => {
        render(<MessageThread messages={[adminMessage]} currentUserId="admin" isLoading={false} />);

        expect(screen.getByText('Hello from admin')).toBeInTheDocument();
        expect(screen.getByText('Bob (admin)')).toBeInTheDocument();
    });

    it('should render system messages correctly', () => {
        render(<MessageThread messages={[systemMessage]} currentUserId="admin" isLoading={false} />);

        expect(screen.getByText('User joined the conversation')).toBeInTheDocument();
        expect(screen.getByText('System')).toBeInTheDocument();
    });

    it('should show loading state with skeleton bubbles', () => {
        render(<MessageThread messages={[]} currentUserId="admin" isLoading={true} />);

        const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
        expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it('should show empty state when no messages', () => {
        render(<MessageThread messages={[]} currentUserId="admin" isLoading={false} />);

        expect(screen.getByText('No messages yet')).toBeInTheDocument();
    });
});
