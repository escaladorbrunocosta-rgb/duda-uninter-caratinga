// crypto-polyfill.js
import crypto from 'node:crypto';

// Aplica o polyfill para a API de criptografia global.
// Isso garante que a biblioteca 'baileys' encontrará o que precisa.
if (typeof globalThis.crypto !== 'object' || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: crypto.webcrypto,
  });
}