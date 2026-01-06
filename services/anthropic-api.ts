/**
 * Anthropic API Integration Service with Tool Execution
 * Implements agentic loop for file operations and bash commands
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';
import type { AgentInvocationOptions, AgentResponse } from '@/lib/agents/types';
import * as fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { glob } from 'glob';
import { normalizePathForGlob } from '@/lib/cross-platform';
import { getMLXVLMClient } from '@/lib/mlx-vlm';

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export class AnthropicService {
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error('⚠️  ANTHROPIC_API_KEY not found in environment variables!');
      console.error('⚠️  Please add your API key to .env.local file');
      console.error('⚠️  Get one at: https://console.anthropic.com/settings/keys');
    }

    this.client = new Anthropic({
      apiKey: apiKey || 'sk-placeholder',
    });
  }

  /**
   * Define available tools for Claude
   */
  private getTools(allowedTools?: string[]) {
    const allTools = [
      {
        name: 'write_file',
        description: 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does.',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to working directory or absolute path',
            },
            content: {
              type: 'string',
              description: 'The file content to write',
            },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to working directory or absolute path',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'edit_file',
        description: 'Edit a specific section of a file by replacing old content with new content',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: {
              type: 'string',
              description: 'File path relative to working directory or absolute path',
            },
            old_content: {
              type: 'string',
              description: 'The exact content to find and replace',
            },
            new_content: {
              type: 'string',
              description: 'The replacement content',
            },
          },
          required: ['path', 'old_content', 'new_content'],
        },
      },
      {
        name: 'run_bash',
        description: 'Execute a bash command and return stdout/stderr',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: {
              type: 'string',
              description: 'The bash command to execute',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'grep_files',
        description: 'Search for a pattern in files using grep',
        input_schema: {
          type: 'object' as const,
          properties: {
            pattern: {
              type: 'string',
              description: 'The search pattern (supports regex)',
            },
            path: {
              type: 'string',
              description: 'Directory or file path to search in',
            },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'glob_files',
        description: 'Find files matching a glob pattern',
        input_schema: {
          type: 'object' as const,
          properties: {
            pattern: {
              type: 'string',
              description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")',
            },
            path: {
              type: 'string',
              description: 'Base directory to search in',
            },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'ocr_image',
        description: 'Perform OCR (Optical Character Recognition) on an image to extract text. Uses local MLX-VLM with DeepSeek-OCR model. Returns extracted text and optional bounding boxes for text regions.',
        input_schema: {
          type: 'object' as const,
          properties: {
            imagePath: {
              type: 'string',
              description: 'Path to the image file (relative to working directory or absolute)',
            },
            mode: {
              type: 'string',
              enum: ['document', 'general', 'figure', 'free'],
              description: 'OCR mode: "document" for structured docs/forms, "general" for any image, "figure" for charts/diagrams, "free" for custom prompt',
            },
            prompt: {
              type: 'string',
              description: 'Optional custom prompt for "free" mode (e.g., "Extract the table data as JSON")',
            },
          },
          required: ['imagePath', 'mode'],
        },
      },
    ];

    // Filter tools if allowedTools is specified
    if (allowedTools && allowedTools.length > 0) {
      // Map standard tool names to our custom tool names
      const toolNameMap: Record<string, string> = {
        'write': 'write_file',
        'read': 'read_file',
        'edit': 'edit_file',
        'bash': 'run_bash',
        'grep': 'grep_files',
        'glob': 'glob_files',
        'ocr': 'ocr_image',
      };

      const normalizedAllowed = allowedTools.map(t => {
        const normalized = t.toLowerCase();
        return toolNameMap[normalized] || normalized;
      });

      return allTools.filter(tool => normalizedAllowed.includes(tool.name));
    }
    return allTools;
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(
    toolName: string,
    toolInput: Record<string, any>,
    workingDirectory?: string
  ): Promise<string> {
    try {
      const baseDir = workingDirectory || process.cwd();

      switch (toolName) {
        case 'write_file': {
          const { path: filePath, content } = toolInput;
          const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(baseDir, filePath);

          // Ensure directory exists
          const directory = path.dirname(absolutePath);
          await fs.mkdir(directory, { recursive: true });

          await fs.writeFile(absolutePath, content, 'utf-8');
          console.log(`      ✓ Wrote file: ${absolutePath}`);
          return `Successfully wrote ${content.length} bytes to ${filePath}`;
        }

        case 'read_file': {
          const { path: filePath } = toolInput;
          const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(baseDir, filePath);

          const content = await fs.readFile(absolutePath, 'utf-8');
          console.log(`      ✓ Read file: ${absolutePath} (${content.length} bytes)`);
          return content;
        }

        case 'edit_file': {
          const { path: filePath, old_content, new_content } = toolInput;
          const absolutePath = path.isAbsolute(filePath)
            ? filePath
            : path.join(baseDir, filePath);

          let content = await fs.readFile(absolutePath, 'utf-8');

          if (!content.includes(old_content)) {
            return `Error: Could not find the exact content to replace in ${filePath}. Please verify the old_content matches exactly.`;
          }

          content = content.replace(old_content, new_content);
          await fs.writeFile(absolutePath, content, 'utf-8');
          console.log(`      ✓ Edited file: ${absolutePath}`);
          return `Successfully edited ${filePath}`;
        }

        case 'run_bash': {
          const { command } = toolInput;

          try {
            const output = execSync(command, {
              cwd: baseDir,
              encoding: 'utf-8',
              maxBuffer: 10 * 1024 * 1024, // 10MB buffer
              timeout: 30000, // 30 second timeout
            });
            console.log(`      ✓ Ran command: ${command}`);
            return output || 'Command executed successfully (no output)';
          } catch (error: any) {
            const errorMsg = error.stderr || error.message || String(error);
            console.log(`      ✗ Command failed: ${command}`);
            return `Command failed: ${errorMsg}`;
          }
        }

        case 'grep_files': {
          const { pattern, path: searchPath } = toolInput;
          const targetPath = searchPath
            ? (path.isAbsolute(searchPath) ? searchPath : path.join(baseDir, searchPath))
            : baseDir;

          try {
            const results: string[] = [];
            const regex = new RegExp(pattern, 'i');

            // Recursively search files
            async function searchDir(dirPath: string) {
              try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                  const fullPath = path.join(dirPath, entry.name);

                  // Skip common directories
                  if (entry.isDirectory()) {
                    if (!['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
                      await searchDir(fullPath);
                    }
                  } else if (entry.isFile()) {
                    try {
                      const content = await fs.readFile(fullPath, 'utf-8');
                      const lines = content.split('\n');

                      lines.forEach((line, index) => {
                        if (regex.test(line)) {
                          results.push(`${fullPath}:${index + 1}:${line.trim()}`);
                        }
                      });
                    } catch (err) {
                      // Skip files that can't be read as text
                    }
                  }
                }
              } catch (err) {
                // Skip directories we can't access
              }
            }

            await searchDir(targetPath);

            console.log(`      ✓ Grep search for: ${pattern} (${results.length} matches)`);
            return results.length > 0
              ? results.slice(0, 100).join('\n') + (results.length > 100 ? `\n... (${results.length - 100} more matches)` : '')
              : `No matches found for pattern: ${pattern}`;
          } catch (error: any) {
            const errorMsg = error.message || String(error);
            console.log(`      ✗ Grep failed: ${pattern}`);
            return `Grep failed: ${errorMsg}`;
          }
        }

        case 'glob_files': {
          const { pattern, path: searchPath } = toolInput;
          const targetPath = searchPath
            ? (path.isAbsolute(searchPath) ? searchPath : path.join(baseDir, searchPath))
            : baseDir;

          try {
            // Normalize path for glob (cross-platform compatible)
            const normalizedTargetPath = normalizePathForGlob(targetPath);

            // Use glob package for cross-platform file matching
            const matches = await glob(pattern, {
              cwd: normalizedTargetPath,
              ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/dist/**', '**/build/**'],
              absolute: false,
              nodir: false,
            });

            console.log(`      ✓ Glob search for: ${pattern} (${matches.length} files)`);

            if (matches.length === 0) {
              return `No files found matching pattern: ${pattern}`;
            }

            return matches.slice(0, 100).join('\n') + (matches.length > 100 ? `\n... (${matches.length - 100} more files)` : '');
          } catch (error: any) {
            const errorMsg = error.message || String(error);
            console.log(`      ✗ Glob failed: ${pattern}`);
            return `Glob failed: ${errorMsg}`;
          }
        }

        case 'ocr_image': {
          const { imagePath, mode, prompt: customPrompt } = toolInput;
          const absolutePath = path.isAbsolute(imagePath)
            ? imagePath
            : path.join(baseDir, imagePath);

          try {
            // Read image file and convert to base64
            const imageBuffer = await fs.readFile(absolutePath);
            const base64Image = imageBuffer.toString('base64');

            // Detect mime type from extension
            const ext = path.extname(absolutePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.bmp': 'image/bmp',
            };
            const mimeType = mimeTypes[ext] || 'image/png';
            const dataUri = `data:${mimeType};base64,${base64Image}`;

            // Call MLX OCR
            const mlxClient = getMLXVLMClient();

            // Check if MLX is available
            const isAvailable = await mlxClient.isAvailable();
            if (!isAvailable) {
              return `Error: MLX-VLM not available. Please install with: pip install mlx-vlm`;
            }

            // Check if model is downloaded
            const modelInfo = await mlxClient.getModelInfo();
            if (!modelInfo.available) {
              return `Error: DeepSeek-OCR model not downloaded. Run: python -c "from mlx_vlm import load; load('mlx-community/DeepSeek-OCR-4bit')"`;
            }

            console.log(`      → Running OCR on: ${absolutePath} (mode: ${mode})`);

            const result = await mlxClient.performOCR({
              image: dataUri,
              mode: mode as 'document' | 'general' | 'figure' | 'free',
              prompt: customPrompt,
            });

            console.log(`      ✓ OCR complete: ${result.text.length} chars, ${result.tokensPerSecond?.toFixed(1) || 'N/A'} tok/s`);

            // Format output with extracted text and metadata
            let output = `=== OCR RESULT ===\n`;
            output += `File: ${imagePath}\n`;
            output += `Mode: ${mode}\n`;
            output += `Tokens/sec: ${result.tokensPerSecond?.toFixed(1) || 'N/A'}\n`;
            output += `\n=== EXTRACTED TEXT ===\n${result.text}\n`;

            if (result.boundingBoxes && result.boundingBoxes.length > 0) {
              output += `\n=== BOUNDING BOXES (${result.boundingBoxes.length}) ===\n`;
              result.boundingBoxes.forEach((box, i) => {
                output += `${i + 1}. "${box.text}" at [${box.coordinates.join(', ')}]\n`;
              });
            }

            return output;
          } catch (error: any) {
            const errorMsg = error.message || String(error);
            console.log(`      ✗ OCR failed: ${imagePath}`);
            return `OCR failed for ${imagePath}: ${errorMsg}`;
          }
        }

        default:
          return `Error: Unknown tool '${toolName}'`;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`      ✗ Tool error (${toolName}):`, errorMsg);
      return `Error executing tool '${toolName}': ${errorMsg}`;
    }
  }

  /**
   * Helper method to call API with retry logic for rate limits
   */
  private async callWithRetry<T>(
    apiCall: () => Promise<T>,
    iteration: number,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        lastError = error;

        // Check if this is a rate limit error (429)
        const isRateLimit = error?.status === 429 || error?.error?.type === 'rate_limit_error';

        if (!isRateLimit) {
          // Not a rate limit error, throw immediately
          throw error;
        }

        // This is a rate limit error, retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
          console.log(`    ⚠️  Rate limit hit (429), retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries exhausted
    console.error(`    ❌ Rate limit error persisted after ${maxRetries} attempts`);
    throw lastError;
  }

  /**
   * Invoke agent with tool execution support (agentic loop)
   */
  async invokeAgent(options: AgentInvocationOptions): Promise<AgentResponse> {
    const {
      prompt,
      sessionId,
      allowedTools,
      maxTurns = 10,
      timeout = 300000,
      workingDirectory,
    } = options;

    const startTime = Date.now();
    const messages: MessageParam[] = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const tools = this.getTools(allowedTools);
    let iteration = 0;
    let totalCost = 0;
    const allMessages: any[] = [];

    console.log('    → Starting agentic loop');
    console.log('    → Working directory:', workingDirectory || process.cwd());
    console.log('    → Available tools:', tools.map(t => t.name).join(', '));

    try {
      while (iteration < maxTurns) {
        iteration++;
        console.log(`    → Iteration ${iteration}/${maxTurns}`);

        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new Error('Agent invocation timed out');
        }

        // Call Claude with tools (with retry for rate limits)
        const response = await this.callWithRetry(async () => {
          return await this.client.messages.create({
            model: 'claude-opus-4-20250514',
            max_tokens: 4096,
            tools: tools.length > 0 ? (tools as any) : undefined,
            messages,
          });
        }, iteration);

        // Calculate cost (Opus 4 pricing: $15/MTok input, $75/MTok output)
        const inputCost = (response.usage.input_tokens / 1000000) * 15.0;
        const outputCost = (response.usage.output_tokens / 1000000) * 75.0;
        totalCost += inputCost + outputCost;

        console.log(`    → Input tokens: ${response.usage.input_tokens}, Output: ${response.usage.output_tokens}`);
        console.log(`    → Stop reason: ${response.stop_reason}`);

        // Extract tool use and text blocks
        const toolUseBlocks = response.content.filter(
          (block: any) => block.type === 'tool_use'
        );
        const textBlocks = response.content.filter(
          (block: any) => block.type === 'text'
        );

        // Store assistant message
        allMessages.push({
          type: 'assistant',
          content: response.content,
        });

        // Add assistant response to conversation
        messages.push({
          role: 'assistant',
          content: response.content as any,
        });

        // If no tool use, we're done
        if (toolUseBlocks.length === 0) {
          console.log('    → No tool use, workflow complete');
          const finalText = textBlocks.map((b: any) => b.text).join('\n');

          return {
            sessionId: sessionId || '',
            messages: allMessages,
            cost: totalCost,
            duration: Date.now() - startTime,
            finalResponse: finalText,
          };
        }

        // Execute tools
        console.log(`    → Executing ${toolUseBlocks.length} tool(s)`);
        const toolResults: ToolResult[] = [];

        for (const toolUse of toolUseBlocks as any[]) {
          console.log(`      → Tool: ${toolUse.name}`);

          const result = await this.executeTool(
            toolUse.name,
            toolUse.input,
            workingDirectory
          );

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });
        }

        // Send tool results back to Claude
        messages.push({
          role: 'user',
          content: toolResults as any,
        });

        allMessages.push({
          type: 'tool_results',
          content: toolResults,
        });
      }

      // Max iterations reached
      console.log('    → Max iterations reached');
      return {
        sessionId: sessionId || '',
        messages: allMessages,
        cost: totalCost,
        duration: Date.now() - startTime,
        error: `Max iterations (${maxTurns}) reached`,
      };

    } catch (error) {
      console.error('    → Agent error:', error);
      return {
        sessionId: sessionId || '',
        messages: allMessages,
        cost: totalCost,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const anthropicService = new AnthropicService();
