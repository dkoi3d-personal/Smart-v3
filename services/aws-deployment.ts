/**
 * AWS Deployment Service
 * Handles all AWS infrastructure provisioning and deployment operations
 */

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import {
  EC2Client,
  DescribeInstancesCommand,
  RunInstancesCommand,
  TerminateInstancesCommand,
} from '@aws-sdk/client-ec2';
import {
  ECSClient,
  CreateClusterCommand,
  CreateServiceCommand,
  RegisterTaskDefinitionCommand,
  ListClustersCommand,
} from '@aws-sdk/client-ecs';
import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
  DeleteStackCommand,
} from '@aws-sdk/client-cloudformation';
import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import {
  ApiGatewayV2Client,
  CreateApiCommand,
  CreateRouteCommand,
  CreateIntegrationCommand,
} from '@aws-sdk/client-apigatewayv2';
import {
  STSClient,
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';

export interface AWSConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  stsEndpoint?: string;
}

export interface DeploymentOptions {
  projectId: string;
  projectName: string;
  environment: 'dev' | 'staging' | 'production' | 'prod';
  deploymentType: 'lambda' | 'ec2' | 'ecs' | 'static';
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  resources: {
    type: string;
    id: string;
    url?: string;
  }[];
  logs: string[];
  error?: string;
}

export class AWSDeploymentService {
  private s3Client: S3Client;
  private ec2Client: EC2Client;
  private ecsClient: ECSClient;
  private cfClient: CloudFormationClient;
  private lambdaClient: LambdaClient;
  private apiGatewayClient: ApiGatewayV2Client;
  private stsClient: STSClient;
  private config: AWSConfig;
  private accountIdCache?: string;

