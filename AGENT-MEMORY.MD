# TinyTools — Agent Memory

**Stack:** Tauri 2.0 (Rust) + React 18 + TS + Tailwind 3.4 + Framer Motion | Offline-first utility toolkit
**GitHub:** `https://github.com/Aninda7479/TinyTools`
**OS:** Windows | **Rust:** 1.96.1 | **VS Build Tools:** `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat`

---

## Crate Versions & API Quirks

| Crate | Key APIs / Notes |
|-------|-----------------|
| **lopdf 0.44** | `Document::load()`, `Object::Real/Name`, `Operation::new()`, `StringFormat::Literal/Hexadecimal`. No `.entries` — use `.get()/.set()/.remove()`. `type_name()` returns `Result<&[u8]>`. |
| **image 0.25** | `image::open()`, `.to_rgba8()`, `.save()`, `RgbaImage::new/put_pixel/get_pixel`, `PngEncoder::new()`. |
| **ab_glyph 0.2** | `FontRef::try_from_slice()`, `.glyph_id()`, `.as_scaled().h_advance()` — **must import `ScaleFont` trait**. `.outlined.draw()` for rasterizing. |
| **aes-gcm 0.10** | `Aes256Gcm::generate_nonce(&mut OsRng)` needs `AeadCore` trait. `GenericArray::from_slice()` for nonce. |
| **imageproc 0.25** | `imageproc::drawing::draw_text_mut()`. |
| **mdns-sd 0.11** | `ServiceDaemon::new()`, `.browse()` → `Receiver`, `ServiceInfo::new()`, `receiver.try_recv()`. |
| **axum 0.7** | `Router::new().route().with_state()`, `axum::serve()`, `Body::from_stream()`, `State`/`Query` extractors. |
| **reqwest 0.12** | `Client::new()`, `.post().header().body().send().await`, `resp.bytes()/.text()`. |

---

## Rust Backend (`src-tauri/src/`)

### `lib.rs`
- `mod commands;` + `mod p2p;` — registers all commands via `generate_handler![]`
- Plugins: `tauri_plugin_shell`, `tauri_plugin_fs`, `tauri_plugin_dialog`

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

### `lib/tauri.ts`
- IPC bridge for all Rust commands. `processImage(params?)` accepts JSON-stringified params.
- **File pickers:** `pickFile()`, `pickFiles()`, `pickDirectory()`, `saveFile()` via `@tauri-apps/plugin-dialog` (required because Tauri 2 `<input type="file">` has no `.path`).
- **New:** `encodeFile`, `decodeFile`, `decodeTextToFile`, `encryptXor(encoding)`, `decryptXor`.

### `lib/p2p-api.ts`
- TS bindings for 12 P2P commands + types: `PeerInfo`, `PeerListResult`, `TransferInfo`, `SendResult`, `PortalResult`.

### Key Pages
- **App.tsx** — routing with `activeTool` + `activeSub`, `handleNavigate(tool, sub?)`. Routes `cat-*` → CategoryPage.
- **Welcome.tsx** — 7 sections, 42 feature cards with search, navigates via `onNavigate(tool, sub)`.
- **Sidebar.tsx** — 7 category icons, `sidebarCategories` array, `"cat-*"` tool type union.
- **CategoryPage.tsx** — grouped feature grid per category.
- **P2PPage / P2PPeerList / P2PTransferProgress / P2PWebPortal** — 3-tab P2P UI.
- **PasswordGeneratorPage.tsx** — inline sub-tools (random/passphrase/pin/pronounceable/pattern), customization controls.
- **EncryptionPage.tsx** — auto-process (300ms debounce), passphrase toggle + entropy meter, encoding selector (Base64/Base64URL/Hex), XOR encoding toggle, metadata badge (S/N/T/P + KDF), file dropzone → `revealInFolder`, text download via save dialog. Swap/copy/download/clear actions.
- **EncoderDecoderPage.tsx** — 12 formats + file mode toggle.
- **HasherPage.tsx** — text/file/multi-hash/verify.
- **ImageProcess / AiToolsPage / PrivacyPage / EditingPage / ConversionPage / PdfToolsPage** — each accepts `defaultSub` for direct nav.

### `defaultSub` Navigation
Pages accept `{ defaultSub?: string }`. Welcome cards pass matching IDs:
- **AiToolsPage:** `bg-remove`, `inpaint`, `upscale`, `sepia`, `smart-sharpen`, `depth-blur`
- **PrivacyPage:** `strip-metadata`, `redact`, `watermark`
- **EditingPage:** `crop`, `expand`, `split`, `stitch`
- **ConversionPage:** `compress`, `convert`, `heic`, `vectorize`
- **ImageProcess:** `resize`, `grayscale`, `rotate`, `flip`, `blur`, `sharpen`
- **EncryptionPage:** `text-aes`, `text-chacha`, `text-classic`, `file-aes`, `file-chacha`
- **PdfToolsPage:** `info`, `merge`, `split`, `reorder`, `rotate`, `crop`, `delete`, `img2pdf`, `text`, `encrypt`, `decrypt`, `compress`, `flatten`, `watermark`, `pagenum`
- **EncoderDecoderPage:** `base64`, `base64url`, `base32`, `base58`, `hex`, `url`, `html`, `unicode`, `jwt`, `morse`, `binary`, `octal`
- **HasherPage:** `text-hash`, `file-hash`, `multi-hash`, `verify`

