/**
 * Test the AI enhance prompt functionality
 */

import { AIService } from '../services/ai-service';

async function main() {
  console.log('=== AI Enhance Test ===\n');

  console.log('Checking providers...');
  const providers = AIService.getProviders();
  console.log('Available:', providers.length > 0 ? providers.join(', ') : 'None');
  console.log('Is available:', AIService.isAvailable());
  console.log('');

  if (!AIService.isAvailable()) {
    console.log('ERROR: No AI providers available!');
    process.exit(1);
  }

  console.log('Testing enhance prompt...');
  console.log('Input: "add dark mode"');
  console.log('');

  try {
    const result = await AIService.enhancePrompt('add dark mode');
    console.log('=== Enhanced Output ===');
    console.log(result);
    console.log('=======================');
    console.log('\nSUCCESS!');
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

main();
