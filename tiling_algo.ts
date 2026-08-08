async function processWithTiling(imageUrl: string, upscaler: any, id: string, scale: number = 2) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  
  const W = bitmap.width;
  const H = bitmap.height;
  
  // 1. Pad image to multiple of 8
  const padW = Math.ceil(W / 8) * 8;
  const padH = Math.ceil(H / 8) * 8;
  
  const inCanvas = new OffscreenCanvas(padW, padH);
  const inCtx = inCanvas.getContext('2d')!;
  // Fill with black or edge color (black is fine for padding since we crop it out)
  inCtx.fillStyle = 'black';
  inCtx.fillRect(0, 0, padW, padH);
  inCtx.drawImage(bitmap, 0, 0);
  
  // 2. Generate tile coordinates
  const T = 256;
  let x_starts = [];
  for (let x = 0; x < padW; x += T) {
    if (x + T > padW) {
      x_starts.push(Math.max(0, padW - T));
    } else {
      x_starts.push(x);
    }
  }
  x_starts = [...new Set(x_starts)];
  
  let y_starts = [];
  for (let y = 0; y < padH; y += T) {
    if (y + T > padH) {
      y_starts.push(Math.max(0, padH - T));
    } else {
      y_starts.push(y);
    }
  }
  y_starts = [...new Set(y_starts)];
  
  // 3. Setup output canvas
  const outCanvas = new OffscreenCanvas(W * scale, H * scale);
  const outCtx = outCanvas.getContext('2d')!;
  
  const totalTiles = x_starts.length * y_starts.length;
  let currentTile = 0;
  
  const tileCanvas = new OffscreenCanvas(Math.min(T, padW), Math.min(T, padH));
  const tileCtx = tileCanvas.getContext('2d')!;
  
  // 4. Process each tile
  for (const y of y_starts) {
    for (const x of x_starts) {
      currentTile++;
      self.postMessage({ 
        type: 'processing', 
        id, 
        message: `Processing tile ${currentTile} of ${totalTiles} (AI Upscale)...`
      });
      
      const tw = tileCanvas.width;
      const th = tileCanvas.height;
      tileCtx.clearRect(0, 0, tw, th);
      tileCtx.drawImage(inCanvas, x, y, tw, th, 0, 0, tw, th);
      
      const tileBlob = await tileCanvas.convertToBlob({ type: 'image/png' });
      const tileUrl = URL.createObjectURL(tileBlob);
      
      // Upscale tile
      const output = await upscaler(tileUrl);
      const outTileBlob = await output.toBlob('image/png');
      URL.revokeObjectURL(tileUrl);
      
      const outTileBitmap = await createImageBitmap(outTileBlob);
      
      // Draw onto output (using exact cropped W/H limits to avoid drawing padding into actual image bounds)
      // We are drawing onto outCanvas which is sized EXACTLY W*scale by H*scale, so padding naturally gets cut off!
      outCtx.drawImage(outTileBitmap, x * scale, y * scale);
    }
  }
  
  // 5. Return final blob
  return await outCanvas.convertToBlob({ type: 'image/png' });
}
