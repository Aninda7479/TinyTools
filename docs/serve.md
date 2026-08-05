# Running TinyTools in Homelab (`--serve`) Mode

The `--serve` flag launches TinyTools in **Homelab Mode** — a headless HTTPS web server that serves the compiled frontend (`dist/`) and powers the **Global Share / P2P** file-transfer portal over your local network.

No Tauri desktop window is opened. Instead, a self-signed HTTPS server is started on a random port, and a QR code + URL are printed to the terminal so any device on the LAN can connect.

## Prerequisites

1. **Frontend must be built** (the server reads from `dist/`):

   ```bash
   npm run build
   ```

2. **Rust binary must be compiled** (run from `src-tauri/`):

   ```bash
   cargo build            # debug binary
   # or
   cargo build --release  # optimized release binary
   ```

---

## Development Mode

```bash
# 1. Build the frontend
npm run build

# 2. Build the debug binary
cargo build
#    → produces: src-tauri/target/debug/tinytools(.exe)

# 3. Run with --serve
src-tauri/target/debug/tinytools --serve
```

Or use the `TINYTOOLS_HOMELAB` environment variable as an alternative:

```bash
TINYTOOLS_HOMELAB=1 src-tauri/target/debug/tinytools
```

> **Note:** `npm run tauri dev` does **not** forward the `--serve` flag. You must run the compiled binary directly.

---

## Release Mode

```bash
# 1. Build the frontend (production)
npm run build

# 2. Build the release binary
cargo build --release
#    → produces: src-tauri/target/release/tinytools(.exe)

# 3. Run with --serve
src-tauri/target/release/tinytools --serve
```

Or with the environment variable:

```bash
TINYTOOLS_HOMELAB=1 src-tauri/target/release/tinytools
```

---

## What You See

When homelab mode starts, the terminal prints something like:

```
========================================
  TinyTools Homelab Mode
  URL: https://192.168.1.100:38947
  LAN: https://192.168.1.100:38947
  Press Ctrl+C to stop
========================================

QR Code (scan with phone camera):
```

Scan the QR code with your phone (or visit the URL) to access the Global Share / P2P file-transfer portal.

---

## How It Works

| File | Description |
|------|-------------|
| `src-tauri/src/main.rs:4` | Checks for `--serve` arg or `TINYTOOLS_HOMELAB=1` env var |
| `src-tauri/src/lib.rs:145` | `run_homelab()` — finds local IP, starts HTTPS server |
| `src-tauri/src/p2p/server.rs:633` | `start_homelab_server()` — binds axum + TLS on a random port, serves `dist/` + P2P API routes |

The server binds to `0.0.0.0:0` (random available port) and generates a self-signed TLS certificate via `rcgen`.
