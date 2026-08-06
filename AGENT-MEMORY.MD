# TinyTools — Agent Memory

**Stack:** Tauri 2.0 (Rust) + React 18 + TS + Tailwind 3.4 + Framer Motion | Offline-first utility toolkit
**OS:** Windows | **Rust:** 1.96.1 | **Cargo test:** use `--lib` flag to skip Tauri build script

---

## Rust Backend (`src-tauri/src/commands/`)

| Module | Key Commands | Notes |
|--------|-------------|-------|
| `pdf_tools.rs` | merge, split, reorder, rotate, crop, delete, images_to_pdf, extract_text, encrypt/decrypt/unwrap, compress, flatten, watermark, pagenum, **get_pdf_info** | lopdf 0.44. `PdfInfo` struct now returns: page_count, file_size_str, version_label, title/author/subject/keywords/creator/producer, creation/modification dates, page_width/height/page_size_label/orientation, encrypted/has_acroform, printing/copying/modification_allowed. 29 tests. |
| `encryption.rs` | AES-256-GCM + ChaCha20-Poly1305 (text+file), Argon2id/PBKDF2, ROT13/Caesar/Vigenère/XOR. `encrypt_xor` accepts `encoding` param (raw/hex/base64). | Wire: `[1B KDF ver][4B salt_len][salt][4B nonce_len][nonce][ciphertext]` |
| `encoder.rs` | 12 formats + file mode (`encode_file`, `decode_file`, `decode_text_to_file`) | Binary-capable: base64/url/b32/b58/hex/binary/octal |
| `hasher.rs` | MD5, SHA-1/256/512, BLAKE3, CRC32, Adler32, XXH3 — text/file/multi-hash/verify | |
| `password_tools.rs` | 5 modes (random/passphrase/pin/pronounceable/pattern), CSPRING OsRng | `capitalize`, `append_digit`, `append_symbol`, `syllable_separator` |
| `ai_tools.rs` | remove_background, inpaint_image, upscale_image (2x/4x Lanczos3), sepia_filter, smart_sharpen, depth_blur | Edge-sampled bg + Otsu threshold |
| `privacy.rs` | strip_metadata, redact_regions, add_watermark (ab_glyph + Arial.ttf), add_image_watermark | |
| `editing.rs` | smart_crop, expand_canvas, split_image, stitch_images | |
| `compression.rs` | smart_compress, convert_format, convert_heic, raster_to_svg | |
| `batch.rs` | Batch compress/resize/convert/watermark with progress events (`AtomicU32`) | |
| `mod.rs` | get_file_info, compress_image, generate_qr_code, process_image (resize/rotate/flip/blur/sharpen) | |

---

## P2P File Sharing (`src-tauri/src/p2p/`)

`OnceLock<Mutex<Option<P2PState>>>` singleton. mDNS (`_tinytools._tcp.local.`) + Axum HTTP (OS-assigned port) + AES-256-GCM + HMAC-SHA256. 12 commands: `start/stop_discovery`, `get_peers`, `send_file`, `start/stop_web_portal`, `get_transfer_progress`, `cancel_transfer`, `is/start/stop_receiving`, `cleanup`, `reveal_in_folder`.

### `commands/mod.rs`
- `compress_image`, `generate_qr_code`, `get_file_info`, `process_image` (parses JSON params: resize/rotate/flip/blur/sharpen)

### `commands/ai_tools.rs`
- `remove_background` — edge-sampled bg + percentile+Otsu threshold + S-curve alpha + speck removal
- `inpaint_image` — region fill from surrounding avg color
- `upscale_image` — 2x/4x Lanczos3
- `sepia_filter` — standard sepia matrix
- `smart_sharpen` — edge-aware luminance sharpening
- `depth_blur` — radial blur from center

### `commands/privacy.rs`
- `strip_metadata` — re-encode without EXIF
- `redact_regions` — blur/pixelate rects
- `add_watermark` — text via `ab_glyph` (Arial from `C:\Windows\Fonts\arial.ttf`)
- `add_image_watermark` — PNG overlay (position: top-left/right, bottom-left/right, center)

### `commands/pdf_tools.rs` (lopdf 0.44)
- 15 commands: merge, split, reorder, rotate, crop, delete, images_to_pdf, extract_text, compress, flatten, add_pdf_watermark, add_page_numbers
- `encrypt_pdf` / `decrypt_pdf` / `unwrap_pdf` — AES-256-GCM + Argon2id KDF, TTENC1 wire format
- **29 unit tests** covering all commands, edge cases, and error paths

### `commands/encoder.rs` — 27 commands
- Base64/URL/B32/B58/Hex/URL/HTML/Unicode/JWT/Morse/Binary/Octal
- `encode_file`, `decode_file`, `decode_text_to_file` — file I/O for binary-capable formats (base64/base64url/b32/b58/hex/binary/octal)

