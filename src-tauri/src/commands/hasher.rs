use serde::{Deserialize, Serialize};
use sha2::{Sha256, Sha512, Digest};
use md5::Md5;
use blake3::Hasher as Blake3Hasher;
use std::hash::Hasher;
use std::io::Read;

// ── Text Hashing ───────────────────────────────────────────────

fn compute_hash(algorithm: &str, data: &[u8]) -> Result<String, String> {
    match algorithm {
        "md5" => {
            let mut hasher = Md5::new();
            hasher.update(data);
            Ok(format!("{:x}", hasher.finalize()))
        }
        "sha1" => {
            let mut hasher = sha1::Sha1::new();
            hasher.update(data);
            Ok(format!("{:x}", hasher.finalize()))
        }
        "sha256" => {
            let mut hasher = Sha256::new();
            hasher.update(data);
            Ok(format!("{:x}", hasher.finalize()))
        }
        "sha512" => {
            let mut hasher = Sha512::new();
            hasher.update(data);
            Ok(format!("{:x}", hasher.finalize()))
        }
        "blake3" => {
            let hash = blake3::hash(data);
            Ok(hash.to_hex().to_string())
        }
        "crc32" => {
            let hash = crc32fast::hash(data);
            Ok(format!("{:08x}", hash))
        }
        "adler32" => {
            let hash = adler::adler32(data).unwrap_or(0);
            Ok(format!("{:08x}", hash))
        }
        "xxh3" => {
            use xxhash_rust::xxh3::xxh3_64;
            let hash = xxh3_64(data);
            Ok(format!("{:016x}", hash))
        }
        _ => Err(format!("Unknown algorithm: {}", algorithm)),
    }
}

#[tauri::command]
pub fn hash_text(input: String, algorithm: String) -> Result<String, String> {
    compute_hash(&algorithm, input.as_bytes())
}

// ── File Hashing ───────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct HashResult {
    pub algorithm: String,
    pub hash: String,
    pub file_size: u64,
}

#[tauri::command]
pub fn hash_file(input_path: String, algorithm: String) -> Result<HashResult, String> {
    let mut file = std::fs::File::open(&input_path).map_err(|e| e.to_string())?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    let file_size = metadata.len();

    match algorithm.as_str() {
        "md5" => {
            let mut hasher = Md5::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:x}", hasher.finalize()), file_size })
        }
        "sha1" => {
            let mut hasher = sha1::Sha1::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:x}", hasher.finalize()), file_size })
        }
        "sha256" => {
            let mut hasher = Sha256::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:x}", hasher.finalize()), file_size })
        }
        "sha512" => {
            let mut hasher = Sha512::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:x}", hasher.finalize()), file_size })
        }
        "blake3" => {
            let mut hasher = Blake3Hasher::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: hasher.finalize().to_hex().to_string(), file_size })
        }
        "crc32" => {
            let mut hasher = crc32fast::Hasher::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.update(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:08x}", hasher.finalize()), file_size })
        }
        "adler32" => {
            let mut state = adler::Adler32::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                state.write(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:08x}", state.finish()), file_size })
        }
        "xxh3" => {
            use xxhash_rust::xxh3::Xxh3;
            use std::hash::Hasher;
            let mut hasher = Xxh3::new();
            let mut buf = [0u8; 65536];
            loop {
                let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                if n == 0 { break; }
                hasher.write(&buf[..n]);
            }
            Ok(HashResult { algorithm, hash: format!("{:016x}", hasher.finish()), file_size })
        }
        _ => Err(format!("Unknown algorithm: {}", algorithm)),
    }
}

// ── Multi-Hash (all algorithms at once) ────────────────────────

#[derive(Serialize, Deserialize)]
pub struct MultiHashResult {
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
    pub sha512: String,
    pub blake3: String,
    pub crc32: String,
    pub file_size: u64,
}

#[tauri::command]
pub fn hash_file_all(input_path: String) -> Result<MultiHashResult, String> {
    let mut file = std::fs::File::open(&input_path).map_err(|e| e.to_string())?;
    let file_size = file.metadata().map_err(|e| e.to_string())?.len();

    let mut md5_h = Md5::new();
    let mut sha1_h = sha1::Sha1::new();
    let mut sha256_h = Sha256::new();
    let mut sha512_h = Sha512::new();
    let mut blake3_h = Blake3Hasher::new();
    let mut crc32_h = crc32fast::Hasher::new();

    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        let chunk = &buf[..n];
        md5_h.update(chunk);
        sha1_h.update(chunk);
        sha256_h.update(chunk);
        sha512_h.update(chunk);
        blake3_h.update(chunk);
        crc32_h.update(chunk);
    }

    Ok(MultiHashResult {
        md5: format!("{:x}", md5_h.finalize()),
        sha1: format!("{:x}", sha1_h.finalize()),
        sha256: format!("{:x}", sha256_h.finalize()),
        sha512: format!("{:x}", sha512_h.finalize()),
        blake3: blake3_h.finalize().to_hex().to_string(),
        crc32: format!("{:08x}", crc32_h.finalize()),
        file_size,
    })
}

