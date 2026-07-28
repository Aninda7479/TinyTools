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
    pbkdf2_hmac::<Sha256>(passphrase, salt, 100_000, &mut key);
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
pub fn encrypt_xor(input: String, key: String) -> Result<String, String> {
    if key.is_empty() { return Err("XOR key cannot be empty".to_string()); }
    let key_bytes = key.as_bytes();
    let out: String = input
        .bytes()
        .enumerate()
        .map(|(i, b)| (b ^ key_bytes[i % key_bytes.len()]) as char)
        .collect();
    Ok(out)
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
