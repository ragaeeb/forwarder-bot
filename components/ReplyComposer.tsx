'use client';

import { useState, useRef, useCallback } from 'react';

import { toast } from '../hooks/use-toast.js';
import { Button } from './ui/button.js';
import { Textarea } from './ui/textarea.js';

const MAX_CHARS = 4096;

interface Props {
    disabled?: boolean;
    onReply: (text: string) => Promise<void>;
    userId: string;
}

/**
 * Textarea + send button for web replies.
 */
export function ReplyComposer({ userId: _userId, onReply, disabled = false }: Props) {
    const [text, setText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || disabled || isSending) return;

        setIsSending(true);
        try {
            await onReply(trimmed);
            setText('');
            textareaRef.current?.focus();
        } catch (err: any) {
            toast({
                description: err.message || 'Failed to send reply',
                title: 'Error',
                variant: 'destructive',
            });
        } finally {
            setIsSending(false);
        }
    }, [text, disabled, isSending, onReply]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit],
    );

    const isDisabled = disabled || isSending || !text.trim();

    return (
        <div className="flex flex-col gap-2 p-4 border-t border-slate-200 bg-white" data-testid="reply-composer">
            <Textarea
                className="min-h-[80px] resize-none"
                data-testid="reply-textarea"
                disabled={disabled || isSending}
                maxLength={MAX_CHARS}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a reply… (Cmd/Ctrl + Enter to send)"
                ref={textareaRef}
                rows={3}
                value={text}
            />
            <div className="flex items-center justify-between">
                <span
                    className={`text-xs text-slate-400 ${text.length > MAX_CHARS * 0.9 ? 'text-orange-500' : ''}`}
                    data-testid="char-counter"
                >
                    {text.length}/{MAX_CHARS}
                </span>
                <Button data-testid="send-button" disabled={isDisabled} onClick={handleSubmit} type="button">
                    {isSending ? (
                        <span className="flex items-center gap-2">
                            <svg
                                aria-hidden="true"
                                className="h-4 w-4 animate-spin"
                                fill="none"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                />
                                <path
                                    className="opacity-75"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                    fill="currentColor"
                                />
                            </svg>
                            Sending…
                        </span>
                    ) : (
                        'Send Reply'
                    )}
                </Button>
            </div>
        </div>
    );
}