### `components/ToolPage.tsx`
- Shared layout with `OptionRow`, `OptionSlider`, `OptionSelect`.

---

## Build & Test Commands

```powershell
# Cargo (needs VS Build Tools)
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"" x64 >nul 2>&1 && cargo check 2>&1"
cmd /c "call ""...vcvarsall.bat"" x64 >nul 2>&1 && cargo test --lib ... -- --nocapture"  # Note: --lib skips Tauri build script

# TypeScript
npx tsc --noEmit
```

---

## Known Gotchas
1. **`npm run tauri dev`** (not `npm run dev`) — Vite alone has no Tauri backend
2. **`core:ipc:default`** doesn't exist in Tauri 2.11.5 — IPC covered by `core:default`
3. **Missing `capabilities/default.json`** causes `invoke` undefined
4. **`cargo test`** triggers Tauri build script capabilities validation — use `--lib` for unit tests
5. **P2P state** uses `OnceLock<Mutex<Option<P2PState>>>` (ServiceDaemon doesn't impl Serialize)
6. **`bg_g.push(pl[2])`** was a bug — should be `bg_b.push(pl[2])`
7. **BFS flood bug** — `otsu_threshold - 0.1` went negative. Fixed by removing BFS entirely
8. **`ab_glyph::ScaleFont`** trait must be imported for `h_advance()`
9. **`cargo check` passes but `cargo test` may not** — verify both
10. **P2P receiver port** hardcoded to 8787
11. **Web portal port** OS-assigned (0), returned in `PortalResult.port`
12. **Sub-tool IDs** must match page types exactly (e.g. `"smart-sharpen"` not `"sharpen"`)
13. **Tauri 2 `<input type="file">`** has no `.path` — always use `@tauri-apps/plugin-dialog`
14. **`tauri-plugin-dialog`** needs Rust dep + JS dep + `"dialog:default"` capability

---

## Tauri v2 Capabilities (`default.json`)
- **Window:** `main` | **Permissions:** `core:default`, `core:event:default`, `core:window:default`, `dialog:default`, `fs:default`, `fs:allow-write-text-file`, `shell:allow-open`
- **fs:scope:** `{"allow": [{"path": "**"}]}` — all paths allowed for custom Rust commands
- Custom commands need only `core:default` to be callable

---

## UI Design Patterns
- **Theme:** `surface` (rgba(30,30,30,0.8)), `border` (rgba(255,255,255,0.1)), radius `2xl`(1rem)/`3xl`(1.5rem)
- **Button:** `bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30`
- **Input:** `rounded-xl bg-white/5 border border-border px-3 py-2 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-border-hover`
- **Card:** `rounded-2xl border border-border bg-surface/50 backdrop-blur-xl`
- **Motion spring:** `{ type: "spring", stiffness: 300, damping: 30 }`
- **Label:** `text-[10px] text-white/30 uppercase tracking-wider`
- **Footnote:** `text-[10px] text-white/20`

---

## Git History (recent)
- `92265a6` — feat: refactor password modes with labels/descriptions + Toggle component
- `96094c6` — feat: add `fs:allow-write-text-file` permission
- `dbb38d9` — feat: file encoding/decoding (`encode_file`, `decode_file`, `decode_text_to_file`)
- `692a795` — Global Share: Beta
- `fdf50d3` — feat: dynamic PBKDF2 iterations + decrypt for uploaded files
- `86d4924` — feat: `revealInFolder` command + `IncomingTransferInfo.save_path`
- `1693efe` — feat: P2P file handling + status updates
- `b453d06` — split Local Web Portal into Send/Receive with save-dialog download
- `e23417b` — remove P2P send/receive/scan, keep only Local Web Portal
- `1b6561b` — rename: Web Portal → Local Web Portal
- `ad75075` — feat: HTTPS web portal + QR code usage instructions
- `d09146a` — feat: file encryption for web portal downloads + download limits
- `664f81a` — fix: P2P state existence check for web portal runtime
- `31aad92` — fix: web portal server killed immediately (runtime dropped)
- `d2b19d2` — fix: web portal HTML fetches `/api/info` + proper download

## In-Progress / Backlog
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
- [ ] Font fallback for watermark (hardcoded Arial)