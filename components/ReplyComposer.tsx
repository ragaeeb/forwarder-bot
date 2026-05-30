'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

export interface ReplyComposerProps {
    userId: string;
    onReply: (text: string) => Promise<void>;
    disabled?: boolean;
}

export function ReplyComposer({ userId: _userId, onReply, disabled = false }: ReplyComposerProps) {
    const [text, setText] = useState('');
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || isPending || disabled) return;

        setIsPending(true);
        try {
            await onReply(trimmed);
            setText('');
        } catch (err) {
            console.error('Failed to send reply:', err);
        } finally {
            setIsPending(false);
        }
    }, [text, onReply, isPending, disabled]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    const isSendDisabled = !text.trim() || disabled || isPending;

    return (
        <div className="flex flex-col gap-2 border-t p-4">
            <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your reply..."
                rows={3}
                minLength={1}
                disabled={disabled}
                className="min-h-[80px]"
            />
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{text.length} characters</span>
                <Button onClick={handleSubmit} disabled={isSendDisabled}>
                    {isPending ? (
                        <>
                            <Loader2 className="size-4 animate-spin" />
                            Sending...
                        </>
                    ) : (
                        'Send Reply'
                    )}
                </Button>
            </div>
        </div>
    );
}
