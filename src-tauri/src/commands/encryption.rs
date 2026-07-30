use aes_gcm::{Aes256Gcm, Nonce, KeyInit, AeadCore};
use aes_gcm::aead::Aead;
use chacha20poly1305::ChaCha20Poly1305;
use argon2::Argon2;
use rand::RngCore;
use rand::rngs::OsRng;
use std::io::Read;

// ── KDF version byte ──────────────────────────────────────────
// Written as first byte of every encrypted blob so decrypt
// can auto-detect which KDF was used.
const KDF_ARGON2: u8 = 0x00;
const KDF_PBKDF2: u8 = 0x01;

// ── Helpers ────────────────────────────────────────────────────

fn get_random_bytes(n: usize) -> Vec<u8> {
    let mut buf = vec![0u8; n];
    OsRng.fill_bytes(&mut buf);
    buf
}

fn derive_key_argon2(passphrase: &[u8], salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase, salt, &mut key)
        .map_err(|e| format!("Argon2 KDF error: {}", e))?;
    Ok(key)
}

fn derive_key_pbkdf2(passphrase: &[u8], salt: &[u8]) -> Result<[u8; 32], String> {
    use pbkdf2::pbkdf2_hmac;
    use sha2::Sha256;
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(passphrase, salt, 600_000, &mut key);
    Ok(key)
}

fn derive_key(passphrase: &[u8], salt: &[u8], kdf: &str) -> Result<[u8; 32], String> {
    match kdf {
        "pbkdf2" => derive_key_pbkdf2(passphrase, salt),
        _ => derive_key_argon2(passphrase, salt),
    }
}

fn kdf_version_byte(kdf: &str) -> u8 {
    match kdf {
        "pbkdf2" => KDF_PBKDF2,
        _ => KDF_ARGON2,
    }
}

fn derive_from_version(passphrase: &[u8], salt: &[u8], version: u8) -> Result<[u8; 32], String> {
    match version {
        KDF_PBKDF2 => derive_key_pbkdf2(passphrase, salt),
        _ => derive_key_argon2(passphrase, salt),
    }
}

// ── Pack / unpack helpers ──────────────────────────────────────
// Wire format (all little-endian):
//   [1 byte: kdf_version]
//   [4 bytes: salt_len] [salt_len bytes: salt]
//   [4 bytes: nonce_len] [nonce_len bytes: nonce]
//   [...ciphertext]

fn pack_blob(kdf: &str, salt: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(1 + 4 + salt.len() + 4 + nonce.len() + ciphertext.len());
    out.push(kdf_version_byte(kdf));
    out.extend_from_slice(&(salt.len() as u32).to_le_bytes());
    out.extend_from_slice(salt);
    out.extend_from_slice(&(nonce.len() as u32).to_le_bytes());
    out.extend_from_slice(nonce);
    out.extend_from_slice(ciphertext);
    out
}

fn unpack_blob(data: &[u8]) -> Result<(u8, &[u8], &[u8], &[u8]), String> {
    if data.len() < 1 + 8 {
        return Err("Invalid encrypted data: too short".to_string());
    }
    let kdf_version = data[0];
    let mut pos = 1;

    let salt_len = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
    pos += 4;
    if pos + salt_len > data.len() { return Err("Invalid salt".to_string()); }
    let salt = &data[pos..pos + salt_len];
    pos += salt_len;

    if pos + 4 > data.len() { return Err("Invalid nonce length".to_string()); }
    let nonce_len = u32::from_le_bytes([data[pos], data[pos+1], data[pos+2], data[pos+3]]) as usize;
    pos += 4;
    if pos + nonce_len > data.len() { return Err("Invalid nonce".to_string()); }
    let nonce = &data[pos..pos + nonce_len];
    pos += nonce_len;

    Ok((kdf_version, salt, nonce, &data[pos..]))
}

// ── Text: AES-256-GCM ──────────────────────────────────────────

#[tauri::command]
pub fn encrypt_text_aes(input: String, passphrase: String, kdf: String) -> Result<String, String> {
    let salt = get_random_bytes(16);
    let key = derive_key(passphrase.as_bytes(), &salt, &kdf)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, input.as_bytes())
        .map_err(|e| e.to_string())?;

    let blob = pack_blob(&kdf, &salt, &nonce, &ciphertext);
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &blob))
}

#[tauri::command]
pub fn decrypt_text_aes(input: String, passphrase: String) -> Result<String, String> {
    let data = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        input.trim(),
    )
    .map_err(|e| format!("Base64 decode error: {}", e))?;

    let (kdf_version, salt, nonce, ciphertext) = unpack_blob(&data)?;
    let key = derive_from_version(passphrase.as_bytes(), salt, kdf_version)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce_obj = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce_obj, ciphertext)
        .map(|bytes| String::from_utf8(bytes).unwrap_or_else(|_| "[decrypted, not valid UTF-8]".to_string()))
        .map_err(|_| "Decryption failed: wrong passphrase or corrupted data".to_string())
}

