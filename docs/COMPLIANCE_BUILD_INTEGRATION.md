# Code-to-Compliance: Build Integration Guide

## How It Works in the Build Pipeline

The Code-to-Compliance Pipeline integrates into the existing multi-agent build workflow as a **compliance gate** that runs alongside the Security Agent.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AI DEV PLATFORM BUILD FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐
     │  User Input  │  "Build a patient portal with appointment scheduling"
     │ Requirements │
     └──────┬───────┘
            │
            ▼
     ┌──────────────┐
     │ Product Owner│  Creates epics & user stories
     │    Agent     │  → Epic: Patient Portal
     └──────┬───────┘  → Story: Login, Appointments, etc.
            │
            ▼
     ┌──────────────┐
     │   Coder(s)   │  Implements each story
     │    Agent     │  → Writes TypeScript, React, APIs
     └──────┬───────┘
            │
            ├─────────────────────────────┐
            │                             │
            ▼                             ▼
     ┌──────────────┐              ┌──────────────┐
     │    Tester    │              │   Security   │
     │    Agent     │              │    Agent     │
     │              │              │              │
     │ • Unit tests │              │ • OWASP scan │
     │ • E2E tests  │              │ • Secrets    │
     │ • Coverage   │              │ • Deps vuln  │
     └──────┬───────┘              └──────┬───────┘
            │                             │
            └─────────────┬───────────────┘
                          │
                          ▼
               ┌────────────────────┐
               │   COMPLIANCE GATE  │  ◄── NEW! Code-to-Compliance
               │                    │
               │ • HIPAA scanning   │
               │ • PHI detection    │
               │ • Audit logging    │
               │ • Encryption check │
               │ • Access control   │
               └────────┬───────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
      Score >= 70?            Score < 70?
            │                       │
            ▼                       ▼
     ┌──────────────┐        ┌──────────────┐
     │   DEPLOY     │        │    BLOCK     │
     │              │        │              │
     │ • Annotate   │        │ • Show report│
     │ • Report     │        │ • Fix issues │
     │ • Proceed    │        │ • Re-scan    │
     └──────────────┘        └──────────────┘
```

## Integration Points

### 1. Multi-Agent Service Integration

The Compliance Agent runs as part of the agent workflow in `multi-agent-service.ts`:

```typescript
// In services/multi-agent-service.ts

import { ComplianceScanner, generateHTMLReport } from '@/lib/compliance';

// Add compliance to agent roles
export type AgentRole = 'coder' | 'tester' | 'security' | 'compliance' | ...;

// Compliance agent runs after coder completes stories
async function runComplianceAgent(session: MultiAgentSession): Promise<ComplianceResult> {
  const scanner = new ComplianceScanner({
    regulations: ['HIPAA'],
    minSeverity: 'medium',
    autoAnnotate: true,
  });

  const result = await scanner.scan(session.workingDirectory, session.projectId);

  // Emit compliance results to dashboard
  this.emit('compliance:scan', {
    projectId: session.projectId,
    score: result.summary.complianceScore,
    violations: result.violations,
    recommendations: result.recommendations,
  });

  // Block build if critical violations
  if (result.summary.bySeverity.critical > 0) {
    throw new ComplianceError('Critical HIPAA violations detected', result);
  }

  return result;
}
```

### 2. Workflow Hook Points

```typescript
// Compliance integrates at these workflow points:

// POINT 1: After each story completion (real-time feedback)
coder.on('story:complete', async (story) => {
  const quickScan = await scanner.scanFiles(story.files);
  if (quickScan.violations.length > 0) {
    notifyAgent('coder', `⚠️ Compliance issues in ${story.title}`, quickScan.violations);
  }
});

// POINT 2: Before testing phase (gate check)
workflow.on('phase:testing', async () => {
  const result = await runComplianceAgent(session);
  if (result.summary.complianceScore < 70) {
    workflow.pause('Compliance score too low. Review violations.');
  }
});

// POINT 3: Before deployment (final gate)
workflow.on('phase:deploy', async () => {
  const finalScan = await runComplianceAgent(session);
  await generateAndSaveReport(finalScan);

  if (finalScan.summary.bySeverity.critical > 0) {
    workflow.abort('Cannot deploy with critical HIPAA violations');
  }
});
```

### 3. Dashboard Integration

The `ComplianceDashboard` component displays in the 8-panel grid:

```tsx
// In app/build/[projectId]/page.tsx

