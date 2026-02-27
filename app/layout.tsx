import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
    description: 'Manage your Telegram forwarder bot conversations',
    title: 'Forwarder Bot',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="bg-white text-slate-900 antialiased">{children}</body>
        </html>
    );
}
