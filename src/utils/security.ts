import crypto from 'node:crypto';

/**
 * Creates a SHA-256 hash of the provided token.
 * Used for securely storing and comparing tokens without revealing the original value.
 * This is primarily used for setup token verification.
 *
 * @param {string} token - The token to hash, typically a bot token
 * @returns {string} The hex-encoded SHA-256 hash of the token
 */
export const hashToken = (token: string) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};
