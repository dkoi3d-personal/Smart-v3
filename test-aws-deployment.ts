/**
 * AWS Deployment Test
 * Tests if AWS SDK can build and deploy an app with a URL
 */

import { awsDeploymentService } from './services/aws-deployment';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testAWSDeployment() {
  console.log('🧪 Testing AWS Deployment Capabilities\n');
  console.log('=' .repeat(60));

  // Test 1: AWS Connection
  console.log('\n📡 Test 1: AWS Connection');
  console.log('-'.repeat(60));

  const connectionTest = await awsDeploymentService.testConnection();
  console.log(`Status: ${connectionTest.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`Message: ${connectionTest.message}`);

  if (!connectionTest.success) {
    console.log('\n❌ AWS connection failed. Check your credentials in .env.local');
    return;
  }

  // Test 2: Deploy Next.js to Lambda + API Gateway
  console.log('\n\n🚀 Test 2: Deploy Next.js App to AWS Lambda');
  console.log('-'.repeat(60));

  try {
    const deploymentResult = await awsDeploymentService.deployNextJsToLambda({
      projectId: 'test-proj-' + Date.now(),
      projectName: 'test-nextjs-app',
      environment: 'dev',
      deploymentType: 'lambda',
    });

    console.log(`\nDeployment Status: ${deploymentResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Deployment ID: ${deploymentResult.deploymentId}`);

    console.log('\n📋 Deployment Logs:');
    deploymentResult.logs.forEach(log => console.log(`  ${log}`));

    console.log('\n📦 Resources Created:');
    deploymentResult.resources.forEach(resource => {
      console.log(`  - ${resource.type}: ${resource.id}`);
      if (resource.url) {
        console.log(`    URL: ${resource.url}`);
      }
    });

    if (deploymentResult.error) {
      console.log(`\n❌ Error: ${deploymentResult.error}`);
    }

    // Test 3: Deploy Static Site to S3
    console.log('\n\n🌐 Test 3: Deploy Static Site to S3');
    console.log('-'.repeat(60));

    const staticResult = await awsDeploymentService.deployStaticSite({
      projectId: 'test-static-' + Date.now(),
      projectName: 'test-static-site',
      environment: 'dev',
      deploymentType: 'static',
    });

    console.log(`\nDeployment Status: ${staticResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Deployment ID: ${staticResult.deploymentId}`);

    console.log('\n📋 Deployment Logs:');
    staticResult.logs.forEach(log => console.log(`  ${log}`));

    console.log('\n📦 Resources Created:');
    staticResult.resources.forEach(resource => {
      console.log(`  - ${resource.type}: ${resource.id}`);
      if (resource.url) {
        console.log(`    URL: ${resource.url}`);
      }
    });

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ AWS Connection: ${connectionTest.success ? 'PASS' : 'FAIL'}`);
    console.log(`${deploymentResult.success ? '✅' : '❌'} Lambda Deployment: ${deploymentResult.success ? 'PASS' : 'FAIL'}`);
    console.log(`${staticResult.success ? '✅' : '❌'} Static Site Deployment: ${staticResult.success ? 'PASS' : 'FAIL'}`);

    const allPassed = connectionTest.success && deploymentResult.success && staticResult.success;

    if (allPassed) {
      console.log('\n🎉 All tests passed! AWS SDK is ready for deployment.');
      console.log('\n📝 URLs Generated:');
      deploymentResult.resources.forEach(r => {
        if (r.url) console.log(`  ${r.type}: ${r.url}`);
      });
      staticResult.resources.forEach(r => {
        if (r.url) console.log(`  ${r.type}: ${r.url}`);
      });
    } else {
      console.log('\n⚠️  Some tests failed. Review the logs above.');
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

// Run the test
testAWSDeployment()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
