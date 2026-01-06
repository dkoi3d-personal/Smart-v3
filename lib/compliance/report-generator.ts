/**
 * Compliance Report Generator
 *
 * Generates comprehensive compliance reports in various formats:
 * - JSON (machine-readable)
 * - HTML (human-readable with styling)
 * - PDF (formal document)
 * - SARIF (GitHub/IDE integration)
 */

import {
  ComplianceScanResult,
  ComplianceViolation,
  ComplianceRecommendation,
  RegulatoryCoverage,
  ComplianceSeverity,
} from './types';

// ============================================================================
// REPORT TYPES
// ============================================================================

export type ReportFormat = 'json' | 'html' | 'sarif' | 'markdown';

export interface ReportOptions {
  format: ReportFormat;
  includeCodeSnippets: boolean;
  includeRecommendations: boolean;
  includeRegulatoryCoverage: boolean;
  companyName?: string;
  projectName?: string;
  auditorName?: string;
}

// ============================================================================
// REPORT GENERATOR CLASS
// ============================================================================

export class ComplianceReportGenerator {
  private result: ComplianceScanResult;
  private options: ReportOptions;

  constructor(result: ComplianceScanResult, options: Partial<ReportOptions> = {}) {
    this.result = result;
    this.options = {
      format: options.format || 'html',
      includeCodeSnippets: options.includeCodeSnippets ?? true,
      includeRecommendations: options.includeRecommendations ?? true,
      includeRegulatoryCoverage: options.includeRegulatoryCoverage ?? true,
      companyName: options.companyName,
      projectName: options.projectName || result.projectName,
      auditorName: options.auditorName,
    };
  }

  generate(): string {
    switch (this.options.format) {
      case 'json':
        return this.generateJSON();
      case 'html':
        return this.generateHTML();
      case 'sarif':
        return this.generateSARIF();
      case 'markdown':
        return this.generateMarkdown();
      default:
        throw new Error(`Unsupported format: ${this.options.format}`);
    }
  }

  // =========================================================================
  // JSON FORMAT
  // =========================================================================

  private generateJSON(): string {
    return JSON.stringify(this.result, null, 2);
  }

  // =========================================================================
  // HTML FORMAT
  // =========================================================================

  private generateHTML(): string {
    const { result, options } = this;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Healthcare Compliance Report - ${options.projectName}</title>
  <style>
    :root {
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #3b82f6;
      --info: #6b7280;
      --success: #22c55e;
      --bg-dark: #111827;
      --bg-card: #1f2937;
      --text-primary: #f9fafb;
      --text-secondary: #9ca3af;
      --border: #374151;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-dark);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
    }

    .container { max-width: 1200px; margin: 0 auto; }

    header {
      text-align: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; color: var(--text-primary); }
    h3 { font-size: 1.1rem; margin: 1rem 0 0.5rem; color: var(--text-secondary); }

    .meta { color: var(--text-secondary); font-size: 0.9rem; }

    .score-section {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin: 2rem 0;
    }

    .score-gauge {
      text-align: center;
    }

    .score-value {
      font-size: 4rem;
      font-weight: bold;
      color: ${this.getScoreColor(result.summary.complianceScore)};
    }

    .score-label {
      color: var(--text-secondary);
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 0.1em;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin: 2rem 0;
    }

    .summary-card {
      background: var(--bg-card);
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      border: 1px solid var(--border);
    }

    .summary-card.critical { border-left: 4px solid var(--critical); }
    .summary-card.high { border-left: 4px solid var(--high); }
    .summary-card.medium { border-left: 4px solid var(--medium); }
    .summary-card.low { border-left: 4px solid var(--low); }

    .summary-value {
      font-size: 2.5rem;
      font-weight: bold;
    }

    .summary-card.critical .summary-value { color: var(--critical); }
    .summary-card.high .summary-value { color: var(--high); }
    .summary-card.medium .summary-value { color: var(--medium); }
    .summary-card.low .summary-value { color: var(--low); }

    .violation {
      background: var(--bg-card);
      border-radius: 8px;
      margin-bottom: 1rem;
      border: 1px solid var(--border);
      overflow: hidden;
    }

    .violation-header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }

