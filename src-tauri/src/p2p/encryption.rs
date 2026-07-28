use aes_gcm::aead::Aead;
use aes_gcm::aead::AeadCore;
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use argon2::Argon2;
use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub const CHUNK_SIZE: usize = 256 * 1024;

pub fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn derive_key(password: &[u8], salt: &[u8]) -> Result<[u8; 32], String> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(password, salt, &mut key)
        .map_err(|e| format!("Argon2 KDF error: {}", e))?;
    Ok(key)
}

pub fn compute_hmac(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, String> {
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(key).map_err(|e| format!("HMAC init error: {}", e))?;
    mac.update(data);
    Ok(mac.finalize().into_bytes().to_vec())
}

pub fn verify_hmac(key: &[u8; 32], data: &[u8], expected: &[u8]) -> Result<bool, String> {
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(key).map_err(|e| format!("HMAC init error: {}", e))?;
    mac.update(data);
    let tag = mac.finalize().into_bytes();
    Ok(tag.as_slice() == expected)
}

pub fn encrypt_chunk(key: &[u8; 32], chunk_index: u64, plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    nonce_bytes[..8].copy_from_slice(&chunk_index.to_le_bytes());
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("AES encrypt error: {}", e))?;
    let mut out = Vec::with_capacity(12 + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt_chunk(key: &[u8; 32], chunk_index: u64, data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < 12 {
        return Err("Encrypted chunk too short".to_string());
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    let mut expected_nonce = [0u8; 12];
    expected_nonce[..8].copy_from_slice(&chunk_index.to_le_bytes());
    if data[..12] != expected_nonce {
        return Err(format!(
            "Nonce mismatch at chunk {}: expected {:?}, got {:?}",
            chunk_index,
            &expected_nonce[..],
            &data[..12]
        ));
    }
    let nonce = Nonce::from_slice(&data[..12]);
    cipher
        .decrypt(nonce, &data[12..])
        .map_err(|e| format!("AES decrypt error (wrong password?): {}", e))
}

pub fn encrypt_file(
    password: &str,
    input_path: &str,
    output_path: &str,
) -> Result<String, String> {
    use std::io::Read;

    let salt = generate_salt();
    let key = derive_key(password.as_bytes(), &salt)?;

    let mut file = std::fs::File::open(input_path).map_err(|e| e.to_string())?;
    let mut plaintext = Vec::new();
    file.read_to_end(&mut plaintext).map_err(|e| e.to_string())?;

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(16 + 12 + ciphertext.len());
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);

    std::fs::write(output_path, &out).map_err(|e| e.to_string())?;
    Ok(format!("Encrypted to {}", output_path))
}

pub fn decrypt_file(
    password: &str,
    input_path: &str,
    output_path: &str,
) -> Result<String, String> {

    let data = std::fs::read(input_path).map_err(|e| e.to_string())?;
    if data.len() < 28 {
        return Err("Encrypted file too short".to_string());
    }

    let salt = &data[..16];
    let nonce_bytes = &data[16..28];
    let ciphertext = &data[28..];

    let key = derive_key(password.as_bytes(), salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed: wrong passphrase or corrupted file".to_string())?;

    std::fs::write(output_path, &plaintext).map_err(|e| e.to_string())?;
    Ok(format!("Decrypted to {}", output_path))
}
