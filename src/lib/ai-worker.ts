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

self.addEventListener('message', async (event) => {
  const { action, id, imageUrl, model = 'studioludens/birefnet-lite-512' } = event.data;
  
  if (action === 'remove_background') {
    try {
      // 1. Initialize or get the pipeline (with progress callback)
      const segmenter = await PipelineSingleton.getInstance(model, (progressData: any) => {
        self.postMessage({ type: 'progress', id, progressData });
      });

      // 2. Process the image
      self.postMessage({ type: 'processing', id });
      const output = await segmenter(imageUrl);
      
      // 3. Convert the output mask/image to a Blob
      const blob = await output.toBlob('image/png');
      
      // 4. Send the Blob back to the main thread
      self.postMessage({ type: 'result', id, blob });
      
    } catch (error: any) {
      self.postMessage({ type: 'error', id, error: error.message });
    }
  }
});
