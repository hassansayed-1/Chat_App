import CryptoJS from 'crypto-js';
import forge from 'node-forge';
import * as kyber from 'crystals-kyber';

export const generateAESKey = () => Math.random().toString(36).substring(2, 18);
export const generateDESKey = () => Math.random().toString(36).substring(2, 10);
export const generateRC4Key = () => Math.random().toString(36).substring(2, 14);

// --- Caesar Cipher ---
export const caesarEncrypt = (text: string, shiftStr: string): string => {
  const shift = parseInt(shiftStr, 10) || 0;
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift) % 26 + 26) % 26 + 65);
    } else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift) % 26 + 26) % 26 + 97);
    }
    return char;
  }).join('');
};

export const caesarDecrypt = (text: string, shiftStr: string): string => {
  const shift = parseInt(shiftStr, 10) || 0;
  return caesarEncrypt(text, (-shift).toString());
};

// --- Substitution Cipher ---
// Expected key format: a 26-character string representing the alphabet mapping (lowercase)
// e.g. "phqgiumeaylnofdxjkrcvstzwb"
export const generateSubstitutionKey = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  for (let i = alphabet.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]];
  }
  return alphabet.join('');
};

export const substitutionEncrypt = (text: string, key: string): string => {
  if (key.length !== 26) return text; // Fallback if key is invalid
  const map: Record<string, string> = {};
  for (let i = 0; i < 26; i++) {
    map[String.fromCharCode(97 + i)] = key[i].toLowerCase();
    map[String.fromCharCode(65 + i)] = key[i].toUpperCase();
  }
  return text.split('').map(char => map[char] || char).join('');
};

export const substitutionDecrypt = (text: string, key: string): string => {
  if (key.length !== 26) return text;
  const map: Record<string, string> = {};
  for (let i = 0; i < 26; i++) {
    map[key[i].toLowerCase()] = String.fromCharCode(97 + i);
    map[key[i].toUpperCase()] = String.fromCharCode(65 + i);
  }
  return text.split('').map(char => map[char] || char).join('');
};

// --- Helper to get CryptoJS mode ---
const getCryptoJSMode = (mode: string) => {
  switch (mode) {
    case 'ECB': return CryptoJS.mode.ECB;
    case 'CFB': return CryptoJS.mode.CFB;
    case 'CTR': return CryptoJS.mode.CTR;
    case 'OFB': return CryptoJS.mode.OFB;
    default: return CryptoJS.mode.CBC;
  }
};

// --- DES ---
export const desEncrypt = (text: string, key: string, mode: string = 'CBC'): string => {
  return CryptoJS.DES.encrypt(text, key, { mode: getCryptoJSMode(mode) }).toString();
};

export const desDecrypt = (cipher: string, key: string, mode: string = 'CBC'): string => {
  try {
    const bytes = CryptoJS.DES.decrypt(cipher, key, { mode: getCryptoJSMode(mode) });
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};

// --- AES ---
export const aesEncrypt = (text: string, key: string, mode: string = 'CBC'): string => {
  return CryptoJS.AES.encrypt(text, key, { mode: getCryptoJSMode(mode) }).toString();
};

export const aesDecrypt = (cipher: string, key: string, mode: string = 'CBC'): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipher, key, { mode: getCryptoJSMode(mode) });
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error(e);
    return '';
  }
};

// --- RC4 (Stream Cipher) ---
export const rc4Encrypt = (text: string, key: string): string => {
  return CryptoJS.RC4.encrypt(text, key).toString();
};

export const rc4Decrypt = (cipher: string, key: string): string => {
  try {
    const bytes = CryptoJS.RC4.decrypt(cipher, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    return '';
  }
};

// --- RSA ---
export const generateRSAKeys = (): Promise<{ publicKey: string, privateKey: string }> => {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048, workers: 2 }, (err, keypair) => {
      if (err) return reject(err);
      const publicKey = forge.pki.publicKeyToPem(keypair.publicKey);
      const privateKey = forge.pki.privateKeyToPem(keypair.privateKey);
      resolve({ publicKey, privateKey });
    });
  });
};

export const rsaEncrypt = (text: string, publicKeyPem: string): string => {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  // encrypt using RSA-OAEP
  const encrypted = publicKey.encrypt(text, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: {
      md: forge.md.sha1.create()
    }
  });
  return forge.util.encode64(encrypted);
};

export const rsaDecrypt = (encryptedBase64: string, privateKeyPem: string): string => {
  try {
    const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const encrypted = forge.util.decode64(encryptedBase64);
    const decrypted = privateKey.decrypt(encrypted, 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: {
        md: forge.md.sha1.create()
      }
    });
    return decrypted;
  } catch (e) {
    console.error('RSA Decryption failed:', e);
    return '';
  }
};

// --- Post-Quantum (Kyber) ---
// Note: Kyber is a KEM (Key Encapsulation Mechanism)
// We use Kyber768 which is standard.

export const generateKyberKeys = (): { publicKey: string, privateKey: string } => {
  const pk_sk = kyber.KeyGen768();
  return {
    publicKey: forge.util.encode64(String.fromCharCode(...pk_sk[0])),
    privateKey: forge.util.encode64(String.fromCharCode(...pk_sk[1]))
  };
};

/**
 * Encapsulates a shared secret for a given public key.
 * Returns the ciphertext and the shared secret (both base64).
 */
export const kyberEncapsulate = (publicKeyBase64: string): { ciphertext: string, sharedSecret: string } => {
  const pk = new Uint8Array(forge.util.decode64(publicKeyBase64).split('').map(c => c.charCodeAt(0)));
  const c_ss = kyber.Encrypt768(pk);
  return {
    ciphertext: forge.util.encode64(String.fromCharCode(...c_ss[0])),
    sharedSecret: forge.util.encode64(String.fromCharCode(...c_ss[1]))
  };
};

/**
 * Decapsulates a ciphertext using a private key.
 * Returns the shared secret (base64).
 */
export const kyberDecapsulate = (ciphertextBase64: string, privateKeyBase64: string): string => {
  try {
    const c = new Uint8Array(forge.util.decode64(ciphertextBase64).split('').map(c => c.charCodeAt(0)));
    const sk = new Uint8Array(forge.util.decode64(privateKeyBase64).split('').map(c => c.charCodeAt(0)));
    const ss = kyber.Decrypt768(c, sk);
    return forge.util.encode64(String.fromCharCode(...ss));
  } catch (e) {
    console.error('Kyber Decapsulation failed:', e);
    return '';
  }
};
