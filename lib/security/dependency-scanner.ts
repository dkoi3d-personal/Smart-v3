/**
 * Dependency Vulnerability Scanner (SCA - Software Composition Analysis)
 * Scans package.json and lock files for known vulnerabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getNpmCommand } from '@/lib/cross-platform';

export interface DependencyVulnerability {
  id: string;
  packageName: string;
  installedVersion: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  vulnerableRange: string;
  patchedVersions: string;
  title: string;
  description: string;
  cve?: string[];
  cwe?: string[];
  url?: string;
  recommendation: string;
  isDirect: boolean;
  dependencyPath: string[];
}

export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  type: 'dependencies' | 'devDependencies';
  homepage?: string;
}

export interface DependencyScanResult {
  vulnerabilities: DependencyVulnerability[];
  outdatedPackages: OutdatedPackage[];
  metadata: {
    totalDependencies: number;
    directDependencies: number;
    devDependencies: number;
    scanDuration: number;
  };
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    total: number;
    outdated: number;
  };
}

interface NpmAuditResult {
  vulnerabilities?: Record<string, {
    name: string;
    severity: string;
    isDirect: boolean;
    via: Array<string | { title: string; url: string; severity: string; cwe: string[]; cvss?: { score: number } }>;
    effects: string[];
    range: string;
    nodes: string[];
    fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
  }>;
  metadata?: {
    vulnerabilities: {
      info: number;
      low: number;
      moderate: number;
      high: number;
      critical: number;
      total: number;
    };
    dependencies: {
      prod: number;
      dev: number;
      optional: number;
      peer: number;
      peerOptional: number;
      total: number;
    };
  };
}

export class DependencyScanner {
  async scan(projectDirectory: string): Promise<DependencyScanResult> {
    const startTime = Date.now();
    const vulnerabilities: DependencyVulnerability[] = [];
    const outdatedPackages: OutdatedPackage[] = [];

    // Check if package.json exists
    const packageJsonPath = path.join(projectDirectory, 'package.json');
    let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    } catch {
      return {
        vulnerabilities: [],
        outdatedPackages: [],
        metadata: {
          totalDependencies: 0,
          directDependencies: 0,
          devDependencies: 0,
          scanDuration: Date.now() - startTime,
        },
        summary: {
          critical: 0,
          high: 0,
          moderate: 0,
          low: 0,
          total: 0,
          outdated: 0,
        },
      };
    }

    const directDeps = Object.keys(packageJson.dependencies || {}).length;
    const devDeps = Object.keys(packageJson.devDependencies || {}).length;

    // Run npm audit
    try {
      const auditResult = this.runNpmAudit(projectDirectory);
      if (auditResult.vulnerabilities) {
        for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities)) {
          const finding = this.parseVulnerability(pkgName, vuln);
          if (finding) {
            vulnerabilities.push(finding);
          }
        }
      }
    } catch (error) {
      console.warn('npm audit failed, continuing with limited scan');
    }

    // Check for outdated packages
    try {
      const outdated = this.checkOutdated(projectDirectory);
      outdatedPackages.push(...outdated);
    } catch {
      console.warn('Could not check for outdated packages');
    }

    // Calculate summary
    const summary = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      moderate: vulnerabilities.filter(v => v.severity === 'moderate').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length,
      total: vulnerabilities.length,
      outdated: outdatedPackages.length,
    };

    return {
      vulnerabilities,
      outdatedPackages,
      metadata: {
        totalDependencies: directDeps + devDeps,
        directDependencies: directDeps,
        devDependencies: devDeps,
        scanDuration: Date.now() - startTime,
      },
      summary,
    };
  }

  private runNpmAudit(directory: string): NpmAuditResult {
    const npmCmd = getNpmCommand();
    const { execSync } = require('child_process');

    try {
      // Run npm audit with JSON output (cross-platform compatible)
      const output = execSync(`${npmCmd} audit --json`, {
        cwd: directory,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr properly instead of 2>/dev/null
      });

      if (output.trim()) {
        return JSON.parse(output);
      }
    } catch (error: unknown) {
      // npm audit returns exit code 1 when vulnerabilities are found
      const execError = error as { stdout?: string };
      if (execError.stdout) {
        try {
          return JSON.parse(execError.stdout);
        } catch {
          // JSON parse failed
        }
      }
    }
    return {};
  }

  private parseVulnerability(
    packageName: string,
    vuln: {
      name: string;
      severity: string;
      isDirect: boolean;
      via: Array<string | { title: string; url: string; severity: string; cwe: string[] }>;
      effects: string[];
      range: string;
      nodes: string[];
      fixAvailable: boolean | { name: string; version: string; isSemVerMajor: boolean };
    }
  ): DependencyVulnerability | null {
    // Get the first detailed vulnerability info
    const details = vuln.via.find(v => typeof v === 'object') as
      | { title: string; url: string; severity: string; cwe: string[] }
      | undefined;

    if (!details && typeof vuln.via[0] === 'string') {
      // This is a transitive vulnerability reference
      return null;
    }

    const severity = (vuln.severity || details?.severity || 'moderate').toLowerCase() as
      | 'critical'
      | 'high'
      | 'moderate'
      | 'low';

    let recommendation = 'No fix available';
    if (vuln.fixAvailable) {
      if (typeof vuln.fixAvailable === 'object') {
        recommendation = `Update to ${vuln.fixAvailable.name}@${vuln.fixAvailable.version}${vuln.fixAvailable.isSemVerMajor ? ' (major version change)' : ''}`;
      } else {
        recommendation = 'Run npm audit fix';
      }
    }

    return {
      id: `dep-vuln-${packageName}-${Date.now()}`,
      packageName,
      installedVersion: vuln.nodes[0]?.split('@').pop() || 'unknown',
      severity,
      vulnerableRange: vuln.range,
      patchedVersions: typeof vuln.fixAvailable === 'object' ? vuln.fixAvailable.version : 'unknown',
      title: details?.title || `Vulnerability in ${packageName}`,
      description: `${packageName} ${vuln.range} has a ${severity} severity vulnerability`,
      cve: [],
      cwe: details?.cwe || [],
      url: details?.url,
      recommendation,
      isDirect: vuln.isDirect,
      dependencyPath: vuln.effects.length > 0 ? [packageName, ...vuln.effects] : [packageName],
    };
  }

  private checkOutdated(directory: string): OutdatedPackage[] {
    const outdated: OutdatedPackage[] = [];
    const npmCmd = getNpmCommand();
    const { execSync } = require('child_process');

    try {
      // Run npm outdated with JSON output (cross-platform compatible)
      const output = execSync(`${npmCmd} outdated --json`, {
        cwd: directory,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe'], // Capture stderr properly instead of 2>/dev/null
      });

      if (output.trim()) {
        const result = JSON.parse(output) as Record<
          string,
          {
            current: string;
            wanted: string;
            latest: string;
            dependent: string;
            type: 'dependencies' | 'devDependencies';
            homepage?: string;
          }
        >;

        for (const [name, info] of Object.entries(result)) {
          outdated.push({
            name,
            current: info.current,
            wanted: info.wanted,
            latest: info.latest,
            type: info.type || 'dependencies',
            homepage: info.homepage,
          });
        }
      }
    } catch {
      // npm outdated returns exit code 1 when packages are outdated
    }

    return outdated;
  }

  /**
   * Generate SBOM (Software Bill of Materials)
   */
  async generateSBOM(
    projectDirectory: string
  ): Promise<{ packages: Array<{ name: string; version: string; license?: string }>; generated: Date }> {
    const packages: Array<{ name: string; version: string; license?: string }> = [];

    try {
      const lockPath = path.join(projectDirectory, 'package-lock.json');
      const content = await fs.readFile(lockPath, 'utf-8');
      const lock = JSON.parse(content) as {
        packages?: Record<string, { version: string; license?: string }>;
      };

      if (lock.packages) {
        for (const [pkgPath, info] of Object.entries(lock.packages)) {
          if (pkgPath && pkgPath !== '') {
            const name = pkgPath.replace('node_modules/', '');
            packages.push({
              name,
              version: info.version,
              license: info.license,
            });
          }
        }
      }
    } catch {
      // Could not read lock file
    }

    return {
      packages,
      generated: new Date(),
    };
  }
}

export const dependencyScanner = new DependencyScanner();
