use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};
use data_encoding::{BASE32, BASE32_NOPAD};

// ── Base Encoders ──────────────────────────────────────────────

// ── Base Encoders ──────────────────────────────────────────────

#[tauri::command]
pub fn encode_base64(input: String) -> Result<String, String> {
    Ok(general_purpose::STANDARD.encode(input.as_bytes()))
}

#[tauri::command]
pub fn decode_base64(input: String) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(input.trim())
        .map_err(|e| format!("Base64 decode error: {}", e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[tauri::command]
pub fn encode_base64url(input: String) -> Result<String, String> {
    Ok(general_purpose::URL_SAFE_NO_PAD.encode(input.as_bytes()))
}

#[tauri::command]
pub fn decode_base64url(input: String) -> Result<String, String> {
    let bytes = general_purpose::URL_SAFE_NO_PAD
        .decode(input.trim())
        .map_err(|e| format!("Base64URL decode error: {}", e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[tauri::command]
pub fn encode_base32(input: String) -> Result<String, String> {
    Ok(BASE32.encode(input.as_bytes()))
}

#[tauri::command]
pub fn decode_base32(input: String) -> Result<String, String> {
    let normalized = input.trim().to_uppercase();
    let bytes = BASE32_NOPAD
        .decode(normalized.as_bytes())
        .or_else(|_| BASE32.decode(normalized.as_bytes()))
        .map_err(|e| format!("Base32 decode error: {}", e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[tauri::command]
pub fn encode_base58(input: String) -> Result<String, String> {
    Ok(bs58::encode(input.as_bytes()).into_string())
}

#[tauri::command]
pub fn decode_base58(input: String) -> Result<String, String> {
    let bytes = bs58::decode(input.trim())
        .into_vec()
        .map_err(|e| format!("Base58 decode error: {}", e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[tauri::command]
pub fn encode_hex(input: String) -> Result<String, String> {
    Ok(hex::encode(input.as_bytes()))
}

#[tauri::command]
pub fn decode_hex(input: String) -> Result<String, String> {
    let normalized = input.trim().trim_start_matches("0x");
    let bytes = hex::decode(normalized).map_err(|e| format!("Hex decode error: {}", e))?;
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

// ── Web & URL ──────────────────────────────────────────────────

#[tauri::command]
pub fn encode_url(input: String) -> Result<String, String> {
    Ok(urlencoding::encode(&input).into_owned())
}

#[tauri::command]
pub fn decode_url(input: String) -> Result<String, String> {
    urlencoding::decode(&input)
        .map(|s| s.into_owned())
        .map_err(|e| format!("URL decode error: {}", e))
}

#[tauri::command]
pub fn encode_html(input: String) -> Result<String, String> {
    let mut out = String::with_capacity(input.len() * 2);
    for c in input.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#x27;"),
            '/' => out.push_str("&#x2F;"),
            _ => out.push(c),
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn decode_html(input: String) -> Result<String, String> {
    let s = input
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#x2F;", "/")
        .replace("&#39;", "'");
    Ok(s)
}

#[tauri::command]
pub fn encode_unicode(input: String) -> Result<String, String> {
    let out: String = input
        .chars()
        .map(|c| format!("\\u{:04X}", c as u32))
        .collect();
    Ok(out)
}

#[tauri::command]
pub fn decode_unicode(input: String) -> Result<String, String> {
    let mut out = String::new();
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut i = 0;
    while i < len {
        if i + 5 < len && chars[i] == '\\' && chars[i + 1] == 'u' {
            let hex_str: String = chars[i + 2..i + 6].iter().collect();
            if let Ok(code) = u32::from_str_radix(&hex_str, 16) {
                if let Some(c) = char::from_u32(code) {
                    out.push(c);
                    i += 6;
                    continue;
                }
            }
            out.push(chars[i]);
            i += 1;
        } else {
            out.push(chars[i]);
            i += 1;
        }
    }
    Ok(out)
}

// ── JWT ────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct JwtParts {
    pub header: String,
    pub payload: String,
    pub signature: String,
    pub valid_json: bool,
}

#[tauri::command]
pub fn decode_jwt(token: String) -> Result<JwtParts, String> {
    let parts: Vec<&str> = token.trim().split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT: expected 3 dot-separated parts".into());
    }

    let decode_segment = |s: &str| -> Result<String, String> {
        let mut padded = s.to_string();
        while padded.len() % 4 != 0 {
            padded.push('=');
        }
        let bytes = general_purpose::STANDARD
            .decode(&padded)
            .or_else(|_| general_purpose::URL_SAFE.decode(&padded))
            .map_err(|e| format!("Base64 decode error: {}", e))?;
        String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
    };

    let header = decode_segment(parts[0])?;
    let payload = decode_segment(parts[1])?;
    let signature = general_purpose::URL_SAFE_NO_PAD.encode(parts[2].as_bytes());

    let valid_json = serde_json::from_str::<serde_json::Value>(&header).is_ok()
        && serde_json::from_str::<serde_json::Value>(&payload).is_ok();

    Ok(JwtParts {
        header,
        payload,
        signature,
        valid_json,
    })
}

// ── Morse Code ─────────────────────────────────────────────────

#[tauri::command]
pub fn text_to_morse(input: String) -> Result<String, String> {
    let table: Vec<(char, &str)> = vec![
        ('A',"·-"),('B',"-···"),('C',"-·-·"),('D',"-··"),('E',"·"),
        ('F',"··-·"),('G',"--·"),('H',"····"),('I',"··"),('J',"·---"),
        ('K',"-·-"),('L',"·-··"),('M',"--"),('N',"-·"),('O',"---"),
        ('P',"·--·"),('Q',"--·-"),('R',"·-·"),('S',"···"),('T',"-"),
        ('U',"··-"),('V',"···-"),('W',"·--"),('X',"-··-"),('Y',"-·--"),
        ('Z',"--··"),
        ('0',"-----"),('1',"·----"),('2',"··---"),('3',"···--"),
        ('4',"····-"),('5',"·····"),('6',"-····"),('7',"--···"),
        ('8',"---··"),('9',"----·"),
        ('.',"·-·-·-"),(',',"--··--"),('?',"··--··"),('!',"-·-·--"),
        ('/',"-···-."),('(', "-·--·"),(')',"-·--·-"),('&',"·-···"),
        (':',"---···"),(';',"-·-·-·"),('=' ,"-···-"),('+',"·-·-·"),
        ('-',"-····-"),('_', "··--·-"),('"', "·-··-·"),('\'', "·----·"),
        ('@',"·--·-·"),
    ];

    let morse: String = input
        .to_uppercase()
        .chars()
        .filter_map(|c| {
            if c == ' ' {
                Some(" / ".to_string())
            } else {
                table.iter().find(|(ch, _)| *ch == c).map(|(_, m)| m.to_string())
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    Ok(morse)
}

#[tauri::command]
pub fn morse_to_text(input: String) -> Result<String, String> {
    let table: Vec<(&str, char)> = vec![
        ("·-",'A'),("-···",'B'),("-·-·",'C'),("-··",'D'),("·",'E'),
        ("··-·",'F'),("--·",'G'),("····",'H'),("··",'I'),("·---",'J'),
        ("-·-",'K'),("·-··",'L'),("--",'M'),("-·",'N'),("---",'O'),
        ("·--·",'P'),("--·-",'Q'),("·-·",'R'),("···",'S'),("-",'T'),
        ("··-",'U'),("···-",'V'),("·--",'W'),("-··-",'X'),("-·--",'Y'),
        ("--··",'Z'),
        ("-----",'0'),("·----",'1'),("··---",'2'),("···--",'3'),
        ("····-",'4'),("·····",'5'),("-····",'6'),("--···",'7'),
        ("---··",'8'),("----·",'9'),
        ("·-·-·-",'.'),("--··--",','),("··--··",'?'),("-·-·--",'!'),
    ];

    let text: String = input
        .split(" / ")
        .map(|word| {
            word.split(' ')
                .filter_map(|sym| table.iter().find(|(m, _)| *m == sym).map(|(_, c)| *c))
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join(" ");

    Ok(text)
}

// ── Binary / Octal ─────────────────────────────────────────────

#[tauri::command]
pub fn text_to_binary(input: String) -> Result<String, String> {
    let out: String = input
        .bytes()
        .map(|b| format!("{:08b}", b))
        .collect::<Vec<_>>()
        .join(" ");
    Ok(out)
}

#[tauri::command]
pub fn binary_to_text(input: String) -> Result<String, String> {
    let tokens: Vec<&str> = input.trim().split(|c| c == ' ' || c == '\n').collect();
    let mut bytes = Vec::new();
    for token in tokens {
        if token.is_empty() {
            continue;
        }
        if token.len() != 8 || !token.chars().all(|c| c == '0' || c == '1') {
            return Err(format!("Invalid 8-bit binary segment: '{}'", token));
        }
        bytes.push(u8::from_str_radix(token, 2).map_err(|e| e.to_string())?);
    }
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}

#[tauri::command]
pub fn text_to_octal(input: String) -> Result<String, String> {
    let out: String = input
        .bytes()
        .map(|b| format!("{:03o}", b))
        .collect::<Vec<_>>()
        .join(" ");
    Ok(out)
}

#[tauri::command]
pub fn octal_to_text(input: String) -> Result<String, String> {
    let tokens: Vec<&str> = input.trim().split(|c| c == ' ' || c == '\n').collect();
    let mut bytes = Vec::new();
    for token in tokens {
        if token.is_empty() {
            continue;
        }
        bytes.push(u8::from_str_radix(token, 8).map_err(|e| format!("Invalid octal: {}", e))?);
    }
    String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8: {}", e))
}
