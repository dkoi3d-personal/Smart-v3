/**
 * MLX-VLM Client
 *
 * Client for running OCR using MLX Vision Language Models on Apple Silicon
 */

import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  MLXOCRRequest,
  MLXOCRResponse,
  MLXConfig,
  DEFAULT_MLX_CONFIG,
  MLX_OCR_PROMPTS,
  BoundingBox,
} from './types';

export class MLXVLMClient {
  private config: MLXConfig;

  constructor(config: Partial<MLXConfig> = {}) {
    this.config = { ...DEFAULT_MLX_CONFIG, ...config };
  }

  /**
   * Check if MLX-VLM is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.runPython(`
import sys
try:
    import mlx_vlm
    print("available")
except ImportError:
    print("not_available")
`);
      return result.trim() === 'available';
    } catch {
      return false;
    }
  }

  /**
   * Get model info
   */
  async getModelInfo(): Promise<{ available: boolean; path?: string; error?: string }> {
    try {
      const modelCachePath = path.join(
        process.env.HOME || '',
        '.cache/huggingface/hub/models--mlx-community--DeepSeek-OCR-4bit'
      );

      const exists = await fs
        .access(modelCachePath)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        return { available: true, path: modelCachePath };
      }
      return { available: false, error: 'Model not downloaded' };
    } catch (error) {
      return { available: false, error: String(error) };
    }
  }

  /**
   * Perform OCR on an image
   */
  async performOCR(request: MLXOCRRequest): Promise<MLXOCRResponse> {
    const prompt = request.prompt || MLX_OCR_PROMPTS[request.mode] || MLX_OCR_PROMPTS.general;
    const maxTokens = request.maxTokens || this.config.maxTokens;

    // Handle base64 image - save to temp file
    let imagePath = request.image;
    let tempFile: string | null = null;

    if (request.image.startsWith('data:') || !request.image.includes('/')) {
      // Base64 encoded image
      tempFile = `/tmp/mlx_ocr_${Date.now()}.png`;
      const base64Data = request.image.replace(/^data:image\/\w+;base64,/, '');
      await fs.writeFile(tempFile, Buffer.from(base64Data, 'base64'));
      imagePath = tempFile;
    }

    const pythonScript = `
import os
import json
import re
os.environ['HF_HUB_OFFLINE'] = '1'

from mlx_vlm import load, generate
from mlx_vlm.prompt_utils import apply_chat_template
from mlx_vlm.utils import load_config

model_path = "${this.getModelPath()}"
model, processor = load(model_path)
config = load_config(model_path)

prompt = """${prompt}"""
image_path = "${imagePath}"

formatted_prompt = apply_chat_template(processor, config, prompt, num_images=1)
result = generate(model, processor, formatted_prompt, [image_path], max_tokens=${maxTokens}, verbose=False)

# Parse bounding boxes from output
text = result.text if hasattr(result, 'text') else str(result)
bounding_boxes = []

# Extract bounding boxes from DeepSeek-OCR format
pattern = r'<\\|ref\\|>([^<]+)<\\|/ref\\|><\\|det\\|>\\[\\[([\\d,\\s]+)\\]\\]<\\|/det\\|>\\s*([^<]*)'
matches = re.findall(pattern, text)
for match in matches:
    coords = [int(x.strip()) for x in match[1].split(',')]
    bounding_boxes.append({
        'text': match[2].strip() if match[2].strip() else match[0],
        'coordinates': coords
    })

# Clean text output (remove markup)
clean_text = re.sub(r'<\\|[^|]+\\|>[^<]*<\\|/[^|]+\\|>', '', text)
clean_text = re.sub(r'<\\|det\\|>[^<]*<\\|/det\\|>', '', clean_text)
clean_text = clean_text.strip()

output = {
    'text': clean_text,
    'boundingBoxes': bounding_boxes,
    'tokensPerSecond': result.generation_tps if hasattr(result, 'generation_tps') else 0,
    'peakMemoryGB': result.peak_memory if hasattr(result, 'peak_memory') else 0,
    'totalTokens': result.total_tokens if hasattr(result, 'total_tokens') else 0
}

print(json.dumps(output))
`;

    try {
      const result = await this.runPython(pythonScript);

      // Clean up temp file
      if (tempFile) {
        await fs.unlink(tempFile).catch(() => {});
      }

      // Parse JSON output
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse OCR output');
      }

      return JSON.parse(jsonMatch[0]) as MLXOCRResponse;
    } catch (error) {
      // Clean up temp file on error
      if (tempFile) {
        await fs.unlink(tempFile).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Get the model cache path
   */
  private getModelPath(): string {
    const homeDir = process.env.HOME || '';
    return path.join(
      homeDir,
      '.cache/huggingface/hub/models--mlx-community--DeepSeek-OCR-4bit/snapshots/7cb35246727a4332f80a2d1d1c27f79b81cbe585'
    );
  }

  /**
   * Run a Python script - tries pyenv first, then python3 directly
   */
  private runPython(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        PATH: `/opt/homebrew/bin:${process.env.PATH}`,
        PYENV_VERSION: '3.12.0',
        HF_HUB_OFFLINE: '1',
      };

      // Try pyenv first, fallback to python3 directly
      const pythonCmd = `(eval "$(pyenv init -)" 2>/dev/null && pyenv global 3.12.0 2>/dev/null && python) || python3`;

      const pyenv = spawn('bash', ['-c', pythonCmd], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      pyenv.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pyenv.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pyenv.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Python script failed: ${stderr || stdout}`));
        }
      });

      pyenv.on('error', (err) => {
        reject(err);
      });

      pyenv.stdin.write(script);
      pyenv.stdin.end();
    });
  }
}

// Singleton instance
let mlxClient: MLXVLMClient | null = null;

export function getMLXVLMClient(config?: Partial<MLXConfig>): MLXVLMClient {
  if (!mlxClient || config) {
    mlxClient = new MLXVLMClient(config);
  }
  return mlxClient;
}

export default MLXVLMClient;
