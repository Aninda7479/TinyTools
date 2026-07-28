use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct ServerState {
    pub transfers: Arc<Mutex<HashMap<String, PortalTransfer>>>,
    pub downloads_dir: Arc<Mutex<String>>,
    pub receiving_transfers: Arc<Mutex<HashMap<String, ReceivingTransfer>>>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct PortalTransfer {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub password: Option<String>,
    pub started_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ReceivingTransfer {
    pub id: String,
    pub file_name: String,
    pub file_size: u64,
    pub sender_name: String,
    pub password_hash: Option<String>,
    pub status: String,
    pub bytes_received: u64,
    pub started_at: u64,
}

#[derive(Deserialize)]
pub struct PortalQuery {
    pub password: Option<String>,
}

#[derive(Deserialize)]
pub struct TransferQuery {
    pub password: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct TransferManifest {
    pub file_name: String,
    pub file_size: u64,
    pub encrypted: bool,
    pub salt: Option<String>,
    pub hmac: Option<String>,
}


async fn portal_page() -> Html<&'static str> {
    Html(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TinyTools - File Transfer</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{max-width:420px;width:100%;padding:2rem;text-align:center}
h1{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}
.subtitle{color:rgba(255,255,255,.4);font-size:.875rem;margin-bottom:2rem}
.file-icon{width:80px;height:80px;border-radius:1.25rem;background:rgba(96,165,250,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem}
.file-icon svg{width:40px;height:40px;color:rgba(96,165,250,.7)}
.file-name{font-size:1rem;font-weight:500;margin-bottom:.25rem;word-break:break-all}
.file-size{color:rgba(255,255,255,.4);font-size:.8rem;margin-bottom:2rem}
.password-section{margin-bottom:1.5rem}
.password-section input{width:100%;padding:.75rem 1rem;border-radius:.75rem;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:.875rem;outline:none;transition:border-color .2s}
.password-section input:focus{border-color:rgba(96,165,250,.5)}
.password-section p{color:rgba(255,255,255,.3);font-size:.75rem;margin-top:.5rem}
.btn{width:100%;padding:.75rem;border-radius:.75rem;border:none;font-size:.875rem;font-weight:500;cursor:pointer;transition:all .2s}
.btn-primary{background:rgba(96,165,250,.2);color:#60a5fa;border:1px solid rgba(96,165,250,.3)}
.btn-primary:hover{background:rgba(96,165,250,.3)}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.progress{display:none;margin-top:1.5rem}
.progress-bar{height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;margin-bottom:.5rem}
.progress-fill{height:100%;background:#60a5fa;border-radius:3px;transition:width .3s;width:0}
.progress-text{font-size:.75rem;color:rgba(255,255,255,.4)}
.error{color:#f87171;font-size:.8rem;margin-top:1rem;display:none}
.success{color:#4ade80;font-size:.8rem;margin-top:1rem;display:none}
</style>
</head>
<body>
<div class="container">
<h1>TinyTools</h1>
<p class="subtitle">Secure File Transfer</p>
<div class="file-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
<div class="file-name" id="fileName">Loading...</div>
<div class="file-size" id="fileSize"></div>
<div class="password-section" id="passwordSection" style="display:none">
<input type="password" id="passwordInput" placeholder="Enter password to download">
<p>This file is password-protected</p>
</div>
<button class="btn btn-primary" id="downloadBtn" onclick="startDownload()">Download File</button>
<div class="progress" id="progressSection">
<div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
<div class="progress-text" id="progressText">0%</div>
</div>
<div class="error" id="errorText"></div>
<div class="success" id="successText">Download complete!</div>
</div>
<script>
const params=new URLSearchParams(window.location.search);
const encrypted=params.get("encrypted")==="true";
const fileName=decodeURIComponent(params.get("name")||"file");
const fileSize=parseInt(params.get("size")||"0");
document.getElementById("fileName").textContent=fileName;
document.getElementById("fileSize").textContent=formatSize(fileSize);
if(encrypted)document.getElementById("passwordSection").style.display="block";
function formatSize(b){if(b<1024)return b+" B";if(b<1048576)return(b/1024).toFixed(1)+" KB";if(b<1073741824)return(b/1048576).toFixed(1)+" MB";return(b/1073741824).toFixed(2)+" GB"}
async function startDownload(){
const btn=document.getElementById("downloadBtn");
btn.disabled=true;btn.textContent="Downloading...";
document.getElementById("progressSection").style.display="block";
try{
const pwd=document.getElementById("passwordInput").value;
const url="/api/download"+(pwd?"?password="+encodeURIComponent(pwd):"");
const resp=await fetch(url);
if(!resp.ok){const e=await resp.json();throw new Error(e.error||"Download failed")}
const ct=resp.headers.get("content-length")||"0";
const total=parseInt(ct);
const reader=resp.body.getReader();
const dec=new TextDecoder();
let received=0;
while(true){
const{done,value}=await reader.read();
if(done)break;
received+=value.length;
const pct=total>0?Math.round(received/total*100):0;
document.getElementById("progressFill").style.width=pct+"%";
document.getElementById("progressText").textContent=formatSize(received)+" / "+formatSize(total)+" ("+pct+"%)";
const blob=new Blob([value]);
const a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download=fileName;
if(done){document.getElementById("successText").style.display="block";btn.textContent="Downloaded"}}
}catch(e){document.getElementById("errorText").textContent=e.message;document.getElementById("errorText").style.display="block";btn.disabled=false;btn.textContent="Retry Download"}}
</script>
</body></html>"#,
    )
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
    Query(query): Query<PortalQuery>,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let transfers = state.transfers.lock().await;
    let transfer = transfers.values().next().ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "No file available"})),
        )
    })?;

    if let Some(ref expected_pwd) = transfer.password {
        match &query.password {
            Some(pwd) if pwd == expected_pwd => {}
            _ => {
                return Err((
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({"error": "Invalid password"})),
                ));
            }
        }
    }

    let file_path = transfer.file_path.clone();
    let file_size = transfer.file_size;
    let file_name = transfer.file_name.clone();
    drop(transfers);

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

async fn receive_transfer(
    State(state): State<ServerState>,
    Query(_query): Query<TransferQuery>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    let content_length = headers
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(body.len() as u64);

    if content_type == "application/json" {
        let manifest: TransferManifest = serde_json::from_slice(&body).map_err(|e| {
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": e.to_string()})),
            )
        })?;

        let transfer_id = uuid_simple();
        let receiving = ReceivingTransfer {
            id: transfer_id.clone(),
            file_name: manifest.file_name,
            file_size: manifest.file_size,
            sender_name: "Remote Device".to_string(),
            password_hash: if manifest.encrypted {
                manifest.salt.clone()
            } else {
                None
            },
            status: "receiving".to_string(),
            bytes_received: 0,
            started_at: now_secs(),
        };

        let mut transfers = state.receiving_transfers.lock().await;
        transfers.insert(transfer_id.clone(), receiving);

        Ok(Json(serde_json::json!({
            "status": "ok",
            "transfer_id": transfer_id
        })))
    } else {
        let mut transfers = state.receiving_transfers.lock().await;
        let transfer = transfers.values_mut().next();

        if let Some(t) = transfer {
            let downloads = state.downloads_dir.lock().await;
            let file_path = std::path::Path::new(&*downloads).join(&t.file_name);

            tokio::fs::write(&file_path, &body)
                .await
                .map_err(|e| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(serde_json::json!({"error": e.to_string()})),
                    )
                })?;

            t.status = "completed".to_string();
            t.bytes_received = content_length;

            Ok(Json(serde_json::json!({
                "status": "ok",
                "saved_to": file_path.to_string_lossy()
            })))
        } else {
            Err((
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": "No active transfer"})),
            ))
        }
    }
}

pub async fn start_server(
    state: ServerState,
) -> Result<(u16, tokio::task::JoinHandle<()>), String> {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| format!("Failed to bind server: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let app = Router::new()
        .route("/", get(portal_page))
        .route("/api/info", get(get_portal_info))
        .route("/api/download", get(download_file))
        .route("/api/receive", post(receive_transfer))
        .with_state(state);

    let handle = tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    Ok((port, handle))
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn uuid_simple() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0], bytes[1], bytes[2], bytes[3],
        bytes[4], bytes[5],
        bytes[6], bytes[7],
        bytes[8], bytes[9],
        bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]
    )
}

use rand::rngs::OsRng;
