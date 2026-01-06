/**
 * Test script for OpenAI service
 * Run with: npx tsx scripts/test-openai.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const AI_CONFIG_PATH = path.join(process.cwd(), 'data', 'ai-config.json');

interface TestResult {
  success: boolean;
  provider: string;
  model?: string;
  response?: string;
  error?: string;
  latency?: number;
}

async function testOpenAI(): Promise<TestResult> {
  console.log('\n🔍 Testing OpenAI Service...\n');

  // Load config
  const configRaw = fs.readFileSync(AI_CONFIG_PATH, 'utf-8');
  const config = JSON.parse(configRaw);

  // Check for API key
  let apiKey = config.providers?.openai?.apiKey;

  // Also check environment variable
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY;
  }

  if (!apiKey) {
    console.log('❌ No OpenAI API key found!');
    console.log('\nTo configure:');
    console.log('  1. Set OPENAI_API_KEY environment variable, OR');
    console.log('  2. Add key to data/ai-config.json under providers.openai.apiKey');
    return { success: false, provider: 'openai', error: 'No API key configured' };
  }

  console.log('✅ API Key found');
  console.log(`📦 Model: ${config.providers?.openai?.defaultModel || 'gpt-4o-mini'}`);

  const model = config.providers?.openai?.defaultModel || 'gpt-4o-mini';
  const testPrompt = 'Say "Hello! OpenAI is working correctly." and nothing else.';

  console.log('\n📤 Sending test request...');
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 50,
      }),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error?.message || `HTTP ${response.status}`;
      console.log(`\n❌ Request failed: ${errorMsg}`);
      return { success: false, provider: 'openai', model, error: errorMsg, latency };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'No response';

    console.log(`\n✅ Success! (${latency}ms)`);
    console.log(`📨 Response: "${content}"`);
    console.log(`🔢 Tokens: ${data.usage?.total_tokens || 'N/A'}`);

    return {
      success: true,
      provider: 'openai',
      model: data.model,
      response: content,
      latency,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.log(`\n❌ Error: ${errorMsg}`);
    return { success: false, provider: 'openai', model, error: errorMsg };
  }
}

async function testViaAPI(): Promise<void> {
  console.log('\n\n🌐 Testing via API endpoint (/api/ai-config/test)...\n');

  try {
    // This requires the dev server to be running
    const response = await fetch('http://localhost:3000/api/ai-config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai' }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ API test passed!');
      console.log(`   Provider: ${data.provider}`);
      console.log(`   Model: ${data.model}`);
      console.log(`   Response: "${data.response}"`);
    } else {
      console.log(`❌ API test failed: ${data.error}`);
    }
  } catch (error) {
    console.log('⚠️  API test skipped (dev server not running)');
    console.log('   Start with: npm run dev');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('       OpenAI Service Test Script          ');
  console.log('═══════════════════════════════════════════');

  // Direct test
  const result = await testOpenAI();

  // API test (optional)
  await testViaAPI();

  console.log('\n═══════════════════════════════════════════');
  console.log('                 Summary                   ');
  console.log('═══════════════════════════════════════════');

  if (result.success) {
    console.log('\n✅ OpenAI service is working correctly!');
    console.log('\nYou can now use it in your services:');
    console.log(`
  import { llmRouter } from '@/lib/services/llm-router';

  const response = await llmRouter.chat({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ],
  }, { taskType: 'chat' });

  console.log(response.content);
`);
  } else {
    console.log('\n❌ OpenAI service test failed.');
    console.log(`\nError: ${result.error}`);
    console.log('\nTroubleshooting:');
    console.log('  1. Check your API key is valid');
    console.log('  2. Ensure you have credits on your OpenAI account');
    console.log('  3. Check network connectivity');
  }
}

main().catch(console.error);
