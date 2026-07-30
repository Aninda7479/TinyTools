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

Wire: Manifest JSON (file_name, size, salt, hmac) → Chunks `[4B len][12B nonce][ciphertext+16B tag]`.

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

## Build Commands
```powershell
cmd /c "call ""C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"" x64 >nul 2>&1 && cargo check 2>&1"
cmd /c "call ""...vcvarsall.bat"" x64 >nul 2>&1 && cargo test --lib ... 2>&1"
npx tsc --noEmit
```