import { ComplianceDashboard } from '@/components/panels/ComplianceDashboard';

export default function BuildPage({ params }) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Existing panels */}
      <RequirementsPanel />
      <KanbanBoard />
      <CodeEditor />
      <LivePreview />
      <TestRunner />
      <SecurityScanner />

      {/* NEW: Compliance Dashboard */}
      <ComplianceDashboard
        projectId={params.projectId}
        projectPath={projectPath}
        autoRefresh={true}
        refreshInterval={30000}
        onScanComplete={(result) => {
          if (result.complianceScore < 70) {
            showWarning('Compliance issues detected');
          }
        }}
      />

      <DeploymentStatus />
    </div>
  );
}
```

## Build Flow Examples

### Example 1: Clean Build (No Violations)

```
[14:32:01] 🎯 Product Owner: Created epic "Patient Portal"
[14:32:15] 📝 Product Owner: Created 4 user stories
[14:32:20] 💻 Coder: Starting "Project Setup"
[14:33:45] ✅ Coder: Completed "Project Setup"
[14:33:46] 🔍 Compliance: Quick scan - 0 violations
[14:33:50] 💻 Coder: Starting "Patient Login"
[14:35:20] ✅ Coder: Completed "Patient Login"
[14:35:21] 🔍 Compliance: Quick scan - 0 violations
[14:35:25] 💻 Coder: Starting "Appointment Booking"
[14:37:10] ✅ Coder: Completed "Appointment Booking"
[14:37:11] 🔍 Compliance: Quick scan - 0 violations
[14:37:15] 🧪 Tester: Running tests...
[14:38:00] ✅ Tester: All 24 tests passed
[14:38:01] 🔒 Security: Scanning for vulnerabilities...
[14:38:30] ✅ Security: No critical issues

[14:38:31] 🏥 COMPLIANCE GATE
           ┌─────────────────────────────────┐
           │  Score: 92/100 ✅               │
           │  Critical: 0  High: 0           │
           │  Medium: 2   Low: 3             │
           │                                 │
           │  HIPAA §164.312(a): ✅ Compliant│
           │  HIPAA §164.312(b): ✅ Compliant│
           │  HIPAA §164.312(e): ✅ Compliant│
           └─────────────────────────────────┘

[14:38:35] 📝 Compliance: Adding annotations to code
[14:38:40] 📊 Compliance: Generated HTML report
[14:38:45] 🚀 Deploying to AWS...
[14:40:00] ✅ Deployment complete!
```

### Example 2: Build with Violations (Blocked)

```
[14:32:01] 🎯 Product Owner: Created epic "Patient Records API"
[14:32:15] 📝 Product Owner: Created 3 user stories
[14:32:20] 💻 Coder: Starting "Project Setup"
[14:33:45] ✅ Coder: Completed "Project Setup"
[14:33:50] 💻 Coder: Starting "Patient CRUD API"
[14:35:20] ✅ Coder: Completed "Patient CRUD API"
[14:35:21] 🔍 Compliance: Quick scan...

           ⚠️ VIOLATION DETECTED
           ┌─────────────────────────────────────────┐
           │ 🔴 CRITICAL: PHI in Console Logs        │
           │                                         │
           │ File: app/api/patients/route.ts:45      │
           │ Code: console.log('Patient:', patient); │
           │                                         │
           │ HIPAA §164.312(b) - Audit Controls      │
           │                                         │
           │ Fix: Use audit logger with PHI redaction│
           └─────────────────────────────────────────┘

[14:35:25] 🛠️ Fixer: Attempting auto-fix...
[14:35:30] ✅ Fixer: Replaced console.log with auditLogger
[14:35:35] 🔍 Compliance: Re-scanning...
[14:35:40] ✅ Compliance: Violation resolved

[14:35:45] 💻 Coder: Starting "Patient Search"
[14:37:10] ✅ Coder: Completed "Patient Search"
[14:37:11] 🔍 Compliance: Quick scan...

           ⚠️ VIOLATION DETECTED
           ┌─────────────────────────────────────────┐
           │ 🔴 CRITICAL: PHI in URL Parameters      │
           │                                         │
           │ File: app/api/patients/search/route.ts  │
           │ Code: /api/patients?ssn=${patient.ssn}  │
           │                                         │
           │ HIPAA §164.312(e)(1) - Transmission     │
           │                                         │
           │ Fix: Use POST with encrypted body       │
           └─────────────────────────────────────────┘