// ── Text: ChaCha20-Poly1305 ───────────────────────────────────

#[tauri::command]
pub fn encrypt_text_chacha(input: String, passphrase: String, kdf: String) -> Result<String, String> {
    let salt = get_random_bytes(16);
    let key = derive_key(passphrase.as_bytes(), &salt, &kdf)?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, input.as_bytes())
        .map_err(|e| e.to_string())?;

    let blob = pack_blob(&kdf, &salt, &nonce, &ciphertext);
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &blob))
}

#[tauri::command]
pub fn decrypt_text_chacha(input: String, passphrase: String) -> Result<String, String> {
    let data = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        input.trim(),
    )
    .map_err(|e| format!("Base64 decode error: {}", e))?;

    let (kdf_version, salt, nonce, ciphertext) = unpack_blob(&data)?;
    let key = derive_from_version(passphrase.as_bytes(), salt, kdf_version)?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce_obj = chacha20poly1305::Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce_obj, ciphertext)
        .map(|bytes| String::from_utf8(bytes).unwrap_or_else(|_| "[decrypted, not valid UTF-8]".to_string()))
        .map_err(|_| "Decryption failed: wrong passphrase or corrupted data".to_string())
}

// ── Classic Ciphers ────────────────────────────────────────────

#[tauri::command]
pub fn encrypt_rot13(input: String) -> Result<String, String> {
    let out: String = input.chars().map(|c| {
        match c {
            'a'..='m' | 'A'..='M' => (c as u8 + 13) as char,
            'n'..='z' | 'N'..='Z' => (c as u8 - 13) as char,
            _ => c,
        }
    }).collect();
    Ok(out)
}

#[tauri::command]
pub fn encrypt_caesar(input: String, shift: i32) -> Result<String, String> {
    let s = ((shift % 26) + 26) % 26;
    let out: String = input.chars().map(|c| {
        if c.is_ascii_lowercase() {
            ((c as u8 - b'a' + s as u8) % 26 + b'a') as char
        } else if c.is_ascii_uppercase() {
            ((c as u8 - b'A' + s as u8) % 26 + b'A') as char
        } else {
            c
        }
    }).collect();
    Ok(out)
}

#[tauri::command]
pub fn encrypt_vigenere(input: String, key: String) -> Result<String, String> {
    let key_bytes: Vec<u8> = key
        .to_uppercase()
        .bytes()
        .filter(|b| b.is_ascii_uppercase())
        .collect();
    if key_bytes.is_empty() {
        return Err("Key must contain at least one letter".to_string());
    }

    let mut ki = 0;
    let out: String = input.chars().map(|c| {
        if c.is_ascii_lowercase() {
            let shift = key_bytes[ki % key_bytes.len()] - b'A';
            ki += 1;
            ((c as u8 - b'a' + shift) % 26 + b'a') as char
        } else if c.is_ascii_uppercase() {
            let shift = key_bytes[ki % key_bytes.len()] - b'A';
            ki += 1;
            ((c as u8 - b'A' + shift) % 26 + b'A') as char
        } else {
            c
        }
    }).collect();
    Ok(out)
}

#[tauri::command]
pub fn encrypt_xor(input: String, key: String, encoding: String) -> Result<String, String> {
    if key.is_empty() { return Err("XOR key cannot be empty".to_string()); }
    let key_bytes = key.as_bytes();
    let result: Vec<u8> = input
        .bytes()
        .enumerate()
        .map(|(i, b)| b ^ key_bytes[i % key_bytes.len()])
        .collect();
    match encoding.as_str() {
        "hex" => Ok(hex::encode(&result)),
        "base64" => Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &result)),
        _ => String::from_utf8(result).map_err(|_| "XOR output is not valid UTF-8 — try hex/base64 encoding".to_string()),
    }
}

#[tauri::command]
pub fn decrypt_xor(input: String, key: String, encoding: String) -> Result<String, String> {
    if key.is_empty() { return Err("XOR key cannot be empty".to_string()); }
    let key_bytes = key.as_bytes();
    let data: Vec<u8> = match encoding.as_str() {
        "hex" => hex::decode(input.trim()).map_err(|e| format!("Hex decode error: {}", e))?,
        "base64" => base64::Engine::decode(&base64::engine::general_purpose::STANDARD, input.trim()).map_err(|e| format!("Base64 decode error: {}", e))?,
        _ => input.bytes().collect(),
    };
    let result: Vec<u8> = data
        .iter()
        .enumerate()
        .map(|(i, b)| b ^ key_bytes[i % key_bytes.len()])
        .collect();
    String::from_utf8(result).map_err(|_| "Decrypted output is not valid UTF-8".to_string())
}

