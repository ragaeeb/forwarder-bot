import { describe, expect, it } from 'vitest';

import { hashToken } from './security.js';

describe('security', () => {
    describe('hashToken', () => {
        it('should create a SHA-256 hash of the input token', () => {
            const token = 'test-token';
            const result = hashToken(token);

            // SHA-256 hash of 'test-token' as hex
            const expectedHash = '4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e';

            expect(result).toBe(expectedHash);
            expect(result.length).toBe(64); // SHA-256 produces a 64-character hex string
        });

        it('should handle empty strings', () => {
            const token = '';
            const result = hashToken(token);

            // SHA-256 hash of empty string as hex
            const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

            expect(result).toBe(expectedHash);
            expect(result.length).toBe(64);
        });

        it('should produce consistent hash for the same input', () => {
            const token = 'consistent-test-input';
            const firstResult = hashToken(token);
            const secondResult = hashToken(token);

            expect(firstResult).toBe(secondResult);
        });

        it('should produce different hashes for different inputs', () => {
            const token1 = 'test-token-1';
            const token2 = 'test-token-2';

            const hash1 = hashToken(token1);
            const hash2 = hashToken(token2);

            expect(hash1).not.toBe(hash2);
        });

        it('should handle special characters', () => {
            const token = '!@#$%^&*()_+{}|:"<>?[];\',./ \\';
            const result = hashToken(token);

            expect(result.length).toBe(64);
            // We don't check the exact hash, just that it produces a valid SHA-256 hash
        });

        it('should handle unicode characters', () => {
            const token = '你好世界😀🔑';
            const result = hashToken(token);

            expect(result.length).toBe(64);
            // We don't check the exact hash, just that it produces a valid SHA-256 hash
        });
    });
});
