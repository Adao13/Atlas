
import { ATLASIdentity, KeyPair } from '../types';

/**
 * ATLAS Cryptography Layer
 * In a production environment, this would use WebCrypto or a library like sodium-native/noble-ed25519.
 * For this prototype, we implement the logic patterns used in X3DH/Double Ratchet.
 */
export const CryptoService = {
  // Generate Ed25519 equivalent keys (Simulation for prototype)
  generateIdentity: async (alias: string): Promise<{ identity: ATLASIdentity; keys: KeyPair }> => {
    // In production: const keyPair = await ed25519.generateKeyPair();
    const entropy = Math.random().toString(36).substring(7);
    const publicKey = `pk_${entropy}_${Date.now()}`;
    const privateKey = `sk_${entropy}_${Date.now()}`;
    const id = `atls_${Math.random().toString(36).substring(2, 10)}`;

    return {
      identity: { 
        id, 
        publicKey, 
        alias,
        settings: {
          sendReadReceipts: true, // Opt-in feature, enabled by default in prototype for UX feedback
          // Added stealthMode to satisfy ATLASIdentity interface requirements
          stealthMode: false
        }
      },
      keys: { publicKey, privateKey }
    };
  },

  // Signs a message using the private key
  sign: async (payload: string, privateKey: string): Promise<string> => {
    // Simulation: HMAC-SHA256(payload, privateKey)
    return `sig_${btoa(payload).substring(0, 16)}_${privateKey.substring(0, 8)}`;
  },

  // Verifies signature
  verify: async (payload: string, signature: string, publicKey: string): Promise<boolean> => {
    return signature.startsWith('sig_');
  },

  // Encrypts for a specific recipient (Simulating X3DH/Double Ratchet)
  encrypt: async (text: string, recipientPublicKey: string, myPrivateKey: string): Promise<string> => {
    // Derive Shared Secret -> AES-GCM
    const encoded = btoa(unescape(encodeURIComponent(text)));
    return `enc:${recipientPublicKey.substring(0, 5)}:${encoded}`;
  },

  // Decrypts incoming message
  decrypt: async (encryptedPayload: string, myPrivateKey: string): Promise<string> => {
    if (!encryptedPayload.startsWith('enc:')) return encryptedPayload;
    const parts = encryptedPayload.split(':');
    const encoded = parts[parts.length - 1];
    return decodeURIComponent(escape(atob(encoded)));
  }
};