### `commands/hasher.rs` — 4 commands
- Text/file hashing: MD5, SHA-1/256/512, BLAKE3, CRC32, Adler32, XXH3
- Multi-hash all + verify file integrity

### `commands/encryption.rs` — 13 commands
- AES-256-GCM + ChaCha20-Poly1305 (text + file) with Argon2id KDF (default) or PBKDF2-SHA256 (600K iter)
- ROT13, Caesar, Vigenère, XOR — `encrypt_xor` accepts `encoding` (raw/hex/base64); new `decrypt_xor`
- **Wire format:** `[1B KDF ver][4B salt_len][salt][4B nonce_len][nonce][ciphertext]`

### `commands/password_tools.rs` — 3 commands
- `generate_password`, `generate_bulk`, `export_passwords`
- 5 modes (random/passphrase/pin/pronounceable/pattern), CSPRNG via `OsRng`
- Customization: `capitalize`, `append_digit`, `append_symbol`, `syllable_separator`

### `commands/batch.rs`, `commands/compression.rs`, `commands/editing.rs`
- Batch: compress/resize/convert/watermark with progress events (`AppHandle::emit` + `AtomicU32`)
- Compression: smart_compress, convert_format, convert_heic, raster_to_svg
- Editing: smart_crop, expand_canvas, split_image, stitch_images

---

## WebAssembly Hybrid Engine (`src-wasm/src/`)

**Arch:** Pure Rust mathematical image processing ported to WebAssembly (`wasm32-unknown-unknown`) using `wasm-bindgen` and `js-sys`. Allows the desktop application to run 100% locally in any web browser without needing the native Rust backend.

| File | Purpose |
|------|---------|
| `lib.rs` | Entry points for EXIF stripping, sensitive redactor (pixelate/blur), and text watermarks. |
| `ai_tools.rs` | Background removal (perceptual distance + Otsu), inpainting, upscaling (Lanczos3), filters. |
| `editing.rs` | Smart crop, expand canvas, split image into grid, stitch panoramas. |
| `conversion.rs` | Image resizing, format conversion (JPEG/PNG), rotation, grayscale, blur, sharpen. |

**Wire Protocol:** TypeScript wrappers in `tauri.ts` (`runWasmProcess`) fetch local blob URLs, convert them to `Uint8Array`, pass them to WASM, and convert the returned `Uint8Array` back into an object URL for instant download in the browser.

---

## P2P File Sharing Module (`src-tauri/src/p2p/`)

**Arch:** `OnceLock<Mutex<Option<P2PState>>>` singleton (avoids serialization issues). mDNS (`_tinytools._tcp.local.`) + Axum HTTP server (port 0, OS-assigned) + AES-256-GCM + HMAC-SHA256 password verification.

| File | Purpose |
|------|---------|
| `mod.rs` | Module root, types (P2PState, TransferState, TransferInfo, PeerListResult, SendResult, PortalResult) |
| `encryption.rs` | derive_key, compute/verify_hmac, encrypt/decrypt_chunk/file |
| `mdns.rs` | MdnsService — register, unregister, poll_peers, get_peers |
| `server.rs` | Axum routes: `/` (portal HTML), `/api/info`, `/api/download`, `/api/receive` |
| `commands.rs` | 12 Tauri commands |

**Commands:** `start/stop_discovery`, `get_peers`, `send_file(file_path, peer_ip, password?)`, `start/stop_web_portal` → `PortalResult`, `get_transfer_progress`, `cancel_transfer`, `is/start/stop_receiving`, `cleanup`, `reveal_in_folder`.

**Wire Protocol:** Manifest (JSON: file_name, file_size, encrypted, salt, hmac) → Data (binary: `[4B chunk_len][12B nonce][ciphertext+16B tag]` × N, 256KB chunks). Password verified via HMAC-SHA256 before decryption.

**New Crates:** `mdns-sd 0.11`, `axum 0.7`, `tower-http 0.6` (cors, fs), `tokio 1` (rt-multi-thread, net, macros, sync, time, io-util), `tokio-util 0.7` (io), `local-ip-address 0.6`, `reqwest 0.12` (stream), `dirs-next 2`, `hostname 0.4`, `futures 0.3`.

---

## Frontend (`src/`)

### Routing (`App.tsx`)
- `handleNavigate(tool, sub?)` — tools: `image`, `ai`, `privacy`, `editing`, `conversion`, `p2p`, `pdf`, `encryption`, `password`, `encoder`, `hasher`, `qr`, `welcome`
- Sub-tool IDs must match page types exactly (e.g. `"smart-sharpen"` not `"sharpen"`)

