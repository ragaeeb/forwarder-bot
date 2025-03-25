import { describe, expect, it } from 'vitest';

import { hashToken } from './security.js';

describe('security', () => {
    describe('hashToken', () => {
        it('should create a SHA-256 hash of the input token', () => {
            const result = hashToken('test-token');

            // SHA-256 hash of 'test-token' as hex
            const expectedHash = '4c5dc9b7708905f77f5e5d16316b5dfb425e68cb326dcd55a860e90a7707031e';

            expect(result).toBe(expectedHash);
            expect(result.length).toBe(64); // SHA-256 produces a 64-character hex string
        });

        it('should handle empty strings', () => {
            const result = hashToken('');

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
            const hash1 = hashToken('test-token-1');
            const hash2 = hashToken('test-token-2');

            expect(hash1).not.toBe(hash2);
        });

        it('should handle special characters', () => {
            const result = hashToken('!@#$%^&*()_+{}|:"<>?[];\',./ \\');

            expect(result.length).toBe(64);
        });

        it('should handle unicode characters', () => {
            const result = hashToken('你好世界😀🔑');
            expect(result.length).toBe(64);
        });
    });
});
