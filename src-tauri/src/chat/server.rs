use axum::body::Bytes;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{DefaultBodyLimit, Path, Query};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::chat::{
    create_room, get_room, hex, now_secs, random_bytes, uuid_simple, ChatMessage, FileBlob,
    MemberInfo, Room, RoomEvent, FILE_TTL_SECS, MAX_FILE_BYTES, MAX_FILES, MESSAGES_PER_SECOND,
};

fn install_tls_provider() {
    let _ = rustls::crypto::ring::default_provider().install_default();
}

fn with_room<T>(f: impl FnOnce(&Room) -> T) -> Option<T> {
    get_room().lock().ok().and_then(|g| g.as_ref().map(f))
}

fn with_room_mut<T>(f: impl FnOnce(&mut Room) -> T) -> Option<T> {
    get_room().lock().ok().and_then(|mut g| g.as_mut().map(f))
}

fn header(headers: &HeaderMap, key: &str) -> String {
    headers
        .get(key)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string()
}

fn is_valid_token(token: &str) -> bool {
    with_room(|r| r.auth.contains_key(token)).unwrap_or(false)
}

/// Ensure a room exists for homelab mode. Returns (password, salt).
pub fn ensure_homelab_room() -> Result<(String, Vec<u8>), String> {
    let password = match std::env::var("TINYTOOLS_CHAT_PASSWORD") {
        Ok(p) if !p.is_empty() => p,
        _ => hex(&random_bytes(8)),
    };
    let salt = create_room(password.clone())?;
    Ok((password, salt))
}

pub fn chat_routes() -> Router<()> {
    Router::new()
        .route("/chat", get(chat_page))
        .route("/api/chat/auth", post(auth_handler))
        .route("/api/chat/ws", get(ws_handler))
        .route("/api/chat/files", post(upload_file_handler))
        .route("/api/chat/files/:id", get(download_file_handler))
}

// ── Pages ───────────────────────────────────────────────────────────────

async fn chat_page() -> Html<String> {
    Html(crate::chat::chat_page::CHAT_HTML.to_string())
}

// ── Auth ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AuthRequest {
    password: String,
    name: String,
}

#[derive(serde::Serialize)]
struct AuthResponse {
    client_id: String,
    send_token: String,
    salt: String,
    members: Vec<MemberInfo>,
    ts: u64,
}

async fn auth_handler(
    Json(req): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, Json<serde_json::Value>)> {
    let salt = with_room(|r| r.salt.clone())
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "Room not found"})),
            )
        })?;
    let room_password = with_room(|r| r.password.clone()).unwrap_or_default();

    if room_password != req.password {
        tokio::time::sleep(Duration::from_secs(2)).await;
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Incorrect room password"})),
        ));
    }

    let name = req.name.trim().to_string();
    let name_chars = name.chars().count();
    if name.is_empty() || name_chars > 24 {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "Name must be 1-24 characters"})),
        ));
    }

    let client_id = uuid_simple();
    let send_token = random_token();

    {
        with_room_mut(|r| {
            r.members.insert(client_id.clone(), name.clone());
            r.auth.insert(send_token.clone(), client_id.clone());
        });
    }

    let members = with_room(|r| {
        r.members
            .iter()
            .map(|(id, n)| MemberInfo {
                id: id.clone(),
                name: n.clone(),
            })
            .collect()
    })
    .unwrap_or_default();

    Ok(Json(AuthResponse {
        client_id,
        send_token,
        salt: STANDARD.encode(salt),
        members,
        ts: now_secs(),
    }))
}

fn random_token() -> String {
    hex(&random_bytes(32))
}

// ── WebSocket ───────────────────────────────────────────────────────────

async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    let token = params.get("token").cloned().unwrap_or_default();
    ws.on_upgrade(move |socket| handle_ws(socket, token))
}

