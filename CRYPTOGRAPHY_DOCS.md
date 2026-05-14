# Chat Application: Cryptographic Architecture & Technical Documentation

This document serves as the official technical documentation for the cryptography implemented within the `Chat_App-main` project. It provides an in-depth look at the mathematical foundations, the algorithmic logic, and the precise code implementations used to secure the real-time communications.

---

## 1. System Architecture overview

The application is built on a **Zero-Knowledge Architecture**. The backend (Node.js + Socket.io) functions entirely as a blind message broker. 
- **Symmetric Encryption** is used to encrypt the actual payload of the messages.
- **Asymmetric Encryption (Pre-Quantum & Post-Quantum)** is used to securely exchange the symmetric keys across the untrusted network.
- **Client-Side execution:** All cryptographic operations (Key Generation, Encryption, Decryption) happen strictly in the browser.

---

## 2. Classical Cryptography (Educational Mode)

### 2.1. Caesar Cipher
**Mathematical Concept:**
The Caesar cipher is an affine cipher using modular arithmetic over the English alphabet (a finite cyclic group of order 26, $\mathbb{Z}_{26}$).
- **Encryption Function:** $E_k(x) = (x + k) \pmod{26}$
- **Decryption Function:** $D_k(x) = (x - k) \pmod{26}$
Where $x$ is the numerical value of the character ($0 \le x \le 25$) and $k$ is the shift key.

**Implementation in `crypto.ts`:**
```typescript
export const caesarEncrypt = (text: string, shiftStr: string): string => {
  const shift = parseInt(shiftStr, 10) || 0;
  return text.split('').map(char => {
    const code = char.charCodeAt(0);
    // Uppercase
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift) % 26 + 26) % 26 + 65);
    } 
    // Lowercase
    else if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift) % 26 + 26) % 26 + 97);
    }
    return char;
  }).join('');
};
```

---

## 3. Symmetric Cryptography (Secure Mode)

### 3.1. Advanced Encryption Standard (AES)
**Mathematical Concept:**
AES operates on a $4 \times 4$ byte grid known as the "State". It performs arithmetic in the Galois Field $GF(2^8)$, defined by the irreducible polynomial: $P(x) = x^8 + x^4 + x^3 + x + 1$.
The transformation rounds include:
1. **SubBytes:** A non-linear substitution step where each byte is replaced with its multiplicative inverse in $GF(2^8)$, followed by an affine transformation.
2. **MixColumns:** A linear transformation multiplying the state by a constant matrix over $GF(2^8)$, providing intense diffusion.

**Implementation (AES-CBC) in `crypto.ts`:**
```typescript
export const aesEncrypt = (text: string, key: string, mode: string = 'CBC'): string => {
  return CryptoJS.AES.encrypt(text, key, { mode: getCryptoJSMode(mode) }).toString();
};
```

### 3.2. AES-GCM (Galois/Counter Mode)
**Mathematical Concept:**
AES-GCM is an Authenticated Encryption with Associated Data (AEAD) mode.
- **Confidentiality:** It uses AES in Counter (CTR) mode. A nonce and a counter create a keystream that is XORed ($\oplus$) with the plaintext.
- **Authenticity (GMAC):** It calculates a message authentication code using universal hashing over the finite field $GF(2^{128})$. This prevents chosen-ciphertext tampering.

**Implementation in `crypto.ts`:**
```typescript
export const aesGcmEncrypt = (text: string, key: string): { ciphertext: string, iv: string, tag: string } => {
  const iv = forge.random.getBytesSync(12); // Standard 96-bit nonce
  let paddedKey = key;
  while (paddedKey.length < 16) paddedKey += '0';
  const keyBytes = paddedKey.substring(0, 16);
  
  const cipher = forge.cipher.createCipher('AES-GCM', keyBytes);
  cipher.start({ iv, tagLength: 128 });
  cipher.update(forge.util.createBuffer(text, 'utf8'));
  cipher.finish();
  
  return {
    ciphertext: forge.util.encode64(cipher.output.getBytes()),
    iv: forge.util.encode64(iv),
    tag: forge.util.encode64(cipher.mode.tag.getBytes())
  };
};
```

