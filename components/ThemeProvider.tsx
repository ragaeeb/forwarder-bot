'use client';

import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
    return <div className="light">{children}</div>;
}
