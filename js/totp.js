/**
 * SavePlate TOTP Authenticator Module (totp.js)
 *
 * Owning Role: Security Engineer
 *
 * User Story:
 * As a SavePlate user, I want 2FA backed by a real authenticator app (Google
 * Authenticator, Authy, etc.) instead of a code shown on screen, so a stolen
 * password alone can't get into my account.
 *
 * Implements RFC 4226 (HOTP) / RFC 6238 (TOTP) using the browser's Web Crypto
 * API for HMAC-SHA1. Runs entirely client-side, no backend required.
 */

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Generates a random Base32-encoded secret to hand to an authenticator app.
 */
function generateTOTPSecret(byteLength = 20) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return base32Encode(bytes);
}

function base32Encode(bytes) {
    let bits = 0, value = 0, output = '';
    for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

function base32Decode(base32) {
    const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0, value = 0;
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
        value = (value << 5) | BASE32_ALPHABET.indexOf(clean[i]);
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return new Uint8Array(bytes);
}

/**
 * Computes an HOTP code (RFC 4226) for a given secret and counter using HMAC-SHA1.
 */
async function computeHOTP(secretBase32, counter) {
    const keyBytes = base32Decode(secretBase32);

    // 64-bit big-endian counter, split into two 32-bit halves since JS
    // bitwise ops only operate on 32 bits.
    const counterBytes = new ArrayBuffer(8);
    const counterView = new DataView(counterBytes);
    const high = Math.floor(counter / 2 ** 32);
    const low = counter >>> 0;
    counterView.setUint32(0, high);
    counterView.setUint32(4, low);

    const cryptoKey = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
    const digest = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226 section 5.3)
    const offset = digest[digest.length - 1] & 0x0f;
    const binCode = ((digest[offset] & 0x7f) << 24)
        | ((digest[offset + 1] & 0xff) << 16)
        | ((digest[offset + 2] & 0xff) << 8)
        | (digest[offset + 3] & 0xff);

    return (binCode % 10 ** TOTP_DIGITS).toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Computes the TOTP code for "now", optionally offset by N 30-second steps
 * (used internally to tolerate clock drift when verifying).
 */
async function generateTOTP(secretBase32, stepOffset = 0) {
    const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) + stepOffset;
    return computeHOTP(secretBase32, counter);
}

/**
 * Verifies a user-entered code against the secret, tolerating +/-1 time step
 * (30s) of clock drift between the device and the authenticator app.
 */
async function verifyTOTP(secretBase32, token) {
    const cleanToken = (token || '').trim();
    if (!/^\d{6}$/.test(cleanToken)) return false;

    for (let offset = -1; offset <= 1; offset++) {
        const expected = await generateTOTP(secretBase32, offset);
        if (expected === cleanToken) return true;
    }
    return false;
}
