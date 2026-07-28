# TinyTools — Agent Memory

## Project Overview
Desktop app: **Tauri 2.0** (Rust backend) + **React 18** + **TypeScript** + **Tailwind CSS 3.4** + **Framer Motion**.
Offline-first utility toolkit — no cloud, no Python, no ONNX runtime.

**GitHub:** `https://github.com/Aninda7479/TinyTools`

---

## Environment
- **OS:** Windows (win32)
- **Dev tools:** VS 2026 Build Tools at `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat`
- **Rust:** 1.96.1 (MSRV safe — lopdf 0.44.0 requires 1.88+)
- **Node:** npm for frontend
- **Test images:** `C:\Users\anind\TestImages\` (created during testing)

---

## Crate Versions & API Quirks

### lopdf 0.44.0
- `Document::load(path)`, `Object::Real(f32)`, `Object::Name(Vec<u8>)`
- `Operation::new(&str, Vec<Object>)`, `StringFormat::Literal` / `Hexadecimal` only
- `Dictionary` has **no `.entries` field** — use `.get()`, `.set()`, `.remove()`
- `type_name()` returns `Result<&[u8]>` — byte literals like `b"Page"`
- `get_page_content()` returns `Vec<u8>`
- Merge uses `BTreeMap` / `renumber_objects_with` / `adjust_zero_pages`

### image 0.25
- `image::open()`, `.to_rgba8()`, `.save()`
- `RgbaImage::new()`, `put_pixel()`, `get_pixel()`
- `PngEncoder::new(&mut buf)` for PNG encoding (default features include png)

### ab_glyph 0.2
- `FontRef::try_from_slice()`, `font.glyph_id(ch)`, `font.as_scaled(scale).h_advance(glyph_id)`
- **Must import `ScaleFont` trait** to use `h_advance()`
- `outlined.draw(|px, py, coverage| { ... })` for rasterizing glyphs

### aes-gcm 0.10
- `Aes256Gcm::generate_nonce(&mut OsRng)` requires `AeadCore` trait in scope
- `GenericArray::from_slice()` for nonce from bytes

### imageproc 0.25
- `imageproc::drawing::draw_text_mut()` for text on images

### mdns-sd 0.11
- `ServiceDaemon::new()`, `daemon.browse(SERVICE_TYPE)` returns `Receiver<Result<ServiceEvent, Error>>`
- `ServiceInfo::new(type, instance, hostname, addr, port, properties)`
- `receiver.try_recv()` for non-blocking poll of discovered services
- `ServiceEvent::ServiceResolved(info)` — `info.get_addresses()`, `info.get_port()`, `info.get_hostname()`

### axum 0.7
- `Router::new().route(path, get(handler)).with_state(state)`
- `axum::serve(listener, app).await` — binds to `TcpListener`
- `Body::from_stream(stream)` for streaming file responses
- `State extractor` for shared state, `Query` for URL params

### reqwest 0.12
- `reqwest::Client::new()`, `.post(url).header().body().send().await`
- `resp.bytes().await` or `resp.text().await` for response body

---

## Rust Backend Structure (`src-tauri/src/`)

### `lib.rs`
- `mod commands;` (private)
- `mod p2p;` (private) — P2P file sharing module
- Registers all Tauri commands via `generate_handler![]`
- Plugins: `tauri_plugin_shell`, `tauri_plugin_fs`, `tauri_plugin_dialog`

### `commands/mod.rs`
- `compress_image`, `generate_qr_code`, `get_file_info`, `process_image`
- `process_image` parses JSON `params` for: resize (width/height), rotate (degrees), flip (direction), blur (sigma), sharpen (amount/radius)

### `commands/ai_tools.rs`
- `remove_background` — edge-sampled bg color, percentile+Otsu threshold, direct distance-to-alpha (S-curve), speck removal + hole fill
- `inpaint_image` — region fill from surrounding average color
- `upscale_image` — 2x/4x via Lanczos3 resize
- `sepia_filter` (renamed from `colorize_image`) — standard sepia matrix
- `smart_sharpen` (renamed from `face_enhance`) — edge-aware luminance sharpening
- `depth_blur` — radial blur from center

### `commands/privacy.rs`
- `strip_metadata` — re-encode without EXIF (clean, no dead code)
- `redact_regions` — blur/pixelate specified rectangles
- `add_watermark` — **real text rendering** via `ab_glyph` (Arial font from `C:\Windows\Fonts\arial.ttf`)
- `add_image_watermark` — overlay PNG with `position` parameter (top-left/top-right/bottom-left/bottom-right/center)

### `commands/pdf_tools.rs` (lopdf 0.44)
- 15 commands: merge, split, reorder, rotate, crop, delete, images_to_pdf, extract_text, compress, flatten, add_pdf_watermark, add_page_numbers
- `encrypt_pdf` — **real AES-256-GCM** file-level encryption with TTENC1 wire format + Argon2id KDF
- `decrypt_pdf` — reads TTENC1 header, derives key, decrypts
- `unwrap_pdf` — alias for `decrypt_pdf`

### `commands/encoder.rs` — 24 commands
- Base64, Base64URL, Base32, Base58, Hex, URL, HTML, Unicode, JWT inspector
- Morse code, Binary, Octal

### `commands/hasher.rs` — 4 commands
- Text/file hashing (MD5, SHA-1, SHA-256, SHA-512, BLAKE3, CRC32, Adler32, XXH3)
- Multi-hash all algorithms, verify file integrity

### `commands/encryption.rs` — 12 commands
- AES-256-GCM and ChaCha20-Poly1305 (text + file) with Argon2id KDF
- PBKDF2-SHA256 KDF (version byte 0x01)
- ROT13, Caesar, Vigenère, XOR classic ciphers
- **Wire format:** `[1 byte KDF version][4 bytes salt_len][salt][4 bytes nonce_len][nonce][ciphertext]`

### `commands/password_tools.rs` — 3 commands
- `generate_password`, `generate_bulk`, `export_passwords`
- 5 modes, CSPRNG via `OsRng`, bulk export
- `WORD_LIST` has ~2500+ dictionary words

### `commands/batch.rs`, `commands/compression.rs`, `commands/editing.rs`
- Batch: compress, resize, convert, watermark (with `batch-progress` events via `AppHandle::emit` + `AtomicU32`)
- Compression: smart_compress, convert_format, convert_heic, raster_to_svg
- Editing: smart_crop, expand_canvas, split_image, stitch_images

---

## P2P File Sharing Module (`src-tauri/src/p2p/`)

**Status:** Implemented, compiles clean (`cargo check` + `tsc --noEmit` pass).

### Architecture
- **Module singleton:** `OnceLock<Mutex<Option<P2PState>>>` in `p2p/mod.rs` — avoids Tauri state serialization issues
- **mDNS:** `_tinytools._tcp.local.` service type, auto-discovers peers on LAN
- **HTTP server:** Axum server on port 0 (OS-assigned), serves web portal + file receive API
- **Encryption:** AES-256-GCM + Argon2id KDF + HMAC-SHA256 password verification

### Files
| File | Purpose |
|------|---------|
| `p2p/mod.rs` | Module root, `P2PState`, `TransferState`, `TransferInfo`, `PeerListResult`, `SendResult`, `PortalResult` types |
| `p2p/encryption.rs` | `derive_key`, `compute_hmac`, `verify_hmac`, `encrypt_chunk`, `decrypt_chunk`, `encrypt_file`, `decrypt_file` |
| `p2p/mdns.rs` | `MdnsService` — `new()`, `register(port)`, `unregister()`, `poll_peers()`, `get_peers()` |
| `p2p/server.rs` | Axum HTTP server — routes: `/` (portal HTML), `/api/info`, `/api/download` (GET), `/api/receive` (POST) |
| `p2p/commands.rs` | 12 Tauri commands for frontend IPC |

### Tauri Commands (12)
- `start_discovery` / `stop_discovery` / `get_peers` — mDNS peer management
- `send_file(file_path, peer_ip, password?)` — encrypted P2P file transfer
- `start_web_portal(file_path, password?)` → `PortalResult { url, qr_code_base64, port }`
- `stop_web_portal` — shuts down axum server
- `get_transfer_progress(transfer_id)` → `TransferInfo` (speed_bps, eta_secs, bytes_sent, status)
- `cancel_transfer(transfer_id)`
- `is_receiving` / `start_receiving` / `stop_receiving` — receiver mode toggle
- `cleanup` — shuts down all P2P services

### Wire Protocol (Encrypted Transfer)
1. **Manifest** (JSON POST): `{file_name, file_size, encrypted, salt (base64), hmac (base64)}`
2. **Data** (binary POST): `[4B chunk_len][12B nonce][ciphertext+16B GCM_tag]` × N chunks
3. Password verified via HMAC-SHA256 before any decryption attempted
4. Chunk size: 256KB (`encryption::CHUNK_SIZE`)

### New Crates Added
- `mdns-sd = "0.11"` — mDNS service discovery
- `axum = "0.7"` — HTTP server for web portal
- `tower-http = "0.6"` (features: cors, fs) — middleware
- `tokio = "1"` (features: rt-multi-thread, net, macros, sync, time, io-util) — async runtime
- `tokio-util = "0.7"` (features: io) — `ReaderStream` for file streaming
- `local-ip-address = "0.6"` — get device LAN IP
- `reqwest = "0.12"` (features: stream) — HTTP client for sender→receiver POST
- `dirs-next = "2"` — downloads directory path
- `hostname = "0.4"` — device hostname for mDNS
- `futures = "0.3"` — async stream utilities

---

## Frontend Structure (`src/`)

### `lib/tauri.ts`
- All IPC bridge functions matching Rust commands (original tools)
- `processImage()` accepts `params?: Record<string, unknown>` (JSON stringified)
- `decryptPdf()` and `unwrapPdf()` both accept `password` param
- `addImageWatermark()` accepts optional `position` param

### `lib/p2p-api.ts`
- TypeScript bindings for all 12 P2P Tauri commands
- Types: `PeerInfo`, `PeerListResult`, `TransferInfo`, `SendResult`, `PortalResult`

### Key Pages
- `App.tsx` — tool routing switch with `activeTool` + `activeSub` state, `handleNavigate(tool, sub?)` callback
- `Welcome.tsx` — **redesigned**: 7 sections, 42 individual feature cards with `tag` badges, search across all cards. Each card navigates to specific sub-tool via `onNavigate(tool, sub)`
- `Sidebar.tsx` — tool type union (includes `"p2p"`), `onToolSelect: (tool: Tool, sub?: string) => void`
- `P2PPage.tsx` — main P2P page with 3 tabs: Send, Receive, Web Portal
- `P2PPeerList.tsx` — mDNS peer discovery list with Scan/Stop, auto-refresh 2s
- `P2PTransferProgress.tsx` — progress bar with speed/ETA, polls every 500ms
- `P2PWebPortal.tsx` — QR code PNG display, copyable URL, stop button
- `ImageProcess.tsx` — accepts `defaultSub` prop for direct nav (resize/grayscale/rotate/flip/blur/sharpen)
- `AiToolsPage.tsx` — accepts `defaultSub` (bg-remove/inpaint/upscale/sepia/smart-sharpen/depth-blur)
- `PrivacyPage.tsx` — accepts `defaultSub` (strip-metadata/redact/watermark)
- `EditingPage.tsx` — accepts `defaultSub` (crop/expand/split/stitch)
- `ConversionPage.tsx` — accepts `defaultSub` (compress/convert/heic/vectorize)
- `PdfToolsPage.tsx` — accepts `defaultSub`, 16 PDF tools with categories
- `EncoderDecoderPage.tsx` — accepts `defaultSub`, 12 encoding formats
- `HasherPage.tsx` — accepts `defaultSub` (text-hash/file-hash/multi-hash/verify)
- `EncryptionPage.tsx` — accepts `defaultSub` (text-aes/text-chacha/text-classic/file-aes/file-chacha)

### `defaultSub` Navigation Pattern
All pages with internal sub-tool selectors accept `{ defaultSub?: string }` prop.
Welcome cards pass sub-tool IDs that must match the page's internal type:
- AiToolsPage: `"bg-remove"`, `"inpaint"`, `"upscale"`, `"sepia"`, `"smart-sharpen"`, `"depth-blur"`
- PrivacyPage: `"strip-metadata"`, `"redact"`, `"watermark"`
- EditingPage: `"crop"`, `"expand"`, `"split"`, `"stitch"`
- ConversionPage: `"compress"`, `"convert"`, `"heic"`, `"vectorize"`
- ImageProcess: `"resize"`, `"grayscale"`, `"rotate"`, `"flip"`, `"blur"`, `"sharpen"`
- EncryptionPage: `"text-aes"`, `"text-chacha"`, `"text-classic"`, `"file-aes"`, `"file-chacha"`
- PdfToolsPage: `"info"`, `"merge"`, `"split"`, `"reorder"`, `"rotate"`, `"crop"`, `"delete"`, `"img2pdf"`, `"text"`, `"encrypt"`, `"decrypt"`, `"compress"`, `"flatten"`, `"watermark"`, `"pagenum"`
- EncoderDecoderPage: `"base64"`, `"base64url"`, `"base32"`, `"base58"`, `"hex"`, `"url"`, `"html"`, `"unicode"`, `"jwt"`, `"morse"`, `"binary"`, `"octal"`
- HasherPage: `"text-hash"`, `"file-hash"`, `"multi-hash"`, `"verify"`

### `components/ToolPage.tsx`
- Shared layout component with `OptionRow`, `OptionSlider`, `OptionSelect` exports

---

## Build & Test Commands

### Cargo (needs VS Build Tools env)
```powershell
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"" x64 >nul 2>&1 && cargo check 2>&1"
```

### Cargo test (unit tests in-module)
```powershell
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"" x64 >nul 2>&1 && cargo test --lib commands::ai_tools::tests -- --nocapture 2>&1"
```
**Note:** `cargo test` (not `--lib`) triggers Tauri build script which fails on capabilities validation. Use `--lib` for unit tests.

### TypeScript check
```powershell
npx tsc --noEmit
```

---

## Known Gotchas

1. **Must run via `npm run tauri dev`**, NOT `npm run dev` — the latter starts only Vite without the Tauri backend, causing `invoke` to be undefined
2. **`core:ipc:default` doesn't exist** in Tauri 2.11.5 — never add to capabilities. IPC is covered by `core:default`
3. **Missing capabilities file causes `invoke` undefined** — `src-tauri/capabilities/default.json` must exist for the IPC bridge to initialize
4. **`cargo test` vs `cargo test --lib`** — full test triggers Tauri build script capabilities validation; `--lib` skips it
5. **P2P state uses `OnceLock<Mutex<Option<P2PState>>>`** — NOT Tauri managed state, because `ServiceDaemon` doesn't impl `Serialize`. This avoids serialization issues.
6. **`bg_g.push(pl[2])` was a bug** in original code — should be `bg_b.push(pl[2])` (fixed in rewrite)
7. **BFS flood bug in bg removal** — `otsu_threshold - 0.1` went negative, causing everything to become foreground. Fixed by removing BFS entirely
8. **ab_glyph `h_advance` requires `ScaleFont` trait import** — `use ab_glyph::ScaleFont;`
9. **`cargo check` passes but `cargo test` may not** — always verify both
10. **P2P receiver port is hardcoded to 8787** — sender POSTs to `http://{peer_ip}:8787/api/receive`
11. **Web portal serves on port 0 (OS-assigned)** — actual port returned in `PortalResult.port`