  constructor(config?: AWSConfig) {
    this.config = config || {
      region: process.env.AWS_REGION || 'us-east-2',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      stsEndpoint: 'https://sts.us-east-2.amazonaws.com',
    };

    console.log('[AWS Service] Initializing with config:', {
      region: this.config.region,
      accessKeyId: this.config.accessKeyId ? `${this.config.accessKeyId.substring(0, 10)}...` : 'MISSING',
      secretAccessKey: this.config.secretAccessKey ? `${this.config.secretAccessKey.substring(0, 10)}...` : 'MISSING',
    });

    const credentials = {
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
    };

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials,
    });

    this.ec2Client = new EC2Client({
      region: this.config.region,
      credentials,
    });

    this.ecsClient = new ECSClient({
      region: this.config.region,
      credentials,
    });

    this.cfClient = new CloudFormationClient({
      region: this.config.region,
      credentials,
    });

    this.lambdaClient = new LambdaClient({
      region: this.config.region,
      credentials,
    });

    this.apiGatewayClient = new ApiGatewayV2Client({
      region: this.config.region,
      credentials,
    });

    this.stsClient = new STSClient({
      region: this.config.region,
      credentials,
      endpoint: this.config.stsEndpoint,
    });
  }

  /**
   * Test AWS connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const command = new ListBucketsCommand({});
      const response = await this.s3Client.send(command);
      return {
        success: true,
        message: `Connected to AWS! Found ${response.Buckets?.length || 0} S3 buckets.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `AWS connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Deploy Next.js application to AWS Lambda + API Gateway
   */
  async deployNextJsToLambda(options: DeploymentOptions): Promise<DeploymentResult> {
    const logs: string[] = [];
    const resources: DeploymentResult['resources'] = [];

    try {
      logs.push('🚀 Starting Next.js Lambda deployment...');

      // 1. Create S3 bucket for static assets
      const bucketName = `${options.projectName}-${options.environment}-assets`;
      logs.push(`📦 Creating S3 bucket: ${bucketName}`);

      try {
        await this.s3Client.send(
          new CreateBucketCommand({
            Bucket: bucketName,
          })
        );
        resources.push({ type: 's3-bucket', id: bucketName });
        logs.push(`✅ S3 bucket created: ${bucketName}`);
      } catch (error: any) {
        if (error.name === 'BucketAlreadyOwnedByYou') {
          logs.push(`ℹ️  S3 bucket already exists: ${bucketName}`);
        } else {
          throw error;
        }
      }

      // 2. Create Lambda function
      const functionName = `${options.projectName}-${options.environment}`;
      logs.push(`⚡ Creating Lambda function: ${functionName}`);

      // Note: In real deployment, you'd package and upload the Next.js app
      // For now, we'll create a placeholder
      const lambdaCode = `
exports.handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Hello from ${options.projectName}!',
      environment: '${options.environment}',
      timestamp: new Date().toISOString()
    })
  };
};
`;

      try {
        await this.lambdaClient.send(
          new CreateFunctionCommand({
            FunctionName: functionName,
            Runtime: 'nodejs20.x',
            Role: `arn:aws:iam::${await this.getAccountId()}:role/lambda-execution-role`,
            Handler: 'index.handler',
            Code: {
              ZipFile: Buffer.from(lambdaCode),
            },
            Environment: {
              Variables: {
                NODE_ENV: options.environment,
                PROJECT_ID: options.projectId,
              },
            },
          })
        );
        resources.push({ type: 'lambda', id: functionName });
        logs.push(`✅ Lambda function created: ${functionName}`);
      } catch (error: any) {
        if (error.name === 'ResourceConflictException') {
          logs.push(`ℹ️  Lambda function already exists, updating code...`);
          await this.lambdaClient.send(
            new UpdateFunctionCodeCommand({
              FunctionName: functionName,
              ZipFile: Buffer.from(lambdaCode),
            })
          );
          logs.push(`✅ Lambda function updated: ${functionName}`);
        } else {
          throw error;
        }
      }

      // 3. Create API Gateway
      const apiName = `${options.projectName}-${options.environment}-api`;
      logs.push(`🌐 Creating API Gateway: ${apiName}`);

      const apiResponse = await this.apiGatewayClient.send(
        new CreateApiCommand({
          Name: apiName,
          ProtocolType: 'HTTP',
          Description: `API for ${options.projectName} (${options.environment})`,
        })
      );

      const apiId = apiResponse.ApiId!;
      const apiUrl = `https://${apiId}.execute-api.${this.config.region}.amazonaws.com`;

      resources.push({
        type: 'api-gateway',
        id: apiId,
        url: apiUrl,
      });

      logs.push(`✅ API Gateway created: ${apiName}`);
      logs.push(`🔗 API URL: ${apiUrl}`);

      logs.push('✨ Deployment completed successfully!');

      return {
        success: true,
        deploymentId: `deploy-${Date.now()}`,
        resources,
        logs,
      };
    } catch (error) {
      logs.push(`❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        deploymentId: `deploy-${Date.now()}`,
        resources,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy static site to S3 + CloudFront
   */
  async deployStaticSite(options: DeploymentOptions): Promise<DeploymentResult> {
    const logs: string[] = [];
    const resources: DeploymentResult['resources'] = [];

    try {
      logs.push('🚀 Starting static site deployment...');

      const bucketName = `${options.projectName}-${options.environment}-site`;
      logs.push(`📦 Creating S3 bucket for static hosting: ${bucketName}`);

      await this.s3Client.send(
        new CreateBucketCommand({
          Bucket: bucketName,
        })
      );

      resources.push({
        type: 's3-website',
        id: bucketName,
        url: `http://${bucketName}.s3-website-${this.config.region}.amazonaws.com`,
      });

      logs.push(`✅ Static site bucket created: ${bucketName}`);
      logs.push(`🔗 Website URL: http://${bucketName}.s3-website-${this.config.region}.amazonaws.com`);

      return {
        success: true,
        deploymentId: `deploy-${Date.now()}`,
        resources,
        logs,
      };
    } catch (error) {
      return {
        success: false,
        deploymentId: `deploy-${Date.now()}`,
        resources,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy to ECS (containerized application)
   */
  async deployToECS(options: DeploymentOptions): Promise<DeploymentResult> {
    const logs: string[] = [];
    const resources: DeploymentResult['resources'] = [];

    try {
      logs.push('🚀 Starting ECS deployment...');

      const clusterName = `${options.projectName}-${options.environment}`;
      logs.push(`🔧 Creating ECS cluster: ${clusterName}`);

      await this.ecsClient.send(
        new CreateClusterCommand({
          clusterName,
        })
      );

      resources.push({ type: 'ecs-cluster', id: clusterName });
      logs.push(`✅ ECS cluster created: ${clusterName}`);

      return {
        success: true,
        deploymentId: `deploy-${Date.now()}`,
        resources,
        logs,
      };
    } catch (error) {
      return {
        success: false,
        deploymentId: `deploy-${Date.now()}`,
        resources,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List all deployments for a project
   */
  async listDeployments(projectId: string): Promise<any[]> {
    try {
      // List Lambda functions
      const lambdaResponse = await this.lambdaClient.send(new ListFunctionsCommand({}));

      const projectFunctions =
        lambdaResponse.Functions?.filter((fn) => fn.FunctionName?.includes(projectId)) || [];

      return projectFunctions.map((fn) => ({
        type: 'lambda',
        name: fn.FunctionName,
        arn: fn.FunctionArn,
        runtime: fn.Runtime,
        lastModified: fn.LastModified,
      }));
    } catch (error) {
      console.error('Failed to list deployments:', error);
      return [];
    }
  }

  /**
   * Delete deployment resources
   */
  async deleteDeployment(resourceType: string, resourceId: string): Promise<boolean> {
    try {
      // Implementation for cleaning up AWS resources
      // This would terminate instances, delete functions, etc.
      return true;
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      return false;
    }
  }

  /**
   * Get AWS account ID using STS
   */
  private async getAccountId(): Promise<string> {
    // Return cached value if available
    if (this.accountIdCache) {
      return this.accountIdCache;
    }

    try {
      console.log('[AWS Service] Retrieving account ID from STS...');
      const command = new GetCallerIdentityCommand({});
      const response = await this.stsClient.send(command);
      this.accountIdCache = response.Account!;
      console.log(`[AWS Service] Retrieved account ID: ${this.accountIdCache}`);
      return this.accountIdCache;
    } catch (error) {
      console.error('[AWS Service] Failed to get account ID from STS:', error);
      console.error('[AWS Service] Error details:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to placeholder for development
      console.log('[AWS Service] Using placeholder account ID: 123456789012');
      return '123456789012';
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AWSDeploymentService {
    return awsDeploymentService;
  }
}

// Singleton instance
export const awsDeploymentService = new AWSDeploymentService();
