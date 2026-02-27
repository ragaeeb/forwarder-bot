import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';

import type { SavedMessage } from '../src/types/app.js';
import { MessageThread } from './MessageThread.js';

const userMessage: SavedMessage = {
    chatId: '123456',
    from: { firstName: 'Alice', userId: '123456' },
    id: 'msg_001',
    text: 'Hello admin!',
    timestamp: '2023-01-01T00:00:00.000Z',
    type: 'user',
};

const adminMessage: SavedMessage = {
    chatId: '123456',
    from: { userId: 'admin' },
    id: 'msg_002',
    text: 'Hi Alice!',
    timestamp: '2023-01-01T00:01:00.000Z',
    type: 'admin',
};

const systemMessage: SavedMessage = {
    chatId: '123456',
    from: { userId: '123456' },
    id: 'msg_003',
    text: 'Message Edit Notification',
    timestamp: '2023-01-01T00:02:00.000Z',
    type: 'system',
};

describe('MessageThread', () => {
    describe('rendering', () => {
        it('should show loading skeleton when isLoading is true', () => {
            render(<MessageThread currentUserId="123456" isLoading={true} messages={[]} />);
            expect(screen.getByTestId('message-thread-loading')).toBeDefined();
            const skeletons = screen.getAllByTestId('message-skeleton');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('should show empty state when messages is empty and not loading', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[]} />);
            expect(screen.getByTestId('message-empty-state')).toBeDefined();
        });

        it('should render messages when provided', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[userMessage, adminMessage]} />);
            expect(screen.getByTestId('message-thread')).toBeDefined();
            expect(screen.getByTestId('message-msg_001')).toBeDefined();
            expect(screen.getByTestId('message-msg_002')).toBeDefined();
        });

        it('should render user messages left-aligned', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[userMessage]} />);
            const msgWrapper = screen.getByTestId('message-msg_001');
            expect(msgWrapper.className).toContain('justify-start');
        });

        it('should render admin messages right-aligned', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[adminMessage]} />);
            const msgWrapper = screen.getByTestId('message-msg_002');
            expect(msgWrapper.className).toContain('justify-end');
        });

        it('should render system messages centered', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[systemMessage]} />);
            const msgWrapper = screen.getByTestId('message-msg_003');
            expect(msgWrapper.className).toContain('justify-center');
        });

        it('should show message text', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[userMessage]} />);
            expect(screen.getByText('Hello admin!')).toBeDefined();
        });

        it('should use indigo background for admin messages', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[adminMessage]} />);
            const bubble = screen.getByTestId('message-msg_002').querySelector('[data-message-type="admin"]');
            expect(bubble?.className).toContain('bg-indigo-600');
        });

        it('should use slate background for user messages', () => {
            render(<MessageThread currentUserId="123456" isLoading={false} messages={[userMessage]} />);
            const bubble = screen.getByTestId('message-msg_001').querySelector('[data-message-type="user"]');
            expect(bubble?.className).toContain('bg-slate-100');
        });
    });
});