// ── File: AES-256-GCM ──────────────────────────────────────────

#[tauri::command]
pub fn encrypt_file_aes(
    input_path: String,
    output_path: String,
    passphrase: String,
    kdf: String,
) -> Result<String, String> {
    let mut file = std::fs::File::open(&input_path).map_err(|e| e.to_string())?;
    let mut plaintext = Vec::new();
    file.read_to_end(&mut plaintext).map_err(|e| e.to_string())?;

    let salt = get_random_bytes(16);
    let key = derive_key(passphrase.as_bytes(), &salt, &kdf)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|e| e.to_string())?;

    let blob = pack_blob(&kdf, &salt, &nonce, &ciphertext);
    std::fs::write(&output_path, &blob).map_err(|e| e.to_string())?;
    Ok(format!("Encrypted to {}", output_path))
}

#[tauri::command]
pub fn decrypt_file_aes(
    input_path: String,
    output_path: String,
    passphrase: String,
) -> Result<String, String> {
    let data = std::fs::read(&input_path).map_err(|e| e.to_string())?;
    let (kdf_version, salt, nonce, ciphertext) = unpack_blob(&data)?;

    let key = derive_from_version(passphrase.as_bytes(), salt, kdf_version)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce_obj = Nonce::from_slice(nonce);

    let plaintext = cipher
        .decrypt(nonce_obj, ciphertext)
        .map_err(|_| String::from("Decryption failed: wrong passphrase or corrupted file"))?;

    std::fs::write(&output_path, &plaintext).map_err(|e| e.to_string())?;
    Ok(format!("Decrypted to {}", output_path))
}

// ── File: ChaCha20-Poly1305 ────────────────────────────────────

#[tauri::command]
pub fn encrypt_file_chacha(
    input_path: String,
    output_path: String,
    passphrase: String,
    kdf: String,
) -> Result<String, String> {
    let mut file = std::fs::File::open(&input_path).map_err(|e| e.to_string())?;
    let mut plaintext = Vec::new();
    file.read_to_end(&mut plaintext).map_err(|e| e.to_string())?;

    let salt = get_random_bytes(16);
    let key = derive_key(passphrase.as_bytes(), &salt, &kdf)?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|e| e.to_string())?;

    let blob = pack_blob(&kdf, &salt, &nonce, &ciphertext);
    std::fs::write(&output_path, &blob).map_err(|e| e.to_string())?;
    Ok(format!("Encrypted to {}", output_path))
}

