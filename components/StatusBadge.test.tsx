import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';

import { StatusBadge } from './StatusBadge.js';

describe('StatusBadge', () => {
    describe('rendering', () => {
        it('should render nothing when unreadCount is 0', () => {
            const { container } = render(<StatusBadge unreadCount={0} />);
            expect(container.firstChild).toBeNull();
        });

        it('should render nothing when unreadCount is undefined', () => {
            const { container } = render(<StatusBadge />);
            expect(container.firstChild).toBeNull();
        });

        it('should render the unread count when positive', () => {
            render(<StatusBadge unreadCount={5} />);
            expect(screen.getByTestId('status-badge')).toBeDefined();
            expect(screen.getByTestId('status-badge').textContent).toBe('5');
        });

        it('should show "99+" for counts greater than 99', () => {
            render(<StatusBadge unreadCount={150} />);
            expect(screen.getByTestId('status-badge').textContent).toBe('99+');
        });

        it('should show exactly 99 for count of 99', () => {
            render(<StatusBadge unreadCount={99} />);
            expect(screen.getByTestId('status-badge').textContent).toBe('99');
        });

        it('should apply custom className', () => {
            render(<StatusBadge className="custom-class" unreadCount={3} />);
            const badge = screen.getByTestId('status-badge');
            expect(badge.className).toContain('custom-class');
        });
    });
});
