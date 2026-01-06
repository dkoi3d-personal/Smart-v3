/**
 * Git Push API
 * Pushes changes to the remote repository
 */

import { NextRequest } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendLog = (message: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ log: message })}\n\n`));
        } catch { isClosed = true; }
      };

      const sendStatus = (status: string, data?: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status, ...data })}\n\n`));
        } catch { isClosed = true; }
      };

      const safeClose = () => {
        if (isClosed) return;
        isClosed = true;
        controller.close();
      };

      try {
        const { projectId, commitMessage, branch } = await request.json();

        if (!projectId) {
          sendLog('Error: Missing project ID');
          sendStatus('error', { error: 'Missing project ID' });
          safeClose();
          return;
        }

        const projectDir = getProjectDir(projectId).replace(/\\/g, '/');
        const targetBranch = branch || 'main';
        const message = commitMessage || 'Bug fixes from UAT testing';

        sendLog(`📁 Project: ${projectDir}`);
        sendLog(`🌿 Branch: ${targetBranch}`);
        sendLog(`📝 Commit message: ${message}`);
        sendLog('');

        // Step 1: Check git status
        sendLog('🔍 Checking git status...');
        try {
          const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: projectDir });
          if (!statusOut.trim()) {
            sendLog('ℹ️ No changes to commit');
            sendStatus('complete', { success: true, message: 'No changes to push' });
            safeClose();
            return;
          }
          sendLog(`Found changes:\n${statusOut}`);
        } catch (error) {
          sendLog(`❌ Git status failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          sendStatus('error', { error: 'Failed to check git status' });
          safeClose();
          return;
        }

        // Step 2: Stage all changes
        sendLog('📦 Staging changes...');
        try {
          await execAsync('git add -A', { cwd: projectDir });
          sendLog('✅ Changes staged');
        } catch (error) {
          sendLog(`❌ Git add failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          sendStatus('error', { error: 'Failed to stage changes' });
          safeClose();
          return;
        }

        // Step 3: Commit
        sendLog('💾 Creating commit...');
        try {
          const { stdout: commitOut } = await execAsync(
            `git commit -m "${message.replace(/"/g, '\\"')}"`,
            { cwd: projectDir }
          );
          sendLog(commitOut);
          sendLog('✅ Commit created');
        } catch (error: any) {
          if (error.message?.includes('nothing to commit')) {
            sendLog('ℹ️ Nothing to commit');
          } else {
            sendLog(`❌ Git commit failed: ${error.message || 'Unknown error'}`);
            sendStatus('error', { error: 'Failed to create commit' });
            safeClose();
            return;
          }
        }

        // Step 4: Push to remote
        sendLog(`🚀 Pushing to origin/${targetBranch}...`);

        const pushProcess = spawn('git', ['push', 'origin', targetBranch], {
          cwd: projectDir,
          shell: true,
          env: process.env,
        });

        pushProcess.stdout?.on('data', (data) => {
          sendLog(data.toString().trim());
        });

        pushProcess.stderr?.on('data', (data) => {
          const output = data.toString().trim();
          // Git often outputs progress to stderr
          if (output) {
            sendLog(output);
          }
        });

        pushProcess.on('error', (err) => {
          sendLog(`❌ Push error: ${err.message}`);
          sendStatus('error', { error: err.message });
        });

        pushProcess.on('close', (code) => {
          if (code === 0) {
            sendLog('');
            sendLog('✅ Successfully pushed to remote!');
            sendStatus('complete', { success: true });
          } else {
            sendLog(`❌ Push failed with exit code ${code}`);
            sendStatus('error', { error: `Push failed with exit code ${code}` });
          }
          safeClose();
        });

        // Timeout after 2 minutes
        setTimeout(() => {
          if (!pushProcess.killed) {
            pushProcess.kill();
            sendLog('⏰ Push timed out after 2 minutes');
            sendStatus('error', { error: 'Timeout' });
            safeClose();
          }
        }, 2 * 60 * 1000);

      } catch (error) {
        sendLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        sendStatus('error', { error: error instanceof Error ? error.message : 'Unknown error' });
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// GET - Check git status and remote info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'Missing project ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const projectDir = getProjectDir(projectId).replace(/\\/g, '/');

    // Get git status
    const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: projectDir });

    // Get current branch
    const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: projectDir });

    // Get remote URL
    let remoteUrl = '';
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: projectDir });
      remoteUrl = stdout.trim();
    } catch {
      // No remote configured
    }

    // Get last commit
    let lastCommit = null;
    try {
      const { stdout } = await execAsync('git log -1 --format="%h %s"', { cwd: projectDir });
      lastCommit = stdout.trim();
    } catch {
      // No commits yet
    }

    return new Response(JSON.stringify({
      hasChanges: !!statusOut.trim(),
      changes: statusOut.trim().split('\n').filter(Boolean),
      branch: branchOut.trim(),
      remoteUrl,
      lastCommit,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Failed to get git status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
