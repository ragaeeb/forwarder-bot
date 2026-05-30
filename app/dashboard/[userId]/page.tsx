'use client';

import { ArrowLeft, CheckCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { SavedMessage } from '@/types/app';
import { MessageThread } from '../../../components/MessageThread';
import { ReplyComposer } from '../../../components/ReplyComposer';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';

interface ThreadInfo {
    userId: string;
    threadId: string;
    name: string;
}

export default function ConversationPage() {
    const params = useParams<{ userId: string }>();
    const router = useRouter();
    const [messages, setMessages] = useState<SavedMessage[]>([]);
    const [thread, setThread] = useState<ThreadInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConversation = useCallback(async () => {
        try {
            const res = await fetch(`/api/conversations/${params.userId}`);
            if (!res.ok) {
                setThread(null);
                setMessages([]);
                return;
            }
            const data = await res.json();
            setThread(data.thread);
            setMessages(data.messages);
        } finally {
            setIsLoading(false);
        }
    }, [params.userId]);

    useEffect(() => {
        fetchConversation();
    }, [fetchConversation]);

    const handleReply = async (text: string) => {
        const res = await fetch(`/api/conversations/${params.userId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!data.ok) {
            throw new Error(data.error || 'Failed to send reply');
        }
        await fetchConversation();
    };

    const handleMarkRead = async () => {
        await fetch(`/api/conversations/${params.userId}`, { method: 'PUT' });
    };

    return (
        <div className="flex h-screen flex-col">
            <div className="flex items-center gap-3 border-b px-4 py-3">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h2 className="font-semibold">{thread?.name ?? 'Loading...'}</h2>
                    {thread && (
                        <p className="text-xs text-muted-foreground">
                            User ID: {thread.userId} &middot; Thread ID: {thread.threadId}
                        </p>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={handleMarkRead}>
                    <CheckCheck className="mr-1 h-4 w-4" />
                    Mark as read
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
                <MessageThread messages={messages} currentUserId={params.userId} isLoading={isLoading} />
            </div>
            <Separator />
            <div className="p-4">
                <ReplyComposer userId={params.userId} onReply={handleReply} disabled={!thread} />
            </div>
        </div>
    );
}
