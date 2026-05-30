import { describe, expect, it, mock } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConversationList, type ThreadData } from './ConversationList';

const mockThreads: ThreadData[] = [
    {
        threadId: 't1',
        userId: 'u1',
        name: 'Alice',
        lastMessageId: 'm1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
    {
        threadId: 't2',
        userId: 'u2',
        name: 'Bob',
        lastMessageId: 'm2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    },
];

describe('ConversationList', () => {
    it('should render threads', () => {
        const onSelect = () => {};
        render(<ConversationList threads={mockThreads} onSelect={onSelect} isLoading={false} />);

        expect(screen.getByText('Alice')).toBeInTheDocument();
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should highlight active thread', () => {
        render(<ConversationList threads={mockThreads} activeUserId="u1" onSelect={() => {}} isLoading={false} />);

        const aliceButton = screen.getByTestId('conversation-u1');
        expect(aliceButton).toHaveClass('bg-accent');
    });

    it('should call onSelect when thread is clicked', () => {
        const onSelect = mock(() => {});
        render(<ConversationList threads={mockThreads} onSelect={onSelect} isLoading={false} />);

        const aliceButton = screen.getByTestId('conversation-u1');
        fireEvent.click(aliceButton);

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect).toHaveBeenCalledWith('u1');
    });

    it('should show loading skeleton when isLoading', () => {
        render(<ConversationList threads={[]} onSelect={() => {}} isLoading={true} />);

        const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
        expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });

    it('should show empty state when no threads', () => {
        render(<ConversationList threads={[]} onSelect={() => {}} isLoading={false} />);

        expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });

    it('should display last message preview when provided', () => {
        render(
            <ConversationList
                threads={mockThreads}
                onSelect={() => {}}
                isLoading={false}
                lastMessagePreviews={{ u1: 'Hello, how are you?' }}
            />,
        );

        expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    });

    it('should display unread badge when count > 0', () => {
        render(
            <ConversationList threads={mockThreads} onSelect={() => {}} isLoading={false} unreadCounts={{ u1: 3 }} />,
        );

        expect(screen.getByText('3')).toBeInTheDocument();
    });
});