---

## 4. Asymmetric Cryptography (Key Exchange)

### 4.1. RSA-OAEP
**Mathematical Concept:**
RSA security assumes the intractability of the integer factorization problem.
1. Compute modulus $n = pq$, and $\phi(n) = (p-1)(q-1)$.
2. Compute public exponent $e$ and private exponent $d$ where $ed \equiv 1 \pmod{\phi(n)}$.

**OAEP Padding:**
Standard RSA ($C = M^e \pmod{n}$) is deterministic and vulnerable to padding oracles. **OAEP (Optimal Asymmetric Encryption Padding)** uses a Feistel network with hash functions (SHA-256 and MGF1) to inject randomness before mathematical encryption, providing IND-CCA2 semantic security.

**Implementation in `crypto.ts`:**
```typescript
export const rsaEncrypt = (text: string, publicKeyPem: string): string => {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  // encrypt using RSA-OAEP with SHA-256
  const encrypted = publicKey.encrypt(text, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha1.create() }
  });
  return forge.util.encode64(encrypted);
};
```

---

## 5. Post-Quantum Cryptography (Quantum Mode)

### 5.1. Crystals-Kyber (ML-KEM)
**Mathematical Concept:**
Kyber (NIST FIPS 203) is a Key Encapsulation Mechanism (KEM) based on the computationally hard **Module Learning With Errors (MLWE)** problem. Unlike RSA, which is vulnerable to Shor's Algorithm running on a theoretical quantum computer, MLWE is quantum-resistant.

The arithmetic is executed over the polynomial ring $R_q = \mathbb{Z}_q[X] / (X^{256} + 1)$ with modulus $q = 3329$.
- A public matrix $A \in R_q^{k \times k}$ is generated.
- Secret vectors $s, e$ (error) are sampled from a centered binomial distribution.
- The public key is $(A, t)$ where $t = As + e$.
Finding $s$ given $A$ and $t$ is the fundamental MLWE hard problem.

**Key Encapsulation Implementation in `crypto.ts`:**
```typescript
export const kyberEncapsulate = (publicKeyBase64: string): { ciphertext: string, sharedSecret: string } => {
  const pk = new Uint8Array(forge.util.decode64(publicKeyBase64).split('').map(c => c.charCodeAt(0)));
  const c_ss = kyber.Encrypt768(pk); // Generates ciphertext and shared secret K
  return {
    ciphertext: forge.util.encode64(String.fromCharCode(...c_ss[0])),
    sharedSecret: forge.util.encode64(String.fromCharCode(...c_ss[1]))
  };
};

export const kyberDecapsulate = (ciphertextBase64: string, privateKeyBase64: string): string => {
  const c = new Uint8Array(forge.util.decode64(ciphertextBase64).split('').map(c => c.charCodeAt(0)));
  const sk = new Uint8Array(forge.util.decode64(privateKeyBase64).split('').map(c => c.charCodeAt(0)));
  const ss = kyber.Decrypt768(c, sk); // Recovers the exact shared secret K
  return forge.util.encode64(String.fromCharCode(...ss));
};
```

---

## 6. Key Distribution & Context Flow
The system manages keys elegantly via the React `ChatContext.tsx`. When a user joins a room, they broadcast their public keys (both RSA and PQC) to the room. 

**Public Key Broadcast (`ChatContext.tsx`):**
```typescript
socket.emit('share-public-key', { roomId, publicKey, pqcPublicKey });

socket.on('receive-public-key', (data) => {
  // Store peers' public keys
  if (data.publicKey) setRoomPublicKeys(prev => ({ ...prev, [data.senderId]: data.publicKey }));
  if (data.pqcPublicKey) setRoomPqcPublicKeys(prev => ({ ...prev, [data.senderId]: data.pqcPublicKey }));
});
```

When sending a message, the client dynamically encapsulates/encrypts a symmetric session key for every participant in the room using their stored public keys. The encrypted payload and the encrypted keys are then sent to the Socket.io server, which routes them safely to the destinations.
