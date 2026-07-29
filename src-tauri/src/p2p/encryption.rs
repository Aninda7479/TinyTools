use aes_gcm::aead::{Aead, AeadCore};
use aes_gcm::{Aes256Gcm, KeyInit};
use pbkdf2::pbkdf2_hmac;
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;

pub const PORTAL_PBKDF2_ITERATIONS: u32 = 310_000;

pub struct PortalEncryption {
    pub ciphertext: Vec<u8>,
    pub salt: Vec<u8>,
    pub nonce: Vec<u8>,
}

pub fn encrypt_for_web_portal(password: &str, plaintext: &[u8]) -> Result<PortalEncryption, String> {
    let salt = generate_salt();
    let mut key = [0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PORTAL_PBKDF2_ITERATIONS, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| format!("Portal encryption failed: {}", e))?;

    Ok(PortalEncryption {
        ciphertext,
        salt,
        nonce: nonce.to_vec(),
    })
}

pub fn generate_salt() -> Vec<u8> {
    let mut salt = vec![0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}
