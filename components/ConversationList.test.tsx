import { describe, expect, it, mock } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';

import type { ThreadData } from '../src/types/app.js';
import { ConversationList } from './ConversationList.js';

const sampleThreads: ThreadData[] = [
    {
        createdAt: '2023-01-01T00:00:00.000Z',
        lastMessageId: 'msg_001',
        name: 'Alice Smith',
        threadId: '11111',
        unreadCount: 3,
        updatedAt: '2023-01-02T00:00:00.000Z',
        userId: '123456',
    },
    {
        createdAt: '2023-01-01T00:00:00.000Z',
        lastMessageId: 'msg_002',
        name: 'Bob Jones',
        threadId: '22222',
        unreadCount: 0,
        updatedAt: '2023-01-01T12:00:00.000Z',
        userId: '789012',
    },
];

describe('ConversationList', () => {
    describe('rendering', () => {
        it('should render a list of threads', () => {
            render(<ConversationList isLoading={false} onSelect={mock(() => {})} threads={sampleThreads} />);
            expect(screen.getByTestId('conversation-list')).toBeDefined();
            expect(screen.getByTestId('thread-item-123456')).toBeDefined();
            expect(screen.getByTestId('thread-item-789012')).toBeDefined();
        });

        it('should show thread names', () => {
            render(<ConversationList isLoading={false} onSelect={mock(() => {})} threads={sampleThreads} />);
            expect(screen.getByText('Alice Smith')).toBeDefined();
            expect(screen.getByText('Bob Jones')).toBeDefined();
        });

        it('should show loading skeleton when isLoading is true', () => {
            render(<ConversationList isLoading={true} onSelect={mock(() => {})} threads={[]} />);
            expect(screen.getByTestId('conversation-list-loading')).toBeDefined();
            const skeletons = screen.getAllByTestId('skeleton');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('should show empty state when threads is empty and not loading', () => {
            render(<ConversationList isLoading={false} onSelect={mock(() => {})} threads={[]} />);
            expect(screen.getByTestId('empty-state')).toBeDefined();
        });

        it('should highlight the active thread', () => {
            render(
                <ConversationList
                    activeUserId="123456"
                    isLoading={false}
                    onSelect={mock(() => {})}
                    threads={sampleThreads}
                />,
            );
            const activeItem = screen.getByTestId('thread-item-123456');
            expect(activeItem.className).toContain('bg-indigo-50');
        });

        it('should show unread badge for threads with unread messages', () => {
            render(<ConversationList isLoading={false} onSelect={mock(() => {})} threads={sampleThreads} />);
            const badge = screen.getByTestId('status-badge');
            expect(badge.textContent).toBe('3');
        });
    });

    describe('interaction', () => {
        it('should call onSelect when a thread is clicked', () => {
            const onSelect = mock(() => {});
            render(<ConversationList isLoading={false} onSelect={onSelect} threads={sampleThreads} />);
            fireEvent.click(screen.getByTestId('thread-item-123456'));
            expect(onSelect).toHaveBeenCalledWith('123456');
        });

        it('should call onSelect with correct userId for different threads', () => {
            const onSelect = mock(() => {});
            render(<ConversationList isLoading={false} onSelect={onSelect} threads={sampleThreads} />);
            fireEvent.click(screen.getByTestId('thread-item-789012'));
            expect(onSelect).toHaveBeenCalledWith('789012');
        });
    });
});