---

## Git History (recent)
- `2688a47` — fix: rewrite background removal (BFS flood bug, percentile+Otsu, S-curve alpha)
- `8d929a6` — fix: replace 6 stub functions (encrypt_pdf, add_watermark, sepia, smart-sharpen, process_image, strip_metadata)
- `ab3fc09` — feat: KDF selection wired through encryption
- `e3cbc7a` — docs: README.md
- `8d66e38` — feat: password generator
- `32e51eb` — feat: QR generator with customization

---

## Tauri v2 Capabilities
- **File:** `src-tauri/capabilities/default.json`
- **Window name:** `main` (matches tauri.conf.json default)
- **Valid permissions:** `core:default`, `core:event:default`, `core:window:default`, `dialog:default`, `fs:default`, `shell:allow-open`
- **fs:scope:** `{"identifier": "fs:scope", "allow": [{"path": "**"}]}` — allows all file paths for custom Rust commands
- Custom commands registered via `invoke_handler` in `lib.rs` only need `core:default` to be callable from frontend

---

## In-Progress / Backlog
- [x] P2P file sharing module — Phase 1 (local Wi-Fi transfer + web portal) + Phase 2 (password-protected encrypted transfers)
- [ ] P2P: Cross-network WebRTC transfers (Phase 3 — deferred, needs signaling server)
- [ ] P2P: Pause/resume transfers
- [ ] P2P: Chunked streaming sender (currently reads full file into memory before sending)
- [ ] Real face detection for face_enhance/smart_sharpen (currently no face detection, just global sharpening)
- [ ] True AI colorization (currently sepia tone filter)
- [ ] Font fallback for watermark (hardcoded Arial — fails silently if font missing on non-Windows)

---

## UI Design Patterns

### Tailwind Theme
- **Colors:** `surface` (rgba(30,30,30,0.8)), `surface-solid` (#1e1e1e), `surface-hover` (rgba(50,50,50,0.8))
- **Border:** `border` (rgba(255,255,255,0.1)), `border-hover` (rgba(255,255,255,0.2))
- **Border radius:** `2xl` (1rem), `3xl` (1.5rem)

### Component Patterns
- **Framer Motion spring:** `{ type: "spring" as const, stiffness: 300, damping: 30 }`
- **Button style:** `bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30`
- **Input style:** `rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover`
- **Card style:** `rounded-2xl border border-border bg-surface/50 backdrop-blur-xl`
- **Option label:** `text-[10px] text-white/30 uppercase tracking-wider`
- **Small text:** `text-[10px] text-white/20` for footer/disclaimers
