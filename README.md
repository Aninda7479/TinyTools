# TinyTools

A fast, lightweight, offline desktop toolkit built with Tauri 2.0 (Rust) + React + TypeScript. Native performance, zero cloud dependency.

## Features

| Category | Tools |
|----------|-------|
| **AI & Smart** | Background removal, inpainting, upscaling, colorization, face enhance, depth blur |
| **Privacy & Metadata** | EXIF stripper, region redaction, text/image watermarks |
| **Editing & Layout** | Smart crop, canvas expand, image splitter, image stitcher |
| **Image Compress** | Adjustable quality JPEG/PNG compression |
| **Compression & Conversion** | Format conversion, HEIC support, SVG vectorization, smart compress |
| **QR Code Generator** | Custom dots, gradients, logos, frames, SVG/PNG/WebP export |
| **Image Process** | Resize, grayscale, rotate, flip, blur, sharpen |
| **Batch Engine** | Parallel processing of 100+ files via Rust multi-threading |
| **PDF Tools** | Merge, split, reorder, rotate, crop, delete pages, images-to-PDF, text extraction, encrypt, decrypt, compress, flatten, watermark, page numbers |
| **Password Generator** | Random, passphrase (diceware), PIN, pronounceable, pattern/template modes with entropy meter and bulk export |

## Tech Stack

- **Backend:** Rust (Tauri 2.0) — image, imageproc, qrcode, lopdf, rand, rayon
- **Frontend:** React 18, TypeScript, Tailwind CSS 3.4, Framer Motion
- **Build:** Vite 5, Tauri CLI 2
- **License:** Apache 2.0

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) 1.88+ (for MSRV compliance with lopdf 0.44)
- **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" workload
- **macOS:** Xcode Command Line Tools (`xcode-select --install`)
- **Linux:** `build-essential`, `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

## Getting Started

```bash
# Clone
git clone https://github.com/Aninda7479/TinyTools.git
cd TinyTools

# Install frontend deps
npm install

# Run in dev mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
TinyTools/
├── src/                          # React frontend
│   ├── components/               # UI pages (AiTools, PdfTools, PasswordGenerator, etc.)
│   ├── lib/
│   │   ├── tauri.ts              # IPC bridge to Rust backend
│   │   └── qr-renderer.ts       # QR code SVG rendering
│   └── App.tsx                   # Router + layout
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── lib.rs                # Tauri command registration
│       └── commands/
│           ├── ai_tools.rs       # AI commands (bg removal, inpaint, upscale...)
│           ├── batch.rs          # Parallel batch processing
│           ├── compression.rs    # Format conversion, smart compress
│           ├── editing.rs        # Crop, split, stitch
│           ├── password_tools.rs # Password generation (CSPRNG)
│           ├── pdf_tools.rs      # PDF manipulation (lopdf)
│           └── privacy.rs        # Metadata, redaction, watermarks
└── package.json
```

## Password Generator

- **Random:** Customizable character sets (A-Z, a-z, 0-9, symbols), ambiguous char exclusion, length 8-128
- **Passphrase:** 970-word EFF-style dictionary, 2-12 words, configurable separator
- **PIN:** 4-12 digit numeric codes
- **Pronounceable:** Consonant-vowel alternation for speakable passwords
- **Pattern:** Template strings like `AAA-999-aaa-!!!`
- **Bulk:** Generate 1-1000 at once, export CSV/TXT
- **Security:** OS-level CSPRNG (`OsRng`), entropy calculation, crack-time estimates, auto-clear clipboard

## PDF Tools

14 operations powered by lopdf 0.44:
- **Pages:** Merge, split, reorder, rotate, crop, delete
- **Convert:** Images-to-PDF, text extraction
- **Security:** Encrypt (password protect), decrypt
- **Enhance:** Compress, flatten, watermark, page numbers

## Performance

Heavy lifting runs in Rust with `rayon` for parallel processing. Frontend communicates via Tauri IPC — no HTTP overhead, no server process.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Commit with clear messages
4. Open a PR

## License

Apache 2.0 — see [LICENSE](LICENSE)
