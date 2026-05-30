import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from '../components/ThemeProvider';
import { Toaster } from '../components/ui/sonner';

import './globals.css';

export const metadata: Metadata = {
    title: 'Forwarder Bot',
    description: 'Telegram message forwarder bot admin dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-background font-sans antialiased">
                <ThemeProvider>
                    {children}
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
