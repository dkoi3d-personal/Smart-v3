/**
 * Deployment Service
 * Automatically detects project type and deploys accordingly
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  projectId: string;
  projectName: string;
  projectDirectory: string;
  environment: 'dev' | 'staging' | 'production';
}

export interface ProjectAnalysis {
  type: 'nextjs' | 'react' | 'node' | 'python' | 'static' | 'unknown';
  framework?: string;
  hasDatabase: boolean;
  databases: string[];
  buildCommand?: string;
  startCommand?: string;
  port?: number;
  dependencies: string[];
}

export interface BuildResult {
  success: boolean;
  buildTime: number;
  outputSize?: number;
  logs: string[];
  error?: string;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  url: string;
  projectAnalysis: ProjectAnalysis;
  buildResult: BuildResult;
  logs: string[];
  error?: string;
}

export class DeploymentService {
  /**
   * Analyze project to determine type, framework, and requirements
   */
  async analyzeProject(projectDirectory: string): Promise<ProjectAnalysis> {
    const analysis: ProjectAnalysis = {
      type: 'unknown',
      hasDatabase: false,
      databases: [],
      dependencies: [],
    };

    try {
      // Check for package.json (Node.js/JavaScript projects)
      const packageJsonPath = path.join(projectDirectory, 'package.json');
      try {
        const packageJsonData = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonData);

        analysis.dependencies = [
          ...Object.keys(packageJson.dependencies || {}),
          ...Object.keys(packageJson.devDependencies || {}),
        ];

        // Detect Next.js
        if (analysis.dependencies.includes('next')) {
          analysis.type = 'nextjs';
          analysis.framework = 'Next.js';
          analysis.buildCommand = packageJson.scripts?.build || 'npm run build';
          analysis.startCommand = packageJson.scripts?.start || 'npm start';
          analysis.port = 3000;
        }
        // Detect React
        else if (analysis.dependencies.includes('react') && !analysis.dependencies.includes('next')) {
          analysis.type = 'react';
          analysis.framework = 'React';
          analysis.buildCommand = packageJson.scripts?.build || 'npm run build';
          // React apps are usually static after build
          analysis.startCommand = 'npx serve -s build';
          analysis.port = 3000;
        }
        // Detect Express/Node.js
        else if (analysis.dependencies.includes('express')) {
          analysis.type = 'node';
          analysis.framework = 'Express';
          analysis.buildCommand = packageJson.scripts?.build;
          analysis.startCommand = packageJson.scripts?.start || 'node index.js';
          analysis.port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
        }
        // Generic Node.js
        else if (packageJson.scripts?.start) {
          analysis.type = 'node';
          analysis.framework = 'Node.js';
          analysis.startCommand = packageJson.scripts.start;
          analysis.port = 3000;
        }

        // Detect databases
        if (analysis.dependencies.includes('pg') || analysis.dependencies.includes('postgres')) {
          analysis.hasDatabase = true;
          analysis.databases.push('PostgreSQL');
        }
        if (analysis.dependencies.includes('mongodb') || analysis.dependencies.includes('mongoose')) {
          analysis.hasDatabase = true;
          analysis.databases.push('MongoDB');
        }
        if (analysis.dependencies.includes('mysql') || analysis.dependencies.includes('mysql2')) {
          analysis.hasDatabase = true;
          analysis.databases.push('MySQL');
        }
        if (analysis.dependencies.includes('prisma')) {
          analysis.hasDatabase = true;
          analysis.databases.push('Prisma (Database ORM)');
        }
      } catch (error) {
        // No package.json, continue checking other indicators
      }

      // Check for Python projects
      const requirementsPath = path.join(projectDirectory, 'requirements.txt');
      try {
        await fs.access(requirementsPath);
        analysis.type = 'python';
        analysis.framework = 'Python';
        analysis.startCommand = 'python main.py';

        // Check for Flask/Django
        const requirements = await fs.readFile(requirementsPath, 'utf-8');
        if (requirements.includes('flask')) {
          analysis.framework = 'Flask';
          analysis.startCommand = 'flask run';
        } else if (requirements.includes('django')) {
          analysis.framework = 'Django';
          analysis.startCommand = 'python manage.py runserver';
        } else if (requirements.includes('fastapi')) {
          analysis.framework = 'FastAPI';
          analysis.startCommand = 'uvicorn main:app';
        }

        // Check for database dependencies
        if (requirements.includes('psycopg2') || requirements.includes('asyncpg')) {
          analysis.hasDatabase = true;
          analysis.databases.push('PostgreSQL');
        }
        if (requirements.includes('pymongo')) {
          analysis.hasDatabase = true;
          analysis.databases.push('MongoDB');
        }
      } catch (error) {
        // No requirements.txt
      }

      // Check for static site
      const indexHtmlPath = path.join(projectDirectory, 'index.html');
      try {
        await fs.access(indexHtmlPath);
        if (analysis.type === 'unknown') {
          analysis.type = 'static';
          analysis.framework = 'Static HTML';
        }
      } catch (error) {
        // No index.html
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing project:', error);
      return analysis;
    }
  }

  /**
   * Build a project based on its detected type
   */
  async buildProject(config: DeploymentConfig, analysis: ProjectAnalysis): Promise<BuildResult> {
    const logs: string[] = [];
    const startTime = Date.now();

    try {
      logs.push(`📦 Building ${analysis.framework || analysis.type} app: ${config.projectName}`);
      logs.push(`📁 Project directory: ${config.projectDirectory}`);
      logs.push(`🔍 Detected: ${analysis.framework || analysis.type}`);

      if (analysis.hasDatabase) {
        logs.push(`💾 Databases: ${analysis.databases.join(', ')}`);
      }

      // Check if project directory exists
      try {
        await fs.access(config.projectDirectory);
      } catch (error) {
        throw new Error(`Project directory not found: ${config.projectDirectory}`);
      }

      // Build based on project type
      if (analysis.type === 'nextjs' || analysis.type === 'react' || analysis.type === 'node') {
        // Install dependencies
        logs.push('📥 Installing npm dependencies...');
        const { stdout: installOutput, stderr: installError } = await execAsync(
          'npm install',
          {
            cwd: config.projectDirectory,
            timeout: 120000, // 2 minutes timeout
          }
        );

        if (installError && !installError.includes('npm warn')) {
          logs.push(`⚠️  Install warnings: ${installError.substring(0, 200)}`);
        }
        logs.push('✅ Dependencies installed');

        // Run build if build command exists
        if (analysis.buildCommand) {
          logs.push(`🔨 Running build: ${analysis.buildCommand}...`);
          const { stdout: buildOutput, stderr: buildError } = await execAsync(
            analysis.buildCommand,
            {
              cwd: config.projectDirectory,
              timeout: 300000, // 5 minutes timeout
            }
          );

          if (buildError && !buildError.includes('warn')) {
            logs.push(`⚠️  Build warnings: ${buildError.substring(0, 200)}`);
          }
          logs.push('✅ Build completed successfully');
        } else {
          logs.push('ℹ️  No build step required for this project type');
        }

        // Get build output size
        let buildDir = path.join(config.projectDirectory, '.next');
        if (analysis.type === 'react') {
          buildDir = path.join(config.projectDirectory, 'build');
        }

        let outputSize = 0;
        try {
          const stats = await fs.stat(buildDir);
          outputSize = stats.size;
          logs.push(`📊 Build output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
          logs.push('ℹ️  Could not determine build size');
        }
      } else if (analysis.type === 'python') {
        logs.push('📥 Installing Python dependencies...');
        try {
          await execAsync('pip install -r requirements.txt', {
            cwd: config.projectDirectory,
            timeout: 120000,
          });
          logs.push('✅ Python dependencies installed');
        } catch (error) {
          logs.push('⚠️  No requirements.txt or pip install failed');
        }
      } else if (analysis.type === 'static') {
        logs.push('ℹ️  Static site - no build required');
      } else {
        logs.push('⚠️  Unknown project type - skipping build');
      }

      const buildTime = Date.now() - startTime;
      logs.push(`⏱️  Build completed in ${(buildTime / 1000).toFixed(2)}s`);

      return {
        success: true,
        buildTime,
        logs,
      };
    } catch (error) {
      const buildTime = Date.now() - startTime;
      logs.push(`❌ Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        buildTime,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy to mock hosting (for testing)
   * Returns a simulated URL that would be accessible
   */
  async deployToMockHosting(
    config: DeploymentConfig,
    analysis: ProjectAnalysis,
    buildResult: BuildResult
  ): Promise<DeploymentResult> {
    const logs: string[] = [];

    try {
      if (!buildResult.success) {
        throw new Error('Cannot deploy - build failed');
      }

      logs.push('🚀 Starting deployment to mock hosting...');
      logs.push(`📦 Deploying ${analysis.framework || analysis.type} application...`);

      // Simulate deployment steps
      logs.push('📤 Uploading build artifacts...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate upload
      logs.push('✅ Build artifacts uploaded');

      // Configure databases if needed
      if (analysis.hasDatabase) {
        logs.push(`💾 Provisioning databases: ${analysis.databases.join(', ')}...`);
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate database setup
        logs.push('✅ Databases provisioned');
      }

      logs.push('⚙️  Configuring server...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate configuration
      logs.push(`✅ Server configured (Port: ${analysis.port || 3000})`);

      logs.push('🔄 Starting application...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate startup
      logs.push('✅ Application started');

      // Generate deployment URL
      const deploymentId = `deploy-${config.projectId}-${Date.now()}`;
      const subdomain = config.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const url = `https://${subdomain}-${config.environment}.mock-deploy.app`;

      logs.push(`🌐 Deployment URL: ${url}`);
      logs.push(`📱 Framework: ${analysis.framework || analysis.type}`);
      if (analysis.hasDatabase) {
        logs.push(`💾 Connected to: ${analysis.databases.join(', ')}`);
      }
      logs.push('✨ Deployment completed successfully!');

      return {
        success: true,
        deploymentId,
        url,
        projectAnalysis: analysis,
        buildResult,
        logs,
      };
    } catch (error) {
      logs.push(`❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        success: false,
        deploymentId: `deploy-${config.projectId}-${Date.now()}`,
        url: '',
        projectAnalysis: analysis,
        buildResult,
        logs,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Full deployment workflow: analyze + build + deploy
   */
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    console.log(`🚀 Starting deployment for project: ${config.projectName}`);

    // Step 1: Analyze the project
    console.log('🔍 Analyzing project...');
    const analysis = await this.analyzeProject(config.projectDirectory);
    console.log(`📊 Detected: ${analysis.framework || analysis.type}`);
    if (analysis.hasDatabase) {
      console.log(`💾 Databases: ${analysis.databases.join(', ')}`);
    }

    // Step 2: Build the application
    const buildResult = await this.buildProject(config, analysis);

    if (!buildResult.success) {
      console.log(`❌ Build failed for project: ${config.projectName}`);
      return {
        success: false,
        deploymentId: `deploy-${config.projectId}-${Date.now()}`,
        url: '',
        projectAnalysis: analysis,
        buildResult,
        logs: buildResult.logs,
        error: buildResult.error,
      };
    }

    console.log(`✅ Build succeeded for project: ${config.projectName}`);

    // Step 3: Deploy the application
    const deploymentResult = await this.deployToMockHosting(config, analysis, buildResult);

    console.log(
      deploymentResult.success
        ? `✅ Deployment succeeded: ${deploymentResult.url}`
        : `❌ Deployment failed: ${deploymentResult.error}`
    );

    return deploymentResult;
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DeploymentService {
    return deploymentService;
  }
}

// Singleton instance
export const deploymentService = new DeploymentService();
