import { NextRequest, NextResponse } from 'next/server';
import { resolveProjectPath } from '@/lib/project-path-resolver';
import * as fs from 'fs/promises';
import * as path from 'path';

interface Journey {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  steps?: string[];
}

interface TestCase {
  id: string;
  title: string;
  description: string;
  steps: string[];
  expectedResult: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  linkedBugId?: string;
  category: string;
  journeyId?: string;
}

/**
 * Load journeys from project's checkpoint/journey files
 */
async function loadJourneys(projectDir: string): Promise<Journey[]> {
  const journeys: Journey[] = [];

  // Check for journeys in various locations
  const searchPaths = [
    'checkpoints/journeys.json',
    '.checkpoints/journeys.json',
    'docs/journeys.json',
    'journeys.json',
  ];

  for (const searchPath of searchPaths) {
    try {
      const fullPath = path.join(projectDir, searchPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        journeys.push(...data);
      } else if (data.journeys && Array.isArray(data.journeys)) {
        journeys.push(...data.journeys);
      }
      break; // Found journeys, stop searching
    } catch {
      // File doesn't exist or can't be parsed
    }
  }

  // Also check for architecture plans with journeys
  try {
    const archPath = path.join(projectDir, '.checkpoints', 'architecture-plan.json');
    const content = await fs.readFile(archPath, 'utf-8');
    const plan = JSON.parse(content);

    if (plan.passes) {
      // Find Pass 7 (Journeys)
      const journeyPass = plan.passes.find((p: any) => p.name?.includes('Journeys') || p.passNumber === 7);
      if (journeyPass?.userJourneys) {
        for (const j of journeyPass.userJourneys) {
          journeys.push({
            id: j.id || `journey-${journeys.length + 1}`,
            title: j.name || j.title,
            description: j.description,
            acceptanceCriteria: j.acceptanceCriteria || [],
            steps: j.steps?.map((s: any) => typeof s === 'string' ? s : s.action || s.description) || [],
          });
        }
      }
    }
  } catch {
    // No architecture plan
  }

  return journeys;
}

/**
 * Generate test cases from journeys
 */
function generateTestCasesFromJourneys(journeys: Journey[]): TestCase[] {
  const testCases: TestCase[] = [];

  for (const journey of journeys) {
    // Create a main test case for the journey
    testCases.push({
      id: `tc-${journey.id}-main`,
      title: `Complete ${journey.title} flow`,
      description: journey.description || `Test the complete ${journey.title} user journey`,
      steps: journey.steps || ['Navigate to the feature', 'Complete the workflow', 'Verify the result'],
      expectedResult: 'User can complete the journey successfully',
      status: 'pending',
      category: 'User Journey',
      journeyId: journey.id,
    });

    // Create test cases from acceptance criteria
    if (journey.acceptanceCriteria) {
      journey.acceptanceCriteria.forEach((criterion, index) => {
        testCases.push({
          id: `tc-${journey.id}-ac${index + 1}`,
          title: criterion.length > 60 ? criterion.substring(0, 60) + '...' : criterion,
          description: criterion,
          steps: ['Perform the action described', 'Observe the result'],
          expectedResult: criterion,
          status: 'pending',
          category: 'Acceptance Criteria',
          journeyId: journey.id,
        });
      });
    }
  }

  // Add common test cases that apply to most apps
  const commonTestCases: TestCase[] = [
    {
      id: 'tc-common-responsive',
      title: 'Responsive design check',
      description: 'Verify the app works on different screen sizes',
      steps: [
        'Open the app in desktop view',
        'Resize to tablet size (768px)',
        'Resize to mobile size (375px)',
        'Check all elements are accessible',
      ],
      expectedResult: 'App is usable at all screen sizes',
      status: 'pending',
      category: 'UI/UX',
    },
    {
      id: 'tc-common-loading',
      title: 'Loading states',
      description: 'Verify loading indicators appear during data fetching',
      steps: [
        'Navigate to pages that load data',
        'Observe loading states',
        'Verify no blank screens during loading',
      ],
      expectedResult: 'Loading states are shown appropriately',
      status: 'pending',
      category: 'UI/UX',
    },
    {
      id: 'tc-common-error',
      title: 'Error handling',
      description: 'Verify errors are handled gracefully',
      steps: [
        'Try invalid inputs',
        'Try actions that might fail',
        'Check error messages are user-friendly',
      ],
      expectedResult: 'Errors are caught and displayed helpfully',
      status: 'pending',
      category: 'Error Handling',
    },
    {
      id: 'tc-common-navigation',
      title: 'Navigation flow',
      description: 'Verify all navigation links work correctly',
      steps: [
        'Click all navigation links',
        'Use browser back/forward',
        'Verify URLs are correct',
      ],
      expectedResult: 'Navigation works without errors',
      status: 'pending',
      category: 'Navigation',
    },
  ];

  return [...testCases, ...commonTestCases];
}

// GET: Load test cases (generate from journeys if needed)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Check for saved test cases first
    const testCasesPath = path.join(projectDir, '.uat', 'test-cases.json');
    try {
      const saved = await fs.readFile(testCasesPath, 'utf-8');
      const testCases = JSON.parse(saved);
      return NextResponse.json({ success: true, testCases, source: 'saved' });
    } catch {
      // No saved test cases, generate from journeys
    }

    // Load journeys and generate test cases
    const journeys = await loadJourneys(projectDir);
    const testCases = generateTestCasesFromJourneys(journeys);

    return NextResponse.json({
      success: true,
      testCases,
      source: 'generated',
      journeysFound: journeys.length,
    });
  } catch (error) {
    console.error('Test cases load error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load test cases' },
      { status: 500 }
    );
  }
}

// PUT: Update test case status
export async function PUT(request: NextRequest) {
  try {
    const { projectId, testCases } = await request.json();

    if (!projectId || !testCases) {
      return NextResponse.json({ error: 'Project ID and test cases required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Save test cases
    const uatDir = path.join(projectDir, '.uat');
    await fs.mkdir(uatDir, { recursive: true });

    const testCasesPath = path.join(uatDir, 'test-cases.json');
    await fs.writeFile(testCasesPath, JSON.stringify(testCases, null, 2));

    // Calculate stats
    const stats = {
      total: testCases.length,
      passed: testCases.filter((tc: TestCase) => tc.status === 'passed').length,
      failed: testCases.filter((tc: TestCase) => tc.status === 'failed').length,
      skipped: testCases.filter((tc: TestCase) => tc.status === 'skipped').length,
      pending: testCases.filter((tc: TestCase) => tc.status === 'pending').length,
    };

    return NextResponse.json({
      success: true,
      message: 'Test cases saved',
      stats,
    });
  } catch (error) {
    console.error('Test cases save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save test cases' },
      { status: 500 }
    );
  }
}