#[derive(Deserialize)]
struct ClientMsg {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default)]
    nonce: Option<String>,
    #[serde(default)]
    ciphertext: Option<String>,
    #[serde(default)]
    file_id: Option<String>,
    #[serde(default)]
    file_name: Option<String>,
    #[serde(default)]
    file_size: Option<u64>,
    #[serde(default)]
    mime: Option<String>,
    /// WebRTC signaling: target recipient client_id.
    #[serde(default)]
    to: Option<String>,
    /// WebRTC signaling: opaque JSON payload relayed only to `to`.
    #[serde(default)]
    signal: Option<serde_json::Value>,
    /// Video-call membership action: "join" | "leave".
    #[serde(default)]
    action: Option<String>,
}

async fn handle_ws(socket: WebSocket, token: String) {
    let Some((client_id, name)) = with_room(|r| {
        r.auth
            .get(&token)
            .and_then(|cid| r.members.get(cid).map(|n| (cid.clone(), n.clone())))
    })
    .flatten()
    else {
        return;
    };

    let conn_id = uuid_simple();
    let (mut tx, mut rx) = socket.split();
    let (msg_tx, mut msg_rx) = tokio::sync::mpsc::unbounded_channel::<Message>();
    {
        with_room_mut(|r| {
            r.connections.insert(client_id.clone(), (conn_id.clone(), msg_tx.clone()));
        });
    }

    // Subscribe to the room broadcast BEFORE announcing the join so this
    // member also receives their own join notice (everyone is notified).
    let Some(btx) = with_room(|r| r.broadcast.clone()) else {
        return;
    };
    let mut brx = btx.subscribe();
    let fwd_tx = msg_tx.clone();
    let fwd_task = tokio::spawn(async move {
        while let Ok(ev) = brx.recv().await {
            if let Ok(s) = serde_json::to_string(&ev) {
                let _ = fwd_tx.send(Message::Text(s.into()));
            }
        }
    });

    // Send "welcome" (roster + current video-call participants) to this member.
    let members: Vec<MemberInfo> = with_room(|r| {
        r.members
            .iter()
            .map(|(id, n)| MemberInfo {
                id: id.clone(),
                name: n.clone(),
            })
            .collect()
    })
    .unwrap_or_default();
    let call_members: Vec<MemberInfo> = with_room(|r| r.call_members.values().cloned().collect())
        .unwrap_or_default();
    let welcome = RoomEvent::welcome(client_id.clone(), name.clone(), members, call_members);
    let _ = msg_tx.send(Message::Text(
        serde_json::to_string(&welcome).unwrap_or_default().into(),
    ));

    // Broadcast the join to everyone (including self).
    let _ = btx.send(RoomEvent::member(
        "join",
        MemberInfo {
            id: client_id.clone(),
            name: name.clone(),
        },
    ));

    let mut last_activity = Instant::now();
    let mut window = Instant::now();
    let mut rate_count: u32 = 0;

    loop {
        tokio::select! {
            outgoing = msg_rx.recv() => {
                match outgoing {
                    Some(m) => { if tx.send(m).await.is_err() { break; } }
                    None => break,
                }
            }
            incoming = rx.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        last_activity = Instant::now();
                        if window.elapsed().as_secs() >= 1 {
                            window = Instant::now();
                            rate_count = 0;
                        }
                        rate_count += 1;
                        if rate_count <= MESSAGES_PER_SECOND {
                            handle_client_message(&btx, &client_id, &name, &text);
                        }
                    }
                    Some(Ok(Message::Close(_))) | Some(Err(_)) | None => break,
                    Some(Ok(_)) => {}
                }
            }
            _ = tokio::time::sleep(Duration::from_secs(10)) => {
                // Generous idle timeout: background tabs can throttle timers.
                if last_activity.elapsed() > Duration::from_secs(180) {
                    break;
                }
            }
        }
    }

    fwd_task.abort();
    {
        with_room_mut(|r| {
            if let Some((existing_conn_id, _)) = r.connections.get(&client_id) {
                if existing_conn_id == &conn_id {
                    r.connections.remove(&client_id);
                }
            }
        });
    }

    // If they were in a call, remove them immediately
    let was_in_call =
        with_room_mut(|r| r.call_members.remove(&client_id).is_some()).unwrap_or(false);
    if was_in_call {
        broadcast_call_state(&btx);
    }

    let still_connected = with_room(|r| r.connections.contains_key(&client_id)).unwrap_or(false);
    if !still_connected {
        let client_id_clone = client_id.clone();
        let btx_clone = btx.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_secs(20)).await;
            let still_disconnected = with_room(|r| !r.connections.contains_key(&client_id_clone)).unwrap_or(true);
            if still_disconnected {
                let removed = with_room_mut(|r| {
                    r.auth.retain(|_, v| v != &client_id_clone);
                    r.members.remove(&client_id_clone)
                })
                .flatten();
                if let Some(removed_name) = removed {
                    let _ = btx_clone.send(RoomEvent::member(
                        "leave",
                        MemberInfo {
                            id: client_id_clone.clone(),
                            name: removed_name,
                        },
                    ));
                }
            }
        });
    }
}

