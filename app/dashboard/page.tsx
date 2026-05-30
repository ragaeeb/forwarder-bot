'use client';

import { MessageSquare, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { ThreadData } from '../../components/ConversationList';
import { ConversationList } from '../../components/ConversationList';
import { Button } from '../../components/ui/button';

export default function DashboardPage() {
    const router = useRouter();
    const [threads, setThreads] = useState<ThreadData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const limit = 20;

    const fetchThreads = useCallback(async (currentOffset: number) => {
        try {
            const res = await fetch(`/api/conversations?limit=${limit}&offset=${currentOffset}`);
            const data = await res.json();
            if (!res.ok || !Array.isArray(data.threads)) {
                setError(data.error || `Server error (${res.status})`);
                return;
            }
            if (currentOffset === 0) {
                setThreads(data.threads);
            } else {
                setThreads((prev) => [...prev, ...data.threads]);
            }
            setTotal(data.total ?? 0);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load conversations');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThreads(0);
    }, [fetchThreads]);

    const handleLoadMore = () => {
        const newOffset = offset + limit;
        setOffset(newOffset);
        fetchThreads(newOffset);
    };

    const handleSelect = (userId: string) => {
        router.push(`/dashboard/${userId}`);
    };

    return (
        <div className="flex h-screen">
            <div className="flex w-80 flex-col border-r">
                <div className="flex items-center justify-between border-b p-4">
                    <h1 className="text-lg font-semibold">Forwarder Bot</h1>
                    <Button variant="ghost" size="icon" onClick={() => router.push('/api/settings')}>
                        <Settings className="h-5 w-5" />
                    </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                    <ConversationList threads={threads} onSelect={handleSelect} isLoading={isLoading} />
                </div>
                {threads.length < total && (
                    <div className="border-t p-3">
                        <Button variant="outline" className="w-full" onClick={handleLoadMore}>
                            Load more
                        </Button>
                    </div>
                )}
            </div>
            <div className="flex flex-1 items-center justify-center bg-muted/30">
                {error ? (
                    <div className="flex max-w-md flex-col items-center gap-3 px-6 text-center">
                        <div className="rounded-full bg-red-100 p-3">
                            <MessageSquare className="h-8 w-8 text-red-500" />
                        </div>
                        <p className="text-lg font-medium text-red-700">Something went wrong</p>
                        <p className="text-sm text-muted-foreground">{error}</p>
                        <p className="text-xs text-muted-foreground">
                            Make sure you have a <code className="rounded bg-muted px-1">.env</code> file with the required environment variables. See <code className="rounded bg-muted px-1">.env.example</code> for reference.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 stroke-1" />
                        <p className="text-lg">Select a conversation</p>
                        <p className="text-sm">Choose a conversation from the sidebar to get started</p>
                    </div>
                )}
            </div>
        </div>
    );
}
