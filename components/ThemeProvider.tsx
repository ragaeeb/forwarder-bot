'use client';

import { Toaster } from './ui/toaster.js';

interface ThemeProviderProps {
    children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
    return (
        <>
            {children}
            <Toaster />
        </>
    );
}
