// Utilidades de encriptación con Web Crypto API
// Usa AES-GCM para encriptación simétrica

const EncryptionUtils = {
  // Generar un salt aleatorio (hex string)
  generateSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Derivar clave desde salt y chatId
  async deriveKey(salt, chatId) {
    const saltBytes = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const chatIdString = String(chatId);
    const encoder = new TextEncoder();
    
    // Usar PBKDF2 para derivar clave
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(chatIdString),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: 100000,
        hash: 'SHA-256'
      },
      baseKey,
      256 // 256 bits para AES-256
    );
    
    return crypto.subtle.importKey(
      'raw',
      derivedBits,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  },

  // Encriptar mensaje
  async encrypt(message, salt, chatId) {
    try {
      const key = await this.deriveKey(salt, chatId);
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(String(message));
      
      // Generar IV aleatorio (12 bytes es estándar para GCM)
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        messageBytes
      );
      
      // Combinar IV + encrypted data, codificar en base64
      const combined = new Uint8Array(iv.length + encryptedData.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encryptedData), iv.length);
      
      return btoa(String.fromCharCode.apply(null, combined));
    } catch (error) {
      console.error('Error encriptando:', error);
      return null;
    }
  },

  // Desencriptar mensaje
  async decrypt(encryptedBase64, salt, chatId) {
    try {
      const key = await this.deriveKey(salt, chatId);
      
      // Decodificar base64
      const binaryString = atob(encryptedBase64);
      const combined = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        combined[i] = binaryString.charCodeAt(i);
      }
      
      // Extraer IV (primeros 12 bytes) y encrypted data
      const iv = combined.slice(0, 12);
      const encryptedData = combined.slice(12);
      
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Error desencriptando:', error);
      return null;
    }
  }
};