[14:37:15] 🛠️ Fixer: Cannot auto-fix - requires manual review

[14:37:20] 🧪 Tester: Running tests...
[14:38:00] ✅ Tester: All 18 tests passed
[14:38:01] 🔒 Security: Scanning...
[14:38:30] ✅ Security: No critical issues

[14:38:31] 🏥 COMPLIANCE GATE
           ┌─────────────────────────────────────────┐
           │  Score: 45/100 ❌ BLOCKED               │
           │  Critical: 1  High: 2                   │
           │  Medium: 4   Low: 5                     │
           │                                         │
           │  HIPAA §164.312(a): ⚠️ Partial          │
           │  HIPAA §164.312(b): ❌ Non-compliant    │
           │  HIPAA §164.312(e): ❌ Non-compliant    │
           │                                         │
           │  ⛔ BUILD BLOCKED                       │
           │  1 critical violation must be resolved  │
           └─────────────────────────────────────────┘

[14:38:35] ⏸️ Workflow paused - awaiting manual fix
[14:38:36] 📧 Notification sent to team
```

## API Integration

### Triggering Compliance Scan via API

```bash
# Scan during build
POST /api/compliance/scan
{
  "projectId": "patient-portal-123",
  "projectPath": "/projects/patient-portal",
  "config": {
    "regulations": ["HIPAA"],
    "minSeverity": "medium"
  },
  "outputFormat": "full"
}

# Response
{
  "success": true,
  "scanId": "scan_abc123",
  "complianceScore": 85,
  "summary": {
    "totalViolations": 5,
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 2
  },
  "violations": [...],
  "recommendations": [...],
  "regulatoryCoverage": [...]
}
```

### Build Status API

```bash
# Check if build can proceed
GET /api/compliance/gate-check?projectId=patient-portal-123

# Response
{
  "canProceed": true,
  "score": 85,
  "criticalCount": 0,
  "mustFix": [],
  "shouldFix": [
    {
      "id": "HIPAA-AUD-001",
      "severity": "high",
      "description": "Missing audit log for patient access"
    }
  ]
}
```

## Compliance Agent Integration

The Compliance Agent (`.claude/agents/compliance.md`) can be called by the multi-agent orchestrator:

```typescript
// In multi-agent-service.ts

const COMPLIANCE_AGENT_TOOLS = [
  {
    name: 'compliance_scan',
    description: 'Scan code for HIPAA/healthcare compliance violations',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to scan' },
        regulations: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'add_compliance_annotations',
    description: 'Add compliance annotations to source files',
    input_schema: {
      type: 'object',
      properties: {
        file: { type: 'string' },
        annotations: { type: 'array' },
      },
    },
  },
  {
    name: 'generate_compliance_report',
    description: 'Generate compliance report in specified format',
    input_schema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['html', 'json', 'sarif', 'markdown'] },
      },
    },
  },
];
```

## Configuration

### Environment Variables

```env
# Compliance settings
COMPLIANCE_ENABLED=true
COMPLIANCE_MIN_SCORE=70
COMPLIANCE_BLOCK_ON_CRITICAL=true
COMPLIANCE_AUTO_ANNOTATE=true
COMPLIANCE_REGULATIONS=HIPAA,HITECH

# Report settings
COMPLIANCE_REPORT_FORMAT=html
COMPLIANCE_REPORT_PATH=./reports/compliance
```

### Project-Level Config

```json
// compliance.config.json
{
  "regulations": ["HIPAA", "HITECH"],
  "minScore": 70,
  "blockOnCritical": true,
  "autoAnnotate": true,
  "scanOnCommit": true,
  "exclude": [
    "**/node_modules/**",
    "**/*.test.ts",
    "**/fixtures/**"
  ],
  "customRules": [],
  "phiFields": [
    "ssn", "mrn", "dob", "diagnosis"
  ]
}
```

## Summary

The Code-to-Compliance Pipeline integrates into builds by:

1. **Real-time scanning** - Quick scans after each story completion
2. **Gate checking** - Full scan before testing/deployment phases
3. **Dashboard display** - Live compliance score in build UI
4. **Agent integration** - Works with existing multi-agent workflow
5. **Auto-fix support** - Fixer agent can resolve some violations
6. **Build blocking** - Prevents deployment of non-compliant code
7. **Report generation** - Creates audit-ready documentation