#[tauri::command]
pub fn hash_text_all(input: String) -> Result<MultiHashResult, String> {
    let data = input.as_bytes();

    let md5_h = {
        let mut h = Md5::new();
        h.update(data);
        format!("{:x}", h.finalize())
    };
    let sha1_h = {
        let mut h = sha1::Sha1::new();
        h.update(data);
        format!("{:x}", h.finalize())
    };
    let sha256_h = {
        let mut h = Sha256::new();
        h.update(data);
        format!("{:x}", h.finalize())
    };
    let sha512_h = {
        let mut h = Sha512::new();
        h.update(data);
        format!("{:x}", h.finalize())
    };
    let blake3_h = blake3::hash(data).to_hex().to_string();
    let crc32_h = format!("{:08x}", crc32fast::hash(data));

    Ok(MultiHashResult {
        md5: md5_h,
        sha1: sha1_h,
        sha256: sha256_h,
        sha512: sha512_h,
        blake3: blake3_h,
        crc32: crc32_h,
        file_size: data.len() as u64,
    })
}

// ── Verify ─────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct VerifyResult {
    pub matches: bool,
    pub computed: String,
    pub expected: String,
}

#[tauri::command]
pub fn verify_file_hash(
    input_path: String,
    algorithm: String,
    expected_hash: String,
) -> Result<VerifyResult, String> {
    let result = hash_file(input_path, algorithm)?;
    let computed = result.hash.to_lowercase();
    let expected = expected_hash.trim().to_lowercase();

    Ok(VerifyResult {
        matches: computed == expected,
        computed,
        expected,
    })
}

#[tauri::command]
pub fn verify_text_hash(
    input: String,
    algorithm: String,
    expected_hash: String,
) -> Result<VerifyResult, String> {
    let hash = compute_hash(&algorithm, input.as_bytes())?;
    let computed = hash.to_lowercase();
    let expected = expected_hash.trim().to_lowercase();

    Ok(VerifyResult {
        matches: computed == expected,
        computed,
        expected,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_hash_text_md5() {
        let result = hash_text("hello".to_string(), "md5".to_string()).unwrap();
        assert_eq!(result, "5d41402abc4b2a76b9719d911017c592");
    }

    #[test]
    fn test_hash_text_sha256() {
        let result = hash_text("hello".to_string(), "sha256".to_string()).unwrap();
        assert_eq!(result, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    }

    #[test]
    fn test_hash_text_sha512() {
        let result = hash_text("hello".to_string(), "sha512".to_string()).unwrap();
        assert!(result.starts_with("9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca7"));
        assert_eq!(result.len(), 128);
    }

    #[test]
    fn test_hash_text_blake3() {
        let result = hash_text("hello".to_string(), "blake3".to_string()).unwrap();
        assert_eq!(result, "ea8f163db38682925e4491c5e58d4bb3506ef8c14eb78a86e908c5624a67200f");
    }

    #[test]
    fn test_hash_text_crc32() {
        let result = hash_text("hello".to_string(), "crc32".to_string()).unwrap();
        assert_eq!(result.len(), 8);
        assert_eq!(result, "3610a686");
    }

    #[test]
    fn test_hash_text_unknown_algorithm() {
        let result = hash_text("hello".to_string(), "quantum".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_file_sha256() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.txt");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(b"hello world").unwrap();
        drop(f);

        let result = hash_file(path.to_str().unwrap().to_string(), "sha256".to_string()).unwrap();
        assert_eq!(result.hash, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
        assert_eq!(result.file_size, 11);
    }

    #[test]
    fn test_hash_file_all() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.txt");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(b"tinytools").unwrap();
        drop(f);

        let result = hash_file_all(path.to_str().unwrap().to_string()).unwrap();
        assert_eq!(result.md5, "2b8ca86a0770830e1ffeb0774a75978f");
        assert_eq!(result.sha256.len(), 64);
        assert_eq!(result.sha512.len(), 128);
        assert_eq!(result.blake3.len(), 64);
        assert_eq!(result.file_size, 9);
    }

    #[test]
    fn test_hash_text_all() {
        let result = hash_text_all("tinytools".to_string()).unwrap();
        assert_eq!(result.md5, "2b8ca86a0770830e1ffeb0774a75978f");
        assert_eq!(result.sha256.len(), 64);
        assert_eq!(result.sha512.len(), 128);
        assert_eq!(result.blake3.len(), 64);
        assert_eq!(result.file_size, 9);
    }

    #[test]
    fn test_verify_file_hash() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("verify.txt");
        let mut f = std::fs::File::create(&path).unwrap();
        f.write_all(b"test data").unwrap();
        drop(f);

        let hash_result = hash_file(path.to_str().unwrap().to_string(), "md5".to_string()).unwrap();
        let verified = verify_file_hash(
            path.to_str().unwrap().to_string(),
            "md5".to_string(),
            hash_result.hash.clone(),
        ).unwrap();
        assert!(verified.matches);
        assert_eq!(verified.computed, hash_result.hash);

        let bad = verify_file_hash(
            path.to_str().unwrap().to_string(),
            "md5".to_string(),
            "00000000000000000000000000000000".to_string(),
        ).unwrap();
        assert!(!bad.matches);
    }
}