#[tauri::command]
pub fn decrypt_file_chacha(
    input_path: String,
    output_path: String,
    passphrase: String,
) -> Result<String, String> {
    let data = std::fs::read(&input_path).map_err(|e| e.to_string())?;
    let (kdf_version, salt, nonce, ciphertext) = unpack_blob(&data)?;

    let key = derive_from_version(passphrase.as_bytes(), salt, kdf_version)?;
    let cipher = ChaCha20Poly1305::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce_obj = chacha20poly1305::Nonce::from_slice(nonce);

    let plaintext = cipher
        .decrypt(nonce_obj, ciphertext)
        .map_err(|_| String::from("Decryption failed: wrong passphrase or corrupted file"))?;

    std::fs::write(&output_path, &plaintext).map_err(|e| e.to_string())?;
    Ok(format!("Decrypted to {}", output_path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aes_text_roundtrip() {
        let plaintext = "Hello, TinyTools!";
        let passphrase = "super-secret-password";
        let encrypted = encrypt_text_aes(plaintext.to_string(), passphrase.to_string(), "argon2".to_string()).unwrap();
        assert_ne!(encrypted, plaintext);
        let decrypted = decrypt_text_aes(encrypted, passphrase.to_string()).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_text_pbkdf2_roundtrip() {
        let plaintext = "PBKDF2 is fast!";
        let passphrase = "my-password";
        let encrypted = encrypt_text_aes(plaintext.to_string(), passphrase.to_string(), "pbkdf2".to_string()).unwrap();
        let decrypted = decrypt_text_aes(encrypted, passphrase.to_string()).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_chacha_text_roundtrip() {
        let plaintext = "ChaCha20-Poly1305 works!";
        let passphrase = "chacha-secret";
        let encrypted = encrypt_text_chacha(plaintext.to_string(), passphrase.to_string(), "argon2".to_string()).unwrap();
        let decrypted = decrypt_text_chacha(encrypted, passphrase.to_string()).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_wrong_passphrase_fails() {
        let plaintext = "secret data";
        let encrypted = encrypt_text_aes(plaintext.to_string(), "correct".to_string(), "argon2".to_string()).unwrap();
        let result = decrypt_text_aes(encrypted, "wrong".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_chacha_wrong_passphrase_fails() {
        let plaintext = "secret data";
        let encrypted = encrypt_text_chacha(plaintext.to_string(), "correct".to_string(), "argon2".to_string()).unwrap();
        let result = decrypt_text_chacha(encrypted, "wrong".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_aes_file_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.txt");
        let encrypted = dir.path().join("encrypted.bin");
        let decrypted = dir.path().join("decrypted.txt");
        let data = b"File encryption test content";

        std::fs::write(&input, data).unwrap();
        encrypt_file_aes(
            input.to_str().unwrap().to_string(),
            encrypted.to_str().unwrap().to_string(),
            "file-password".to_string(),
            "argon2".to_string(),
        ).unwrap();
        decrypt_file_aes(
            encrypted.to_str().unwrap().to_string(),
            decrypted.to_str().unwrap().to_string(),
            "file-password".to_string(),
        ).unwrap();
        assert_eq!(std::fs::read(&decrypted).unwrap(), data);
    }

    #[test]
    fn test_chacha_file_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let input = dir.path().join("input.txt");
        let encrypted = dir.path().join("encrypted.bin");
        let decrypted = dir.path().join("decrypted.txt");
        let data = b"ChaCha file encryption test";

        std::fs::write(&input, data).unwrap();
        encrypt_file_chacha(
            input.to_str().unwrap().to_string(),
            encrypted.to_str().unwrap().to_string(),
            "file-password".to_string(),
            "argon2".to_string(),
        ).unwrap();
        decrypt_file_chacha(
            encrypted.to_str().unwrap().to_string(),
            decrypted.to_str().unwrap().to_string(),
            "file-password".to_string(),
        ).unwrap();
        assert_eq!(std::fs::read(&decrypted).unwrap(), data);
    }

    #[test]
    fn test_rot13_roundtrip() {
        let input = "Hello, World!";
        let encoded = encrypt_rot13(input.to_string()).unwrap();
        assert_eq!(encoded, "Uryyb, Jbeyq!");
        let decoded = encrypt_rot13(encoded).unwrap();
        assert_eq!(decoded, input);
    }

    #[test]
    fn test_caesar_shift() {
        let input = "ABC";
        let shifted = encrypt_caesar(input.to_string(), 3).unwrap();
        assert_eq!(shifted, "DEF");
        let back = encrypt_caesar(shifted, -3).unwrap();
        assert_eq!(back, "ABC");
    }

    #[test]
    fn test_caesar_shift_wraps() {
        let input = "XYZ";
        let shifted = encrypt_caesar(input.to_string(), 3).unwrap();
        assert_eq!(shifted, "ABC");
    }

    #[test]
    fn test_vigenere_encrypt() {
        let input = "ATTACKATDAWN";
        let key = "LEMON";
        let encrypted = encrypt_vigenere(input.to_string(), key.to_string()).unwrap();
        assert_eq!(encrypted, "LXFOPVEFRNHR");
    }

    #[test]
    fn test_xor_roundtrip() {
        let input = "secret message";
        let key = "key123";
        let encrypted = encrypt_xor(input.to_string(), key.to_string(), "raw".to_string()).unwrap();
        let decrypted = decrypt_xor(encrypted, key.to_string(), "raw".to_string()).unwrap();
        assert_eq!(decrypted, input);
    }

    #[test]
    fn test_xor_empty_key_fails() {
        let result = encrypt_xor("test".to_string(), "".to_string(), "raw".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_xor_hex_encoding() {
        let input = "hello";
        let key = "key";
        let encrypted = encrypt_xor(input.to_string(), key.to_string(), "hex".to_string()).unwrap();
        assert!(encrypted.chars().all(|c| c.is_ascii_hexdigit()));
        let decrypted = decrypt_xor(encrypted, key.to_string(), "hex".to_string()).unwrap();
        assert_eq!(decrypted, input);
    }

    #[test]
    fn test_xor_base64_encoding() {
        let input = "hello";
        let key = "key";
        let encrypted = encrypt_xor(input.to_string(), key.to_string(), "base64".to_string()).unwrap();
        assert!(!encrypted.is_empty());
        let decrypted = decrypt_xor(encrypted, key.to_string(), "base64".to_string()).unwrap();
        assert_eq!(decrypted, input);
    }

    #[test]
    fn test_pack_unpack_blob_roundtrip() {
        let kdf = "argon2";
        let salt = vec![1u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        let nonce = vec![10u8; 12];
        let ciphertext = vec![42u8; 64];

        let packed = pack_blob(kdf, &salt, &nonce, &ciphertext);
        let (kdf_ver, s, n, c) = unpack_blob(&packed).unwrap();
        assert_eq!(kdf_ver, KDF_ARGON2);
        assert_eq!(s, &salt[..]);
        assert_eq!(n, &nonce[..]);
        assert_eq!(c, &ciphertext[..]);
    }
}