### Key Pages
- **PdfToolsPage.tsx** — routes `tool === "info"` to `<PdfInfoPage />` (early return). Other tools use standard left-panel/right-panel layout.
- **PdfInfoPage.tsx** — mac-style two-column dashboard: left = thumbnail + quick stats + action buttons (Copy JSON / Strip Metadata / Compress / Show in Explorer); right = property cards (Document Properties, Page Info, Security). Auto-inspects on file drop.
- **QrGenerator.tsx** — input type tabs (URL/Text/Wi-Fi/vCard/Email) with dynamic forms; 6 theme presets with labels; contrast scannability badge; preview bg toggles (light/dark/checkerboard); logo BG padding slider; dynamic PNG button showing pixel dimensions.
- **EncryptionPage.tsx** — auto-process (300ms debounce), passphrase toggle + entropy meter, encoding/format selectors, XOR toggle, metadata badge, file dropzone, revealInFolder.
- **P2PPage / P2PPeerList / P2PTransferProgress / P2PWebPortal** — 3-tab P2P UI.
- **Welcome.tsx** — 7 sections, 42 feature cards with search.
- **Sidebar.tsx** — 7 icons, `sidebarCategories`, `"cat-*"` tool type union.
- **CategoryPage.tsx** — grouped feature grid per category.

### `lib/`
- **tauri.ts** — IPC bridge for all commands. Uses `@tauri-apps/plugin-dialog` for file pickers (Tauri 2 `<input>` has no `.path`). `processImage(params?)` accepts JSON-stringified params.
- **p2p-api.ts** — TS bindings for 12 P2P commands + types.
- **qr-renderer.ts** — SVG QR code renderer with custom dot/eye shapes, gradients, logo overlay, frame/text, glassmorphism. Exports `getContrastRatio()`.

### UI Patterns
- **Theme:** `bg-surface/50` (rgba(30,30,30,0.8)), `border-border` (rgba(255,255,255,0.1)), radius `2xl`/`3xl`
- **Buttons:** `bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30`
- **Inputs:** `rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20`
- **Motion spring:** `{ type: "spring", stiffness: 300, damping: 30 }`

---

## Tauri v2 Capabilities (`capabilities/default.json`)
- **Permissions:** `core:default`, `core:event:default`, `core:window:default`, `dialog:default`, `fs:default`, `fs:allow-write-text-file`, `shell:allow-open`
- **fs:scope:** `{"allow": [{"path": "**"}]}`
- Custom commands need only `core:default` to be callable

---

## Known Gotchas
1. Use `npm run tauri dev` (not `npm run dev`) — Vite alone has no backend
2. `core:ipc:default` doesn't exist in Tauri 2.11.5 — use `core:default`
3. Missing `capabilities/default.json` causes `invoke()` undefined
4. `cargo test` triggers Tauri build script — use `--lib` for unit tests
5. P2P state: `OnceLock<Mutex<Option<P2PState>>>` (ServiceDaemon doesn't impl Serialize)
6. `ab_glyph::ScaleFont` trait must be imported for `h_advance()`
7. Tauri 2 `<input type="file">` has no `.path` — always use `@tauri-apps/plugin-dialog`
8. `tauri-plugin-dialog` needs Rust dep + JS dep + `"dialog:default"` capability

---

## Git History (recent)
- `WASM Migration` — feat: ported AI tools, editing, processing, and privacy tools to WebAssembly (`src-wasm`). Added interactive drag-to-draw redactor UI.
- `92265a6` — feat: refactor password modes with labels/descriptions + Toggle component
- `96094c6` — feat: add `fs:allow-write-text-file` permission
- `dbb38d9` — feat: file encoding/decoding (`encode_file`, `decode_file`, `decode_text_to_file`)
- `692a795` — Global Share: Beta

## In-Progress / Backlog
- [x] Full WebAssembly Migration for Image Tools
- [x] Interactive UI for Sensitive Redactor
- [x] P2P file sharing (Phases 1+2)
- [x] Welcome page redesign (7 sections, 42 cards)
- [x] Sidebar redesign + CategoryPage
- [x] Encoder file mode (encode_file, decode_file, decode_text_to_file)
- [x] Password generator redesign (inline sub-tools + customization)
- [x] Encryption page overhaul (auto-process, encoding selector, metadata, entropy, file mode, XOR encoding)
- [x] PDF comprehensive tests (29 unit tests across all 16 commands)
- [ ] P2P: Cross-network WebRTC transfers (Phase 3)
- [ ] P2P: Pause/resume transfers
- [ ] P2P: Chunked streaming sender (currently full file in memory)
- [ ] Real face detection for smart_sharpen
- [ ] True AI colorization (currently sepia filter)
- [ ] Font fallback for watermark (hardcoded Arial/Inter)

## Build Commands
```powershell
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"" x64 >nul 2>&1 && cargo check 2>&1"
cmd /c "call ""...vcvarsall.bat"" x64 >nul 2>&1 && cargo test --lib ... 2>&1"
npx tsc --noEmit
```
