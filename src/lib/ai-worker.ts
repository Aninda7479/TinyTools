import { pipeline, env } from '@huggingface/transformers';

// We disable local models since this is running in the browser and pulling from HF hub
env.allowLocalModels = false;

// We use the browser cache so it only downloads the ~40MB model once
env.useBrowserCache = true;

class PipelineSingleton {
  static task = 'background-removal';
  static instance: any = null;
  static currentModel: string | null = null;

  static async getInstance(model: string, progress_callback: any) {
    if (this.instance === null || this.currentModel !== model) {
      this.currentModel = model;
      this.instance = pipeline(this.task as any, model, { 
        progress_callback,
        dtype: 'fp32'
      });
    }
    return this.instance;
  }
}

class UpscalePipelineSingleton {
  static task = 'image-to-image';
  static instance: any = null;
  static currentModel: string | null = null;

  static async getInstance(model: string, progress_callback: any) {
    if (this.instance === null || this.currentModel !== model) {
      this.currentModel = model;
      this.instance = pipeline(this.task as any, model, { 
        progress_callback,
        dtype: 'fp32'
      });
    }
    return this.instance;
  }
}

async function processWithTiling(imageUrl: string, upscaler: any, id: string, scale: number = 2) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  
  const W = bitmap.width;
  const H = bitmap.height;
  
  const padW = Math.ceil(W / 8) * 8;
  const padH = Math.ceil(H / 8) * 8;
  
  const inCanvas = new OffscreenCanvas(padW, padH);
  const inCtx = inCanvas.getContext('2d')!;
  inCtx.fillStyle = 'black';
  inCtx.fillRect(0, 0, padW, padH);
  inCtx.drawImage(bitmap, 0, 0);
  
  const T = 256;
  let x_starts = [];
  for (let x = 0; x < padW; x += T) {
    if (x + T > padW) x_starts.push(Math.max(0, padW - T));
    else x_starts.push(x);
  }
  x_starts = [...new Set(x_starts)];
  
  let y_starts = [];
  for (let y = 0; y < padH; y += T) {
    if (y + T > padH) y_starts.push(Math.max(0, padH - T));
    else y_starts.push(y);
  }
  y_starts = [...new Set(y_starts)];
  
  const outCanvas = new OffscreenCanvas(W * scale, H * scale);
  const outCtx = outCanvas.getContext('2d')!;
  
  const totalTiles = x_starts.length * y_starts.length;
  let currentTile = 0;
  
  const tileCanvas = new OffscreenCanvas(Math.min(T, padW), Math.min(T, padH));
  const tileCtx = tileCanvas.getContext('2d')!;
  
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
      
      const output = await upscaler(tileUrl);
      const outTileBlob = await output.toBlob('image/png');
      URL.revokeObjectURL(tileUrl);
      
      const outTileBitmap = await createImageBitmap(outTileBlob);
      outCtx.drawImage(outTileBitmap, x * scale, y * scale);
    }
  }
  
  return await outCanvas.convertToBlob({ type: 'image/png' });
}

async function prepareImageForBgRemoval(imageUrl: string, maxDim: number = 1024): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  
  let { width, height } = bitmap;
  
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  
  width = Math.max(8, Math.floor(width / 8) * 8);
  height = Math.max(8, Math.floor(height / 8) * 8);
  
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Failed to get canvas context");
  
  ctx.drawImage(bitmap, 0, 0, width, height);
  
  const outBlob = await canvas.convertToBlob({ type: 'image/png' });
  return URL.createObjectURL(outBlob);
}

self.addEventListener('message', async (event) => {
  const { action, id, imageUrl, model = 'studioludens/birefnet-lite-512', blurStrength = 8.0 } = event.data;
  
  if (action === 'remove_background') {
    try {
      const segmenter = await PipelineSingleton.getInstance(model, (progressData: any) => {
        self.postMessage({ type: 'progress', id, progressData });
      });

      self.postMessage({ type: 'processing', id, message: 'Processing image (Background Removal)...' });
      const safeUrl = await prepareImageForBgRemoval(imageUrl, 1024);
      const output = await segmenter(safeUrl);
      const blob = await output.toBlob('image/png');
      self.postMessage({ type: 'result', id, blob });
      
    } catch (error: any) {
      self.postMessage({ type: 'error', id, error: error.message || error });
    }
  } else if (action === 'portrait_blur') {
    try {
      const segmenter = await PipelineSingleton.getInstance(model, (progressData: any) => {
        self.postMessage({ type: 'progress', id, progressData });
      });

      self.postMessage({ type: 'processing', id, message: 'Isolating Subject (AI Portrait Blur)...' });
      const safeUrl = await prepareImageForBgRemoval(imageUrl, 1024);
      const output = await segmenter(safeUrl);
      const foregroundBlob = await output.toBlob('image/png');
      
      self.postMessage({ type: 'processing', id, message: 'Compositing Depth Blur...' });
      
      const origRes = await fetch(imageUrl);
      const origBlob = await origRes.blob();
      const origImg = await createImageBitmap(origBlob);
      const fgImg = await createImageBitmap(foregroundBlob);
      
      const canvas = new OffscreenCanvas(origImg.width, origImg.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Failed to get canvas context");
      
      // 1. Draw blurred background
      ctx.filter = `blur(${blurStrength}px)`;
      ctx.drawImage(origImg, 0, 0);
      
      // 2. Draw sharp foreground on top
      ctx.filter = 'none';
      ctx.drawImage(fgImg, 0, 0, origImg.width, origImg.height);
      
      const finalBlob = await canvas.convertToBlob({ type: 'image/png', quality: 1 });
      self.postMessage({ type: 'result', id, blob: finalBlob });
      
    } catch (error: any) {
      self.postMessage({ type: 'error', id, error: error.message || error });
    }
  } else if (action === 'upscale_image') {
    try {
      const upscaler = await UpscalePipelineSingleton.getInstance('Xenova/swin2SR-classical-sr-x2-64', (progressData: any) => {
        self.postMessage({ type: 'progress', id, progressData });
      });

      const blob = await processWithTiling(imageUrl, upscaler, id, 2);
      self.postMessage({ type: 'result', id, blob });
      
    } catch (error: any) {
      self.postMessage({ type: 'error', id, error: error.message || error });
    }
  }
});
