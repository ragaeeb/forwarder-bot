import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
    it('should render count', () => {
        render(<StatusBadge count={5} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should show 99+ for count > 99', () => {
        render(<StatusBadge count={150} />);
        expect(screen.getByText('99+')).toBeInTheDocument();
    });

    it('should return null for count 0', () => {
        const { container } = render(<StatusBadge count={0} />);
        expect(container.firstChild).toBeNull();
    });

    it('should return null for negative count', () => {
        const { container } = render(<StatusBadge count={-1} />);
        expect(container.firstChild).toBeNull();
    });
});
