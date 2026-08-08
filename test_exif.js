import fs from 'fs';
import { read_metadata } from './src/lib/wasm/tinytools_wasm.js';

// Wait, we need to load the WASM module. 
// Actually, it's easier to just read the Rust tests.
