import { describe, expect, it, mock } from 'bun:test';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReplyComposer } from './ReplyComposer';

describe('ReplyComposer', () => {
    it('should update state when typing', async () => {
        const user = userEvent.setup();
        render(<ReplyComposer userId="u1" onReply={async () => {}} />);

        const textarea = screen.getByPlaceholderText('Type your reply...');
        await user.type(textarea, 'Hello');

        expect(textarea).toHaveValue('Hello');
    });

    it('should have submit disabled when text is empty', () => {
        render(<ReplyComposer userId="u1" onReply={async () => {}} />);

        const button = screen.getByRole('button', { name: /send reply/i });
        expect(button).toBeDisabled();
    });

    it('should call onReply when send is clicked', async () => {
        const user = userEvent.setup();
        const onReply = mock(async () => {});
        render(<ReplyComposer userId="u1" onReply={onReply} />);

        const textarea = screen.getByPlaceholderText('Type your reply...');
        await user.type(textarea, 'Test message');

        const button = screen.getByRole('button', { name: /send reply/i });
        await user.click(button);

        expect(onReply).toHaveBeenCalledTimes(1);
        expect(onReply).toHaveBeenCalledWith('Test message');
    });

    it('should clear textarea on successful send', async () => {
        const user = userEvent.setup();
        render(<ReplyComposer userId="u1" onReply={async () => {}} />);

        const textarea = screen.getByPlaceholderText('Type your reply...');
        await user.type(textarea, 'Hello');

        const button = screen.getByRole('button', { name: /send reply/i });
        await user.click(button);

        await screen.findByRole('button', { name: /send reply/i });
        expect(textarea).toHaveValue('');
    });

    it('should trigger send on Cmd+Enter', async () => {
        const user = userEvent.setup();
        const onReply = mock(async () => {});
        render(<ReplyComposer userId="u1" onReply={onReply} />);

        const textarea = screen.getByPlaceholderText('Type your reply...');
        await user.type(textarea, 'Quick reply');
        fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

        expect(onReply).toHaveBeenCalledTimes(1);
        expect(onReply).toHaveBeenCalledWith('Quick reply');
    });

    it('should update character counter', async () => {
        const user = userEvent.setup();
        render(<ReplyComposer userId="u1" onReply={async () => {}} />);

        const textarea = screen.getByPlaceholderText('Type your reply...');
        expect(screen.getByText('0 characters')).toBeInTheDocument();

        await user.type(textarea, 'Hi');
        expect(screen.getByText('2 characters')).toBeInTheDocument();
    });
});
