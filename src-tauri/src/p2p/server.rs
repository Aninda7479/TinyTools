use axum::body::Body;
use axum::extract::{ConnectInfo, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct ServerState {
    pub transfers: Arc<Mutex<HashMap<String, PortalTransfer>>>,
    pub downloads_dir: Arc<Mutex<String>>,
    pub download_limits: Arc<Mutex<HashMap<String, DownloadLimit>>>,
}

#[derive(Clone)]
pub struct DownloadLimit {
    pub window_started: std::time::Instant,
    pub attempts: u8,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PortalTransfer {
    #[serde(skip_serializing, skip_deserializing)]
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    #[serde(skip_serializing, skip_deserializing)]
    pub encrypted_data: Option<Vec<u8>>,
    pub encryption_salt: Option<String>,
    pub encryption_nonce: Option<String>,
    pub encryption_iterations: Option<u32>,
    pub started_at: u64,
}


async fn portal_page() -> Html<String> {
    Html(format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TinyTools - File Transfer</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}}
.container{{max-width:420px;width:100%;padding:2rem;text-align:center}}
h1{{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}}
.subtitle{{color:rgba(255,255,255,.4);font-size:.875rem;margin-bottom:2rem}}
.file-icon{{width:80px;height:80px;border-radius:1.25rem;background:rgba(96,165,250,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}}
.file-icon svg{{width:40px;height:40px;color:rgba(96,165,250,.7)}}
.file-name{{font-size:1rem;font-weight:500;margin-bottom:.25rem;word-break:break-all}}
.file-size{{color:rgba(255,255,255,.4);font-size:.8rem;margin-bottom:1.5rem}}
.password-section{{margin-bottom:1.5rem}}
.password-section input{{width:100%;padding:.75rem 1rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:.875rem;outline:none;transition:border-color .2s}}
.password-section input:focus{{border-color:rgba(96,165,250,.5)}}
.password-section p{{color:rgba(255,255,255,.3);font-size:.75rem;margin-top:.5rem}}
.encrypted-badge{{display:inline-flex;align-items:center;gap:.4rem;padding:.25rem .75rem;border-radius:1rem;border:1px solid rgba(250,204,21,.3);background:rgba(250,204,21,.08);color:#facc15;font-size:.7rem;margin-bottom:1.5rem}}
.encrypted-badge svg{{width:12px;height:12px}}
.btn{{width:100%;padding:.75rem;border-radius:.75rem;border:none;font-size:.875rem;font-weight:500;cursor:pointer;transition:all .2s}}
.btn-primary{{background:rgba(96,165,250,.2);color:#60a5fa;border:1px solid rgba(96,165,250,.3)}}
.btn-primary:hover{{background:rgba(96,165,250,.3)}}
.btn-primary:disabled{{opacity:.4;cursor:not-allowed}}
.btn-download{{background:rgba(74,222,128,.2);color:#4ade80;border:1px solid rgba(74,222,128,.3)}}
.btn-download:hover{{background:rgba(74,222,128,.3)}}
.progress{{display:none;margin-top:1.5rem}}
.progress-bar{{height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;margin-bottom:.5rem}}
.progress-fill{{height:100%;background:#4ade80;border-radius:3px;transition:width .3s;width:0}}
.progress-text{{font-size:.75rem;color:rgba(255,255,255,.4)}}
.error{{color:#f87171;font-size:.8rem;margin-top:1rem;display:none}}
.success{{color:#4ade80;font-size:.8rem;margin-top:1rem;display:none}}
.loading{{color:rgba(255,255,255,.3);font-size:.8rem;margin-top:1rem}}
</style>
</head>
<body>
<div class="container">
<h1>TinyTools</h1>
<p class="subtitle">Secure File Transfer</p>
<div class="file-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
<div class="file-name" id="fileName">Loading...</div>
<div class="file-size" id="fileSize"></div>
<div class="encrypted-badge" id="encryptedBadge" style="display:none"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Encrypted</div>
<div class="password-section" id="passwordSection" style="display:none">
<input type="password" id="passwordInput" placeholder="Enter password to download">
<p>This file is password-protected</p>
</div>
<button class="btn btn-download" id="downloadBtn" onclick="startDownload()">Download File</button>
<div class="progress" id="progressSection">
<div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
<div class="progress-text" id="progressText">0%</div>
</div>
<div class="error" id="errorText"></div>
<div class="success" id="successText">Download complete!</div>
<div class="loading" id="loadingIndicator">Loading file info...</div>
</div>
<script>
let fileInfo={{}};
let failedPasswordAttempts=0, passwordBlockedUntil=0;
async function init(){{try{{const r=await fetch("/api/info");if(!r.ok)throw new Error("No file available");fileInfo=await r.json();document.getElementById("loadingIndicator").style.display="none";document.getElementById("fileName").textContent=fileInfo.file_name;document.getElementById("fileSize").textContent=formatSize(fileInfo.file_size);if(fileInfo.encryption_salt){{document.getElementById("passwordSection").style.display="block";document.getElementById("encryptedBadge").style.display="inline-flex"}}else{{document.getElementById("encryptedBadge").style.display="none"}}}}catch(e){{document.getElementById("loadingIndicator").textContent=e.message;document.getElementById("fileName").textContent="No file available";document.getElementById("downloadBtn").disabled=true}}}}
function formatSize(b){{if(b<1024)return b+" B";if(b<1048576)return(b/1024).toFixed(1)+" KB";if(b<1073741824)return(b/1048576).toFixed(1)+" MB";return(b/1073741824).toFixed(2)+" GB"}}
function base64Bytes(value){{const raw=atob(value);return Uint8Array.from(raw,c=>c.charCodeAt(0));}}
async function decryptLocally(ciphertext,password){{if(!window.isSecureContext||!window.crypto?.subtle)throw new Error("This browser requires a secure HTTPS connection for local decryption. The portal must be opened over HTTPS.");const keyMaterial=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({{name:"PBKDF2",salt:base64Bytes(fileInfo.encryption_salt),iterations:fileInfo.encryption_iterations,hash:"SHA-256"}},keyMaterial,{{name:"AES-GCM",length:256}},false,["decrypt"]);return crypto.subtle.decrypt({{name:"AES-GCM",iv:base64Bytes(fileInfo.encryption_nonce)}},key,ciphertext);}}
async function startDownload(){{const btn=document.getElementById("downloadBtn");if(Date.now()<passwordBlockedUntil){{const error=document.getElementById("errorText");error.textContent="Too many incorrect passwords. Try again in "+Math.ceil((passwordBlockedUntil-Date.now())/1000)+" seconds.";error.style.display="block";return}}btn.disabled=true;btn.textContent="Downloading...";document.getElementById("progressSection").style.display="block";document.getElementById("errorText").style.display="none";document.getElementById("successText").style.display="none";try{{const resp=await fetch("/api/download");if(!resp.ok){{const err=await resp.json().catch(()=>({{error:"Download failed"}}));throw new Error(err.error||resp.statusText||"Download failed")}}const ct=resp.headers.get("content-length")||"0";const total=parseInt(ct);const reader=resp.body.getReader();const chunks=[];let received=0;while(true){{const{{done,value}}=await reader.read();if(done)break;chunks.push(value);received+=value.length;if(total>0){{const pct=Math.round(received/total*100);document.getElementById("progressFill").style.width=pct+"%";document.getElementById("progressText").textContent=received>1024*1024?formatSize(received)+" / "+formatSize(total)+" ("+pct+"%)":pct+"%"}}}}let blob=new Blob(chunks);if(fileInfo.encryption_salt){{try{{const password=document.getElementById("passwordInput").value;if(!password)throw new Error("Enter the password to decrypt this file.");const plaintext=await decryptLocally(await blob.arrayBuffer(),password);blob=new Blob([plaintext])}}catch(e){{failedPasswordAttempts++;if(failedPasswordAttempts>=5){{passwordBlockedUntil=Date.now()+30000;failedPasswordAttempts=0;throw new Error("Too many incorrect passwords. Try again in 30 seconds.")}}throw new Error("Incorrect password ("+(5-failedPasswordAttempts)+" attempts remaining).")}}}}const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=fileInfo.file_name;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);document.getElementById("successText").style.display="block";btn.textContent="Download Complete"}}catch(e){{const error=document.getElementById("errorText");error.textContent=e.message;error.style.display="block";btn.disabled=false;btn.textContent="Download File";document.getElementById("progressSection").style.display="none"}}}}
if(!window.isSecureContext||!window.crypto?.subtle){{
  const error=document.getElementById("errorText");
  error.textContent="Local password decryption requires an HTTPS connection. This HTTP portal cannot decrypt securely in this browser.";
  error.style.display="block";
  document.getElementById("downloadBtn").disabled=true;
}}
init();
</script>
</body></html>"#,
    ))
}

async fn get_portal_info(
    State(state): State<ServerState>,
) -> Result<Json<PortalTransfer>, StatusCode> {
    let transfers = state.transfers.lock().await;
    transfers
        .values()
        .next()
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn download_file(
    State(state): State<ServerState>,
    ConnectInfo(remote_addr): ConnectInfo<SocketAddr>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let transfers = state.transfers.lock().await;
    let transfer = transfers.values().next().ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "No file available"})),
        )
    })?;

    let file_path = transfer.file_path.clone();
    let file_size = transfer.file_size;
    let file_name = transfer.file_name.clone();
    let encrypted_data = transfer.encrypted_data.clone();
    drop(transfers);

    let mut limits = state.download_limits.lock().await;
    let entry = limits.entry(remote_addr.ip().to_string()).or_insert(DownloadLimit {
        window_started: std::time::Instant::now(),
        attempts: 0,
    });
    if entry.window_started.elapsed() >= std::time::Duration::from_secs(60) {
        entry.window_started = std::time::Instant::now();
        entry.attempts = 0;
    }
    if entry.attempts >= 10 {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(serde_json::json!({"error": "Too many download attempts. Try again in a minute."})),
        ));
    }
    entry.attempts += 1;
    drop(limits);

    if let Some(data) = encrypted_data {
        let mut headers = HeaderMap::new();
        headers.insert("content-type", "application/octet-stream".parse().unwrap());
        headers.insert("content-length", data.len().to_string().parse().unwrap());
        headers.insert("x-tinytools-encrypted", "true".parse().unwrap());
        return Ok((headers, Body::from(data)).into_response());
    }

    let file = tokio::fs::File::open(&file_path)
        .await
        .map_err(|e| (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": e.to_string()})),
        ))?;

    let stream = tokio_util::io::ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let mut headers = HeaderMap::new();
    headers.insert(
        "content-type",
        "application/octet-stream"
            .parse()
            .unwrap(),
    );
    headers.insert(
        "content-disposition",
        format!("attachment; filename=\"{}\"", file_name)
            .parse()
            .unwrap(),
    );
    headers.insert(
        "content-length",
        file_size.to_string().parse().unwrap(),
    );

    Ok((headers, body).into_response())
}

pub async fn start_server(
    state: ServerState,
    local_ip: &str,
) -> Result<(u16, tokio::task::JoinHandle<()>), String> {
    let listener = std::net::TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind server: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let certified_key = rcgen::generate_simple_self_signed(vec![
        "localhost".to_string(),
        local_ip.to_string(),
    ])
    .map_err(|e| format!("Failed to generate portal certificate: {}", e))?;
    let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem(
        certified_key.cert.pem().into_bytes(),
        certified_key.key_pair.serialize_pem().into_bytes(),
    )
    .await
    .map_err(|e| format!("Failed to configure HTTPS: {}", e))?;

    let app = Router::new()
        .route("/", get(portal_page))
        .route("/api/info", get(get_portal_info))
        .route("/api/download", get(download_file))
        .with_state(state);

    let handle = tokio::spawn(async move {
        let _ = axum_server::from_tcp_rustls(listener, tls_config)
            .serve(app.into_make_service_with_connect_info::<SocketAddr>())
            .await;
    });

    Ok((port, handle))
}