fn broadcast_call_state(btx: &tokio::sync::broadcast::Sender<RoomEvent>) {
    let call_members: Vec<MemberInfo> = with_room(|r| r.call_members.values().cloned().collect())
        .unwrap_or_default();
    let _ = btx.send(RoomEvent::call_state(call_members));
}

fn handle_client_message(
    btx: &tokio::sync::broadcast::Sender<RoomEvent>,
    client_id: &str,
    name: &str,
    text: &str,
) {
    let parsed: ClientMsg = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => return,
    };

    match parsed.msg_type.as_str() {
        "pong" => {}
        "msg" => {
            let Some(kind) = parsed.kind else { return };
            if kind != "text" && kind != "image" && kind != "file" {
                return;
            }
            if kind == "text" && (parsed.nonce.is_none() || parsed.ciphertext.is_none()) {
                return;
            }
            let msg = ChatMessage {
                id: uuid_simple(),
                kind,
                from: MemberInfo {
                    id: client_id.to_string(),
                    name: name.to_string(),
                },
                nonce: parsed.nonce,
                ciphertext: parsed.ciphertext,
                file_id: parsed.file_id,
                file_name: parsed.file_name,
                file_size: parsed.file_size,
                mime: parsed.mime,
                ts: now_secs(),
            };
            let _ = btx.send(RoomEvent::message(msg));
        }
        "signal" => {
            // Relay WebRTC signaling to exactly one peer. The server never
            // inspects the payload — media itself flows P2P between browsers.
            let Some(to) = parsed.to else { return };
            let Some(payload) = parsed.signal else { return };
            let target = with_room(|r| r.connections.get(&to).map(|(_, tx)| tx.clone())).flatten();
            if let Some(tx) = target {
                let ev = RoomEvent::signal(client_id.to_string(), name.to_string(), to, payload);
                let _ = tx.send(Message::Text(
                    serde_json::to_string(&ev).unwrap_or_default().into(),
                ));
            }
        }
        "call" => {
            // Room-wide video call membership. Media itself is peer-to-peer;
            // the server only keeps the participant list and notifies everyone.
            let Some(action) = parsed.action.as_deref() else { return };
            match action {
                "join" => {
                    with_room_mut(|r| {
                        r.call_members.insert(
                            client_id.to_string(),
                            MemberInfo {
                                id: client_id.to_string(),
                                name: name.to_string(),
                            },
                        );
                    });
                    broadcast_call_state(btx);
                }
                "leave" => {
                    with_room_mut(|r| {
                        r.call_members.remove(client_id);
                    });
                    broadcast_call_state(btx);
                }
                _ => {}
            }
        }
        _ => {}
    }
}

// ── Files (in-memory relay) ─────────────────────────────────────────────

