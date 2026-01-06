/**
 * Agent Tool Definitions
 *
 * Extracted from multi-agent-service.ts for maintainability.
 * Contains tool definitions for each agent role.
 */

import type { AgentRole, Tool } from '../types';

/**
 * Get the tools available for a specific agent role
 */
export const getTools = (role: AgentRole): Tool[] => {
  // Product Owner uses standard Claude CLI tools (Read, Write) to manage .agile-stories.json
  // No custom tools needed - it reads/writes the JSON file directly
  if (role === 'product_owner') {
    return []; // PO uses built-in Write tool to create stories
  }

  const baseTools: Tool[] = [
    {
      name: 'read_file',
      description: 'Read the contents of a file',
      input_schema: {
        type: 'object' as const,
        properties: {
          path: { type: 'string', description: 'File path relative to working directory' },
        },
        required: ['path'],
      },
    },
    {
      name: 'list_files',
      description: 'List files matching a glob pattern',
      input_schema: {
        type: 'object' as const,
        properties: {
          pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'send_message',
      description: 'Send a message to other agents or the user. Use this to communicate progress, ask questions, or report findings.',
      input_schema: {
        type: 'object' as const,
        properties: {
          message: { type: 'string', description: 'The message content' },
          to: { type: 'string', enum: ['all', 'coder', 'tester', 'security', 'user'], description: 'Who to send the message to' },
        },
        required: ['message', 'to'],
      },
    },
    {
      name: 'complete_task',
      description: 'Mark the current task as completed',
      input_schema: {
        type: 'object' as const,
        properties: {
          task_id: { type: 'string', description: 'Task ID to complete' },
          result: { type: 'string', description: 'Summary of what was accomplished' },
        },
        required: ['task_id', 'result'],
      },
    },
    {
      name: 'list_tasks',
      description: 'List all user stories/tasks with their current status. Use this to find stories to work on.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];

  // Add write tools for coder and tester
  if (role === 'coder' || role === 'tester') {
    baseTools.push(
      {
        name: 'write_file',
        description: 'Write content to a file',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'File path relative to working directory' },
            content: { type: 'string', description: 'File content to write' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'edit_file',
        description: 'Edit a file by replacing content',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'File path' },
            old_content: { type: 'string', description: 'Content to find' },
            new_content: { type: 'string', description: 'Replacement content' },
          },
          required: ['path', 'old_content', 'new_content'],
        },
      },
      {
        name: 'scaffold_project',
        description: 'FAST project setup - Creates a Next.js project with TypeScript, Tailwind, and Jest in ~30 seconds instead of 10 minutes. Use this INSTEAD of create-next-app for new projects!',
        input_schema: {
          type: 'object' as const,
          properties: {
            project_name: { type: 'string', description: 'Optional project name (defaults to project ID)' },
          },
          required: [],
        },
      },
      {
        name: 'run_command',
        description: 'Execute a shell command',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
          },
          required: ['command'],
        },
      },
      {
        name: 'start_story',
        description: 'Claim a story and mark it as in-progress. MUST call this BEFORE implementing a story!',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID to start working on' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'mark_ready_for_testing',
        description: 'Mark a story as ready for testing. ⚠️ ONLY call this AFTER running "./node_modules/.bin/tsc --noEmit" and fixing all TypeScript errors! Do NOT run npm run build - testers handle that.',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID to mark as ready for testing' },
          },
          required: ['task_id'],
        },
      },
      // =============================================================================
      // Quality Assurance Tools - Fast validation before expensive builds
      // =============================================================================
      {
        name: 'validate_code',
        description: 'FAST quality check - runs TypeScript type checking AND ESLint in ~5 seconds. Use this to catch errors quickly! Returns type errors and lint issues.',
        input_schema: {
          type: 'object' as const,
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional specific files to check. If empty, checks all TypeScript files.'
            },
            fix: {
              type: 'boolean',
              description: 'Auto-fix lint issues that can be fixed automatically (default: false)'
            },
          },
          required: [],
        },
      },
      {
        name: 'format_code',
        description: 'Format code with Prettier for consistent style. Use after writing code to ensure consistent formatting across the codebase. Can format specific files or the entire project.',
        input_schema: {
          type: 'object' as const,
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific files to format. If empty, formats all supported files.'
            },
            check_only: {
              type: 'boolean',
              description: 'Only check if files are formatted, do not modify (default: false)'
            },
          },
          required: [],
        },
      },
      {
        name: 'fix_lint',
        description: 'Auto-fix ESLint issues. Fixes all auto-fixable problems like unused imports, missing semicolons, formatting issues, etc. Much faster than manual fixes!',
        input_schema: {
          type: 'object' as const,
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific files to fix. If empty, fixes all TypeScript/JavaScript files.'
            },
          },
          required: [],
        },
      },
      {
        name: 'pre_build_check',
        description: 'Run ALL quality checks: TypeScript type check, ESLint, and Prettier format check. This catches ~80% of errors in ~10 seconds. Use this OR "./node_modules/.bin/tsc --noEmit" before marking stories as testing.',
        input_schema: {
          type: 'object' as const,
          properties: {
            auto_fix: {
              type: 'boolean',
              description: 'Automatically fix lint and format issues before reporting (default: true)'
            },
          },
          required: [],
        },
      }
    );
  }

  // Security agent gets comprehensive security scanning tools (Insurance/SOC 2 focused)
  if (role === 'security') {
    baseTools.push(
      {
        name: 'security_scan',
        description: 'Run comprehensive security scan including SAST, secret detection, dependency analysis, and SOC 2/NIST compliance checks. Returns detailed findings with severity, OWASP mapping, compliance references, and remediation steps.',
        input_schema: {
          type: 'object' as const,
          properties: {
            scan_type: {
              type: 'string',
              enum: ['all', 'sast', 'secrets', 'dependencies', 'soc2', 'nist'],
              description: 'Type of scan to run (default: all). Use "soc2" for SOC 2-focused scan or "nist" for NIST framework scan.',
            },
          },
          required: [],
        },
      },
      {
        name: 'report_vulnerability',
        description: 'Report a security vulnerability with SOC 2/NIST compliance context for insurance applications',
        input_schema: {
          type: 'object' as const,
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'], description: 'Severity level (consider PII/data breach risk)' },
            file: { type: 'string', description: 'File where vulnerability was found' },
            line: { type: 'number', description: 'Line number (approximate)' },
            vulnerability_type: { type: 'string', description: 'Type of vulnerability (e.g., PII Exposure, Unencrypted Data, Access Control Bypass)' },
            description: { type: 'string', description: 'Detailed description with insurance/PII context' },
            remediation: { type: 'string', description: 'Compliant remediation steps' },
            owasp: { type: 'string', description: 'OWASP Top 10 category (e.g., A01:2021, A03:2021)' },
            cwe: { type: 'string', description: 'CWE identifier if known (e.g., CWE-79)' },
            soc2_ref: { type: 'string', description: 'SOC 2 Trust Services Criteria reference (e.g., CC6.1 for access control, CC6.7 for transmission security)' },
            nist_ref: { type: 'string', description: 'NIST 800-53 control reference (e.g., PR.DS-1 for data-at-rest, PR.AC-1 for access control)' },
            pii_impact: { type: 'string', description: 'How this vulnerability could affect Personally Identifiable Information (PII)' },
            breach_risk: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Risk of this leading to a reportable data breach' },
          },
          required: ['severity', 'file', 'vulnerability_type', 'description', 'remediation'],
        },
      },
      {
        name: 'get_security_metrics',
        description: 'Get current security score, grade, OWASP compliance status, and SOC 2/NIST compliance summary',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_soc2_compliance',
        description: 'Get detailed SOC 2 Trust Services Criteria compliance status for this application',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_nist_compliance',
        description: 'Get NIST Cybersecurity Framework compliance status',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      }
    );
  }

  // Tester gets comprehensive testing tools
  if (role === 'tester') {
    baseTools.push(
      {
        name: 'start_testing',
        description: 'Claim a story for testing - MUST call this before writing tests for a story',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID to claim for testing' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'run_tests',
        description: 'Execute the test suite and get results. Returns pass/fail status and details.',
        input_schema: {
          type: 'object' as const,
          properties: {
            test_command: { type: 'string', description: 'Test command to run (default: npm test)', default: 'npm test' },
            test_file: { type: 'string', description: 'Optional specific test file to run' },
          },
          required: [],
        },
      },
      {
        name: 'get_story_acceptance_criteria',
        description: 'Get the acceptance criteria for a specific story to generate tests',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID' },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'report_test_results',
        description: 'Report test execution results for a story. MUST include test counts! If tests fail, the story will automatically be routed back to the Coder for fixes.',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID' },
            passed: { type: 'boolean', description: 'Whether all tests passed' },
            total_tests: { type: 'number', description: 'Total number of tests run (REQUIRED)' },
            passed_tests: { type: 'number', description: 'Number of passed tests (REQUIRED)' },
            failed_tests: { type: 'number', description: 'Number of failed tests (REQUIRED)' },
            summary: { type: 'string', description: 'Summary of test results' },
            error_output: { type: 'string', description: 'Full error output/stack trace from failed tests (include this when tests fail!)' },
            coverage: { type: 'number', description: 'Code coverage percentage (0-100) from test run' },
          },
          required: ['task_id', 'passed', 'total_tests', 'passed_tests', 'failed_tests', 'summary'],
        },
      },
      {
        name: 'report_setup_error',
        description: 'Report infrastructure/setup errors (npm errors, missing dependencies, build failures) that prevent testing. This skips testing and routes directly to coder for fixes.',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID (or "all" for project-wide issues)' },
            error_type: {
              type: 'string',
              enum: ['npm_error', 'build_error', 'missing_dependency', 'config_error', 'other'],
              description: 'Type of setup error'
            },
            error_message: { type: 'string', description: 'The error message from the failed command' },
            suggested_fix: { type: 'string', description: 'What you think needs to be fixed' },
          },
          required: ['error_type', 'error_message'],
        },
      },
      {
        name: 'skip_testing',
        description: 'Skip testing for a story and mark it as done. Use when tests cannot be run but the implementation looks correct, or when setup issues prevent testing.',
        input_schema: {
          type: 'object' as const,
          properties: {
            task_id: { type: 'string', description: 'Story/task ID' },
            reason: { type: 'string', description: 'Why testing is being skipped' },
          },
          required: ['task_id', 'reason'],
        },
      }
      // Note: complete_task is already in baseTools, no need to add it again
    );
  }

  // Coordinator gets task management tools
  if (role === 'coordinator') {
    baseTools.push(
      {
        name: 'create_task',
        description: 'Create a new task and assign it to an agent',
        input_schema: {
          type: 'object' as const,
          properties: {
            title: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Task description' },
            assigned_to: { type: 'string', enum: ['coder', 'tester', 'security'], description: 'Agent to assign task to' },
          },
          required: ['title', 'description', 'assigned_to'],
        },
      },
      {
        name: 'delegate_work',
        description: 'Delegate work to specific agents to run in parallel',
        input_schema: {
          type: 'object' as const,
          properties: {
            agents: {
              type: 'array',
              items: { type: 'string', enum: ['coder', 'tester', 'security'] },
              description: 'List of agents to activate',
            },
          },
          required: ['agents'],
        },
      }
    );
  }

  // Note: Product owner uses standard Claude CLI tools (Read, Write) to manage .agile-stories.json
  // No custom tools needed - the PO reads/writes the stories file directly

  // Fixer agent gets debugging and error resolution tools
  if (role === 'fixer') {
    baseTools.push(
      {
        name: 'write_file',
        description: 'Write content to a file (use for fixes)',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'File path relative to working directory' },
            content: { type: 'string', description: 'File content to write' },
          },
          required: ['path', 'content'],
        },
      },
      {
        name: 'edit_file',
        description: 'Edit a file by replacing content',
        input_schema: {
          type: 'object' as const,
          properties: {
            path: { type: 'string', description: 'File path' },
            old_content: { type: 'string', description: 'Content to find' },
            new_content: { type: 'string', description: 'Replacement content' },
          },
          required: ['path', 'old_content', 'new_content'],
        },
      },
      {
        name: 'run_command',
        description: 'Execute a shell command (npm install, npm run build, npm test, etc.)',
        input_schema: {
          type: 'object' as const,
          properties: {
            command: { type: 'string', description: 'Shell command to execute' },
          },
          required: ['command'],
        },
      },
      {
        name: 'get_error_logs',
        description: 'Get comprehensive error logs including: failed commands, build output, test failures, agent errors, and failed stories. ALWAYS call this first to understand what needs fixing.',
        input_schema: {
          type: 'object' as const,
          properties: {
            limit: { type: 'number', description: 'Maximum number of log entries to return (default: 50)' },
            include_warnings: { type: 'boolean', description: 'Include warnings in addition to errors (default: true)' },
          },
          required: [],
        },
      },
      {
        name: 'analyze_error',
        description: 'Analyze an error message and get suggestions for fixes',
        input_schema: {
          type: 'object' as const,
          properties: {
            error_message: { type: 'string', description: 'The error message or stack trace to analyze' },
            file_path: { type: 'string', description: 'Optional file path where error occurred' },
          },
          required: ['error_message'],
        },
      },
      {
        name: 'report_fix',
        description: 'Report what was fixed and how - use this when you have successfully fixed an issue',
        input_schema: {
          type: 'object' as const,
          properties: {
            issue: { type: 'string', description: 'Description of the issue that was found' },
            root_cause: { type: 'string', description: 'Root cause of the issue' },
            fix_applied: { type: 'string', description: 'What fix was applied' },
            files_modified: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of files that were modified'
            },
            verified: { type: 'boolean', description: 'Whether the fix was verified to work' },
          },
          required: ['issue', 'root_cause', 'fix_applied', 'verified'],
        },
      },
      {
        name: 'request_coder_help',
        description: 'Hand off a complex fix to the Coder agent. Creates a HIGH priority task in the backlog that the Coder will automatically pick up. Use this when: (1) Fix requires changes to multiple files, (2) Fix needs new features/logic, (3) Fix is beyond simple syntax/type corrections.',
        input_schema: {
          type: 'object' as const,
          properties: {
            issue: { type: 'string', description: 'Clear description of the error/issue' },
            suggested_fix: { type: 'string', description: 'Your analysis and suggested approach to fix it' },
            files_involved: {
              type: 'array',
              items: { type: 'string' },
              description: 'Files that need to be modified (if known)',
            },
            error_context: { type: 'string', description: 'The actual error message or stack trace' },
            create_task: { type: 'boolean', description: 'Whether to create a task in backlog (default: true)' },
          },
          required: ['issue', 'suggested_fix'],
        },
      },
      // QA Tools for verifying fixes
      {
        name: 'validate_code',
        description: 'FAST quality check - runs TypeScript type checking AND ESLint. Use AFTER making fixes to verify they work!',
        input_schema: {
          type: 'object' as const,
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional specific files to check. If empty, checks all TypeScript files.'
            },
            fix: {
              type: 'boolean',
              description: 'Auto-fix lint issues that can be fixed automatically (default: false)'
            },
          },
          required: [],
        },
      },
      {
        name: 'fix_lint',
        description: 'Auto-fix ESLint issues. Use this to quickly fix lint errors found during validation.',
        input_schema: {
          type: 'object' as const,
          properties: {
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific files to fix. If empty, fixes all TypeScript/JavaScript files.'
            },
          },
          required: [],
        },
      },
      {
        name: 'pre_build_check',
        description: 'Run ALL quality checks: TypeScript + ESLint + Prettier. Use this to verify a fix is complete before reporting.',
        input_schema: {
          type: 'object' as const,
          properties: {
            auto_fix: {
              type: 'boolean',
              description: 'Automatically fix lint and format issues (default: true)'
            },
          },
          required: [],
        },
      }
    );
  }

  // Researcher agent gets analysis and suggestion tools
  if (role === 'researcher') {
    baseTools.push(
      {
        name: 'suggest_enhancement',
        description: 'Suggest an enhancement or feature for the project. Each suggestion becomes a clickable button for the user.',
        input_schema: {
          type: 'object' as const,
          properties: {
            category: {
              type: 'string',
              enum: ['analytics', 'security', 'performance', 'ux', 'testing', 'features', 'architecture', 'documentation'],
              description: 'Category of the enhancement',
            },
            title: { type: 'string', description: 'Short, actionable title (max 50 chars)' },
            description: { type: 'string', description: 'What it does and why it matters (2-3 sentences)' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
            effort: { type: 'string', enum: ['small', 'medium', 'large'], description: 'Implementation effort' },
            impact: { type: 'string', description: 'What value/benefit it provides' },
            implementation_hint: { type: 'string', description: 'Brief technical approach or key files to modify' },
          },
          required: ['category', 'title', 'description', 'priority', 'effort', 'impact'],
        },
      },
      {
        name: 'analyze_dependencies',
        description: 'Analyze package.json dependencies and suggest improvements or missing packages',
        input_schema: {
          type: 'object' as const,
          properties: {},
          required: [],
        },
      },
      {
        name: 'complete_research',
        description: 'Call this when you have finished analyzing the project and submitted all suggestions',
        input_schema: {
          type: 'object' as const,
          properties: {
            summary: { type: 'string', description: 'Brief summary of findings' },
            total_suggestions: { type: 'number', description: 'Number of suggestions made' },
            top_priorities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Top 3 most important suggestions',
            },
          },
          required: ['summary', 'total_suggestions'],
        },
      }
    );
  }

  return baseTools;
};