    .violation-body { padding: 1rem; }

    .severity-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .severity-badge.critical { background: var(--critical); color: white; }
    .severity-badge.high { background: var(--high); color: white; }
    .severity-badge.medium { background: var(--medium); color: black; }
    .severity-badge.low { background: var(--low); color: white; }

    .file-location {
      color: var(--text-secondary);
      font-family: monospace;
      font-size: 0.85rem;
    }

    .code-snippet {
      background: #0d1117;
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      font-family: 'Fira Code', monospace;
      font-size: 0.85rem;
      margin: 1rem 0;
      border: 1px solid var(--border);
    }

    .regulation-tag {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      background: rgba(139, 92, 246, 0.2);
      color: #a78bfa;
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .recommendation-box {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 4px;
      padding: 1rem;
      margin-top: 1rem;
    }

    .recommendation-title {
      color: #60a5fa;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .coverage-bar {
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin: 0.5rem 0;
    }

    .coverage-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .coverage-fill.compliant { background: var(--success); }
    .coverage-fill.partial { background: var(--medium); }
    .coverage-fill.non-compliant { background: var(--critical); }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }

    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: var(--bg-card);
      font-weight: 600;
    }

    footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-secondary);
      font-size: 0.85rem;
    }

    @media print {
      body { background: white; color: black; }
      .violation, .summary-card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Healthcare Compliance Report</h1>
      <p class="meta">${options.projectName}${options.companyName ? ` | ${options.companyName}` : ''}</p>
      <p class="meta">Generated: ${new Date(result.timestamp).toLocaleString()}</p>
      ${options.auditorName ? `<p class="meta">Auditor: ${options.auditorName}</p>` : ''}
    </header>

    <section class="score-section">
      <div class="score-gauge">
        <div class="score-value">${result.summary.complianceScore}</div>
        <div class="score-label">Compliance Score</div>
      </div>
    </section>

    <section>
      <h2>Executive Summary</h2>
      <div class="summary-grid">
        <div class="summary-card critical">
          <div class="summary-value">${result.summary.bySeverity.critical}</div>
          <div class="score-label">Critical</div>
        </div>
        <div class="summary-card high">
          <div class="summary-value">${result.summary.bySeverity.high}</div>
          <div class="score-label">High</div>
        </div>
        <div class="summary-card medium">
          <div class="summary-value">${result.summary.bySeverity.medium}</div>
          <div class="score-label">Medium</div>
        </div>
        <div class="summary-card low">
          <div class="summary-value">${result.summary.bySeverity.low}</div>
          <div class="score-label">Low</div>
        </div>
      </div>
      <p>Scanned ${result.summary.filesScanned} files in ${result.duration}ms. Found ${result.summary.totalViolations} total violations.</p>
    </section>

    ${options.includeRegulatoryCoverage ? this.generateHTMLCoverage() : ''}

    <section>
      <h2>Violations Detail</h2>
      ${result.violations.map(v => this.generateHTMLViolation(v)).join('\n')}
    </section>

    ${options.includeRecommendations ? this.generateHTMLRecommendations() : ''}

    <footer>
      <p>Generated by Code-to-Compliance Pipeline</p>
      <p>Scan ID: ${result.scanId}</p>
    </footer>
  </div>
</body>
</html>`;
  }

  private generateHTMLViolation(v: ComplianceViolation): string {
    return `
      <div class="violation">
        <div class="violation-header">
          <div>
            <span class="severity-badge ${v.severity}">${v.severity}</span>
            <strong style="margin-left: 0.5rem;">${v.ruleName}</strong>
          </div>
          <span class="file-location">${v.file}:${v.line}</span>
        </div>
        <div class="violation-body">
          <p>${v.message}</p>
          ${this.options.includeCodeSnippets ? `<pre class="code-snippet">${this.escapeHtml(v.codeSnippet)}</pre>` : ''}
          <div>
            ${v.regulations.map(r => `<span class="regulation-tag">${r.regulation} §${r.section}</span>`).join('')}
          </div>
          <div class="recommendation-box">
            <div class="recommendation-title">Recommendation</div>
            <p>${v.recommendation}</p>
          </div>
        </div>
      </div>`;
  }

  private getCoverageStatus(percentage: number): 'met' | 'partial' | 'unmet' {
    if (percentage >= 80) return 'met';
    if (percentage >= 50) return 'partial';
    return 'unmet';
  }

  private generateHTMLCoverage(): string {
    return `
      <section>
        <h2>Regulatory Coverage</h2>
        ${this.result.regulatoryCoverage.map(rc => `
          <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3>${rc.regulation}</h3>
              <span>${rc.coveragePercentage}% Coverage</span>
            </div>
            <div class="coverage-bar">
              <div class="coverage-fill ${this.getCoverageStatus(rc.coveragePercentage)}" style="width: ${rc.coveragePercentage}%;"></div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Issues</th>
                </tr>
              </thead>
              <tbody>
                ${rc.details.map(d => `
                  <tr>
                    <td>${d.section}</td>
                    <td>${d.status}</td>
                    <td>${d.findings.length}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `).join('')}
      </section>`;
  }

  private generateHTMLRecommendations(): string {
    return `
      <section>
        <h2>Remediation Recommendations</h2>
        ${this.result.recommendations.map((r, i) => `
          <div class="violation" style="margin-bottom: 1rem;">
            <div class="violation-header">
              <div>
                <span style="background: #8b5cf6; color: white; padding: 0.25rem 0.5rem; border-radius: 50%; margin-right: 0.5rem;">${r.priority}</span>
                <strong>${r.title}</strong>
              </div>
              <span class="severity-badge ${r.estimatedEffort === 'low' ? 'low' : r.estimatedEffort === 'medium' ? 'medium' : 'high'}">
                ${r.estimatedEffort} effort
              </span>
            </div>
            <div class="violation-body">
              <p>${r.description}</p>
              <h4 style="margin-top: 1rem;">Steps:</h4>
              <ol>
                ${r.steps.map(s => `<li>${s}</li>`).join('')}
              </ol>
              <p class="meta" style="margin-top: 0.5rem;">Affects ${r.affectedFiles.length} file(s)</p>
            </div>
          </div>
        `).join('')}
      </section>`;
  }

  // =========================================================================
  // SARIF FORMAT (for GitHub/IDE integration)
  // =========================================================================

  private generateSARIF(): string {
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'Code-to-Compliance Scanner',
              version: '1.0.0',
              informationUri: 'https://github.com/your-org/compliance-scanner',
              rules: this.result.violations.map(v => ({
                id: v.ruleId,
                name: v.ruleName,
                shortDescription: { text: v.message },
                fullDescription: { text: v.recommendation },
                defaultConfiguration: {
                  level: this.severityToSarifLevel(v.severity),
                },
                properties: {
                  category: v.category,
                  regulations: v.regulations.map(r => `${r.regulation} ${r.section}`),
                },
              })),
            },
          },
          results: this.result.violations.map(v => ({
            ruleId: v.ruleId,
            level: this.severityToSarifLevel(v.severity),
            message: { text: v.message },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: v.file },
                  region: {
                    startLine: v.line,
                    startColumn: v.column,
                    endLine: v.endLine || v.line,
                    endColumn: v.endColumn || v.column,
                  },
                },
              },
            ],
            fixes: v.suggestedFix
              ? [
                  {
                    description: { text: 'Apply recommended fix' },
                    artifactChanges: [
                      {
                        artifactLocation: { uri: v.file },
                        replacements: [
                          {
                            deletedRegion: {
                              startLine: v.line,
                              startColumn: v.column,
                            },
                            insertedContent: { text: v.suggestedFix },
                          },
                        ],
                      },
                    ],
                  },
                ]
              : undefined,
          })),
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  private severityToSarifLevel(severity: ComplianceSeverity): string {
    const map: Record<ComplianceSeverity, string> = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'note',
      info: 'none',
    };
    return map[severity];
  }

  // =========================================================================
  // MARKDOWN FORMAT
  // =========================================================================

  private generateMarkdown(): string {
    const { result, options } = this;

    let md = `# Healthcare Compliance Report

**Project:** ${options.projectName}
${options.companyName ? `**Organization:** ${options.companyName}` : ''}
**Generated:** ${new Date(result.timestamp).toLocaleString()}
**Scan ID:** ${result.scanId}

---

## Compliance Score: ${result.summary.complianceScore}/100

| Severity | Count |
|----------|-------|
| Critical | ${result.summary.bySeverity.critical} |
| High | ${result.summary.bySeverity.high} |
| Medium | ${result.summary.bySeverity.medium} |
| Low | ${result.summary.bySeverity.low} |

**Files Scanned:** ${result.summary.filesScanned}
**Total Violations:** ${result.summary.totalViolations}
**Scan Duration:** ${result.duration}ms

---

## Violations

`;

    // Group violations by severity
    const severities: ComplianceSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
    for (const severity of severities) {
      const violations = result.violations.filter(v => v.severity === severity);
      if (violations.length === 0) continue;

      md += `### ${severity.toUpperCase()} (${violations.length})\n\n`;

      for (const v of violations) {
        md += `#### ${v.ruleName}

- **File:** \`${v.file}:${v.line}\`
- **Rule ID:** ${v.ruleId}
- **Category:** ${v.category}
- **Regulations:** ${v.regulations.map(r => `${r.regulation} §${r.section}`).join(', ')}

${v.message}

`;

        if (options.includeCodeSnippets) {
          md += `\`\`\`
${v.codeSnippet}
\`\`\`

`;
        }

        md += `> **Recommendation:** ${v.recommendation}

---

`;
      }
    }

    if (options.includeRegulatoryCoverage && result.regulatoryCoverage.length > 0) {
      md += `## Regulatory Coverage

`;
      for (const rc of result.regulatoryCoverage) {
        md += `### ${rc.regulation} - ${rc.coveragePercentage}% Coverage

| Section | Status | Issues |
|---------|--------|--------|
`;
        for (const d of rc.details) {
          md += `| ${d.section} | ${d.status} | ${d.findings.length} |\n`;
        }
        md += '\n';
      }
    }

    if (options.includeRecommendations && result.recommendations.length > 0) {
      md += `## Remediation Recommendations

`;
      for (const r of result.recommendations) {
        md += `### ${r.priority}. ${r.title}

**Effort:** ${r.estimatedEffort}
**Affected Files:** ${r.affectedFiles.length}

${r.description}

**Steps:**
${r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

---

`;
      }
    }

    return md;
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private getScoreColor(score: number): string {
    if (score >= 90) return '#22c55e';
    if (score >= 70) return '#eab308';
    if (score >= 50) return '#f97316';
    return '#ef4444';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function generateReport(
  result: ComplianceScanResult,
  format: ReportFormat,
  options?: Partial<ReportOptions>
): string {
  const generator = new ComplianceReportGenerator(result, { ...options, format });
  return generator.generate();
}

export function generateHTMLReport(result: ComplianceScanResult, options?: Partial<ReportOptions>): string {
  return generateReport(result, 'html', options);
}

export function generateSARIFReport(result: ComplianceScanResult): string {
  return generateReport(result, 'sarif');
}

export function generateMarkdownReport(result: ComplianceScanResult, options?: Partial<ReportOptions>): string {
  return generateReport(result, 'markdown', options);
}