async fn upload_file_handler(
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let token = header(&headers, "X-Chat-Token");
    if !is_valid_token(&token) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Not authenticated"})),
        ));
    }

    if body.len() as u64 > MAX_FILE_BYTES {
        return Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            Json(serde_json::json!({"error": "File exceeds 50 MB limit"})),
        ));
    }

    let name = headers
        .get("X-Chat-Filename")
        .and_then(|v| v.to_str().ok())
        .map(|v| urlencoding::decode(v).unwrap_or_default().to_string())
        .unwrap_or_else(|| "file".to_string());
    let name: String = name.chars().take(160).collect();

    let size = headers
        .get("X-Chat-FileSize")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(body.len() as u64);

    let mime = headers
        .get("X-Chat-Mime")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    let now = now_secs();
    let file_id = uuid_simple();

    let saved = with_room_mut(|r| {
        r.files.retain(|_, f| now.saturating_sub(f.created_at) <= FILE_TTL_SECS);
        if r.files.len() >= MAX_FILES {
            let mut oldest_id: Option<String> = None;
            let mut oldest_ts = u64::MAX;
            for (id, f) in r.files.iter() {
                if f.created_at < oldest_ts {
                    oldest_ts = f.created_at;
                    oldest_id = Some(id.clone());
                }
            }
            if let Some(id) = oldest_id {
                r.files.remove(&id);
            }
        }
        r.files.insert(
            file_id.clone(),
            FileBlob {
                bytes: Arc::new(body.to_vec()),
                name,
                size,
                mime,
                created_at: now,
            },
        );
    });

    if saved.is_none() {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({"error": "Room not found"})),
        ));
    }

    Ok(Json(serde_json::json!({"file_id": file_id})))
}

async fn download_file_handler(
    Path(id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let token = header(&headers, "X-Chat-Token");
    if !is_valid_token(&token) {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "Not authenticated"})),
        ));
    }

    let blob = with_room(|r| r.files.get(&id).cloned())
        .flatten()
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "File not found or expired"})),
            )
        })?;

    let mut h = HeaderMap::new();
    h.insert(
        "content-type",
        "application/octet-stream".parse().unwrap(),
    );
    h.insert("content-length", blob.bytes.len().to_string().parse().unwrap());
    h.insert("x-chat-filename", blob.name.parse().unwrap());

    Ok((h, Bytes::from(blob.bytes.to_vec())).into_response())
}

// ── Server setup ────────────────────────────────────────────────────────

pub async fn start_server(local_ip: &str) -> Result<(u16, tokio::task::JoinHandle<()>), String> {
    install_tls_provider();
    let listener = std::net::TcpListener::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind chat server: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let certified_key = rcgen::generate_simple_self_signed(vec![
        "localhost".to_string(),
        local_ip.to_string(),
    ])
    .map_err(|e| format!("Failed to generate chat certificate: {}", e))?;
    let tls_config = axum_server::tls_rustls::RustlsConfig::from_pem(
        certified_key.cert.pem().into_bytes(),
        certified_key.key_pair.serialize_pem().into_bytes(),
    )
    .await
    .map_err(|e| format!("Failed to configure chat TLS: {}", e))?;

    let app = chat_routes().layer(DefaultBodyLimit::max(MAX_FILE_BYTES as usize + (1 << 20)));

    let handle = tokio::spawn(async move {
        let _ = axum_server::from_tcp_rustls(listener, tls_config)
            .serve(app.into_make_service())
            .await;
    });

    Ok((port, handle))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chat::{create_room, destroy_room};
    use serde_json::json;
    use tokio_tungstenite::connect_async;
    use tokio_tungstenite::tungstenite::Message as WsMessage;

    /// Serializes tests that mutate the global room state.
    fn test_lock() -> &'static std::sync::Mutex<()> {
        static LOCK: std::sync::OnceLock<std::sync::Mutex<()>> = std::sync::OnceLock::new();
        LOCK.get_or_init(|| std::sync::Mutex::new(()))
    }

    async fn start_test_server() -> String {
        let app = chat_routes().layer(DefaultBodyLimit::max(MAX_FILE_BYTES as usize + (1 << 20)));
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let _ = axum::serve(listener, app).await;
        });
        format!("http://{}", addr)
    }

    #[tokio::test]
    async fn chat_room_e2e() {
        let _guard = test_lock().lock().unwrap();
        destroy_room().unwrap();
        create_room("hunter2".to_string()).unwrap();

        let base = start_test_server().await;
        let client = reqwest::Client::new();

        // 1. Wrong password is rejected.
        let resp = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "wrong", "name": "Eve"}))
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::UNAUTHORIZED);

        // 2. Correct auth returns token + salt + roster.
        let resp = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "Alice"}))
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::OK);
        let auth: serde_json::Value = resp.json().await.unwrap();
        let token = auth["send_token"].as_str().unwrap().to_string();
        assert!(!auth["salt"].as_str().unwrap().is_empty());
        assert_eq!(auth["members"].as_array().unwrap().len(), 1);
        let alice_id = auth["client_id"].as_str().unwrap().to_string();

        // 3. Upload an encrypted file blob.
        let resp = client
            .post(format!("{}/api/chat/files", base))
            .header("X-Chat-Token", &token)
            .header("X-Chat-Filename", "hello%20world.txt")
            .header("X-Chat-FileSize", "11")
            .header("X-Chat-Mime", "text/plain")
            .body(b"secret-bytes".to_vec())
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::OK);
        let upload: serde_json::Value = resp.json().await.unwrap();
        let file_id = upload["file_id"].as_str().unwrap().to_string();

        // 4. Download the blob back (opaque ciphertext — server never sees plaintext).
        let resp = client
            .get(format!("{}/api/chat/files/{}", base, file_id))
            .header("X-Chat-Token", &token)
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::OK);
        assert_eq!(resp.bytes().await.unwrap().as_ref(), b"secret-bytes");

        // 5. Unauthenticated file access is rejected.
        let resp = client
            .get(format!("{}/api/chat/files/{}", base, file_id))
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::UNAUTHORIZED);

        // 6. WebSocket: welcome + join, then message echo with stamped identity.
        let url = base
            .replace("http", "ws")
            + format!("/api/chat/ws?token={}", token).as_str();
        let (mut ws, _) = connect_async(&url).await.unwrap();

        let first = ws.next().await.unwrap().unwrap();
        let welcome: serde_json::Value = serde_json::from_str(first.to_text().unwrap()).unwrap();
        assert_eq!(welcome["type"], "welcome");
        assert_eq!(welcome["client_id"], alice_id);

        let second = ws.next().await.unwrap().unwrap();
        let join: serde_json::Value = serde_json::from_str(second.to_text().unwrap()).unwrap();
        assert_eq!(join["type"], "member");
        assert_eq!(join["action"], "join");
        assert_eq!(join["member"]["name"], "Alice");

        // Send an encrypted text message; server stamps from + ts and rebroadcasts.
        ws.send(WsMessage::Text(
            json!({"type":"msg","kind":"text","nonce":"n","ciphertext":"c"})
                .to_string()
                .into(),
        ))
        .await
        .unwrap();

        let mut echoed = None;
        for _ in 0..8 {
            if let Some(Ok(m)) = ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "msg" {
                    echoed = Some(v);
                    break;
                }
            }
        }
        let echoed = echoed.expect("message was not echoed back");
        assert_eq!(echoed["message"]["kind"], "text");
        assert_eq!(echoed["message"]["nonce"], "n");
        assert_eq!(echoed["message"]["from"]["id"], alice_id);
        assert_eq!(echoed["message"]["from"]["name"], "Alice");

        // 7. Heartbeat pong is accepted without error.
        ws.send(WsMessage::Text(json!({"type":"pong"}).to_string().into()))
            .await
            .unwrap();

        // 8. A second member (Bob) joins and is notified.
        let bob_resp = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "Bob"}))
            .send()
            .await
            .unwrap();
        let bob_auth: serde_json::Value = bob_resp.json().await.unwrap();
        let bob_token = bob_auth["send_token"].as_str().unwrap().to_string();
        let bob_url = base.replace("http", "ws")
            + format!("/api/chat/ws?token={}", bob_token).as_str();
        let (mut bob_ws, _) = connect_async(&bob_url).await.unwrap();

        let mut bob_welcome_has_both = false;
        let mut bob_saw_self_join = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "welcome" {
                    let names: Vec<&str> = v["members"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|x| x["name"].as_str().unwrap())
                        .collect();
                    bob_welcome_has_both = names.contains(&"Alice") && names.contains(&"Bob");
                } else if v["type"] == "member" && v["action"] == "join" && v["member"]["name"] == "Bob" {
                    bob_saw_self_join = true;
                }
                if bob_welcome_has_both && bob_saw_self_join {
                    break;
                }
            }
        }
        assert!(bob_welcome_has_both, "Bob's welcome roster must list Alice and Bob");
        assert!(bob_saw_self_join, "Bob must receive a join notice for himself");

        // 9. Alice leaves (socket dropped) -> Bob is notified.
        drop(ws);
        let mut bob_saw_alice_leave = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "member" && v["action"] == "leave" && v["member"]["name"] == "Alice" {
                    bob_saw_alice_leave = true;
                    break;
                }
            }
        }
        assert!(bob_saw_alice_leave, "Bob must be notified when Alice leaves");

        // 10. TLS end-to-end: the production server (axum-server + rustls) must
        // serve HTTPS auth and a wss websocket with a self-signed certificate.
        let (port, handle) = super::start_server("127.0.0.1").await.unwrap();
        let base = format!("https://127.0.0.1:{}", port);
        let tls_client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap();

        let resp = tls_client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "TLS User"}))
            .send()
            .await
            .unwrap();
        assert_eq!(resp.status(), reqwest::StatusCode::OK);
        let auth: serde_json::Value = resp.json().await.unwrap();
        let tls_token = auth["send_token"].as_str().unwrap().to_string();
        let tls_client_id = auth["client_id"].as_str().unwrap().to_string();

        let url = format!("wss://127.0.0.1:{}/api/chat/ws?token={}", port, tls_token);
        let (mut tls_ws, _) = tokio_tungstenite::connect_async_tls_with_config(
            url,
            None,
            false,
            Some(tokio_tungstenite::Connector::Rustls(Arc::new(
                permissive_tls_config(),
            ))),
        )
        .await
        .unwrap();

        let first = tls_ws.next().await.unwrap().unwrap();
        let welcome: serde_json::Value = serde_json::from_str(first.to_text().unwrap()).unwrap();
        assert_eq!(welcome["type"], "welcome");
        assert_eq!(welcome["client_id"], tls_client_id);

        let second = tls_ws.next().await.unwrap().unwrap();
        let join: serde_json::Value = serde_json::from_str(second.to_text().unwrap()).unwrap();
        assert_eq!(join["type"], "member");
        assert_eq!(join["action"], "join");
        assert_eq!(join["member"]["name"], "TLS User");

        tls_ws
            .send(WsMessage::Text(
                json!({"type":"msg","kind":"text","nonce":"n","ciphertext":"c"})
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();
        let mut tls_echoed = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = tls_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "msg" {
                    tls_echoed = true;
                    break;
                }
            }
        }
        assert!(tls_echoed, "TLS websocket did not echo the message");

        drop(tls_ws);
        handle.abort();

        drop(bob_ws);
        destroy_room().unwrap();
    }

    #[tokio::test]
    async fn chat_signal_relay() {
        let _guard = test_lock().lock().unwrap();
        destroy_room().unwrap();
        create_room("hunter2".to_string()).unwrap();

        let base = start_test_server().await;
        let client = reqwest::Client::new();

        let alice: serde_json::Value = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "Alice"}))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let alice_token = alice["send_token"].as_str().unwrap().to_string();
        let alice_id = alice["client_id"].as_str().unwrap().to_string();

        let bob: serde_json::Value = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "Bob"}))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let bob_token = bob["send_token"].as_str().unwrap().to_string();
        let bob_id = bob["client_id"].as_str().unwrap().to_string();

        let alice_url =
            base.replace("http", "ws") + format!("/api/chat/ws?token={}", alice_token).as_str();
        let (mut alice_ws, _) = connect_async(&alice_url).await.unwrap();
        let bob_url = base.replace("http", "ws") + format!("/api/chat/ws?token={}", bob_token).as_str();
        let (mut bob_ws, _) = connect_async(&bob_url).await.unwrap();

        // Drain welcome + join notices on both sockets.
        for _ in 0..8 {
            if let Some(Ok(m)) = alice_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "welcome" {
                    break;
                }
            }
        }
        for _ in 0..8 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "welcome" {
                    break;
                }
            }
        }

        // Alice sends a WebRTC "call" signal to Bob.
        alice_ws
            .send(WsMessage::Text(
                json!({"type":"signal","to":bob_id,"signal":{"kind":"call","offer":{"type":"offer","sdp":"x"}}})
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();

        // Bob receives it, stamped with Alice's identity.
        let mut got = None;
        for _ in 0..8 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "signal" {
                    got = Some(v);
                    break;
                }
            }
        }
        let got = got.expect("signal was not relayed to the target");
        assert_eq!(got["to"], bob_id);
        assert_eq!(got["client_id"], alice_id);
        assert_eq!(got["signal"]["kind"], "call");
        assert_eq!(got["signal"]["offer"]["sdp"], "x");

        // Bob answers back to Alice.
        bob_ws
            .send(WsMessage::Text(
                json!({"type":"signal","to":alice_id,"signal":{"kind":"answer","answer":{"type":"answer","sdp":"y"}}})
                    .to_string()
                    .into(),
            ))
            .await
            .unwrap();
        let mut answered = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = alice_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "signal" && v["signal"]["kind"] == "answer" {
                    assert_eq!(v["to"], alice_id);
                    assert_eq!(v["client_id"], bob_id);
                    answered = true;
                    break;
                }
            }
        }
        assert!(answered, "answer signal was not relayed back to Alice");

        // Signals must NOT be broadcast back to the sender.
        let leaked = tokio::time::timeout(Duration::from_millis(400), alice_ws.next())
            .await
            .ok()
            .flatten()
            .and_then(|r| r.ok());
        assert!(leaked.is_none(), "signal leaked to the sender");

        drop(alice_ws);
        drop(bob_ws);
        destroy_room().unwrap();
    }

    #[tokio::test]
    async fn chat_call_state() {
        let _guard = test_lock().lock().unwrap();
        destroy_room().unwrap();
        create_room("hunter2".to_string()).unwrap();

        let base = start_test_server().await;
        let client = reqwest::Client::new();

        // Alice joins the room.
        let alice: serde_json::Value = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "Alice"}))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let alice_token = alice["send_token"].as_str().unwrap().to_string();
        let alice_url =
            base.replace("http", "ws") + format!("/api/chat/ws?token={}", alice_token).as_str();
        let (mut alice_ws, _) = connect_async(&alice_url).await.unwrap();

        // Welcome must include an (empty) call_members list.
        let mut welcome_has_call = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = alice_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "welcome" {
                    welcome_has_call = v["call_members"]
                        .as_array()
                        .map(|a| a.is_empty())
                        .unwrap_or(false);
                    break;
                }
            }
        }
        assert!(welcome_has_call, "welcome should include an empty call_members list");

        // Alice starts the call.
        alice_ws
            .send(WsMessage::Text(json!({"type":"call","action":"join"}).to_string().into()))
            .await
            .unwrap();
        let mut alice_only = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = alice_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "call-state" {
                    let arr = v["call_members"].as_array().unwrap();
                    assert_eq!(arr.len(), 1);
                    assert_eq!(arr[0]["name"], "Alice");
                    alice_only = true;
                    break;
                }
            }
        }
        assert!(alice_only, "Alice should receive a call-state listing herself");

        // Bob joins the room mid-call; his welcome lists Alice as in the call.
        let bob: serde_json::Value = client
            .post(format!("{}/api/chat/auth", base))
            .json(&json!({"password": "hunter2", "name": "Bob"}))
            .send()
            .await
            .unwrap()
            .json()
            .await
            .unwrap();
        let bob_token = bob["send_token"].as_str().unwrap().to_string();
        let bob_url =
            base.replace("http", "ws") + format!("/api/chat/ws?token={}", bob_token).as_str();
        let (mut bob_ws, _) = connect_async(&bob_url).await.unwrap();

        let mut bob_saw_alice = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "welcome" {
                    let names: Vec<&str> = v["call_members"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(|x| x["name"].as_str().unwrap())
                        .collect();
                    bob_saw_alice = names.contains(&"Alice");
                    break;
                }
            }
        }
        assert!(bob_saw_alice, "Bob's welcome should list Alice as in the call");

        // Bob joins the call; both get a two-member call-state.
        bob_ws
            .send(WsMessage::Text(json!({"type":"call","action":"join"}).to_string().into()))
            .await
            .unwrap();
        let mut both_saw_two = false;
        for _ in 0..8 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "call-state" {
                    if v["call_members"].as_array().unwrap().len() == 2 {
                        both_saw_two = true;
                        break;
                    }
                }
            }
        }
        assert!(both_saw_two, "call-state should list both participants");

        // Bob leaves the call; Alice sees only herself next.
        bob_ws
            .send(WsMessage::Text(json!({"type":"call","action":"leave"}).to_string().into()))
            .await
            .unwrap();
        let mut alice_sees_leave = false;
        for _ in 0..16 {
            if let Some(Ok(m)) = alice_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "call-state" {
                    let arr = v["call_members"].as_array().unwrap();
                    let names: Vec<&str> =
                        arr.iter().map(|x| x["name"].as_str().unwrap()).collect();
                    if names.contains(&"Alice") && !names.contains(&"Bob") {
                        alice_sees_leave = true;
                        break;
                    }
                }
            }
        }
        assert!(alice_sees_leave, "Alice should see Bob leave the call");

        // Alice disconnects; the server broadcasts an empty call-state.
        drop(alice_ws);
        let mut bob_sees_empty = false;
        for _ in 0..16 {
            if let Some(Ok(m)) = bob_ws.next().await {
                let v: serde_json::Value = serde_json::from_str(m.to_text().unwrap()).unwrap();
                if v["type"] == "call-state" && v["call_members"].as_array().unwrap().is_empty() {
                    bob_sees_empty = true;
                    break;
                }
            }
        }
        assert!(bob_sees_empty, "Bob should be told the call ended when Alice disconnects");

        drop(bob_ws);
        destroy_room().unwrap();
    }

    fn permissive_tls_config() -> rustls::ClientConfig {
        use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
        use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
        use rustls::{DigitallySignedStruct, SignatureScheme};

        #[derive(Debug)]
        struct Permissive;

        impl ServerCertVerifier for Permissive {
            fn verify_server_cert(
                &self,
                _end_entity: &CertificateDer<'_>,
                _intermediates: &[CertificateDer<'_>],
                _server_name: &ServerName<'_>,
                _ocsp_response: &[u8],
                _now: UnixTime,
            ) -> Result<ServerCertVerified, rustls::Error> {
                Ok(ServerCertVerified::assertion())
            }
            fn verify_tls12_signature(
                &self,
                _message: &[u8],
                _cert: &CertificateDer<'_>,
                _dss: &DigitallySignedStruct,
            ) -> Result<HandshakeSignatureValid, rustls::Error> {
                Ok(HandshakeSignatureValid::assertion())
            }
            fn verify_tls13_signature(
                &self,
                _message: &[u8],
                _cert: &CertificateDer<'_>,
                _dss: &DigitallySignedStruct,
            ) -> Result<HandshakeSignatureValid, rustls::Error> {
                Ok(HandshakeSignatureValid::assertion())
            }
            fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
                vec![
                    SignatureScheme::RSA_PKCS1_SHA256,
                    SignatureScheme::RSA_PKCS1_SHA384,
                    SignatureScheme::RSA_PKCS1_SHA512,
                    SignatureScheme::ECDSA_NISTP256_SHA256,
                    SignatureScheme::ECDSA_NISTP384_SHA384,
                    SignatureScheme::ED25519,
                ]
            }
        }

        rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .unwrap()
            .dangerous()
            .with_custom_certificate_verifier(Arc::new(Permissive))
            .with_no_client_auth()
    }
}
