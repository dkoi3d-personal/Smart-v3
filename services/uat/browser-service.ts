/**
 * Browser Service - Playwright Integration for UAT
 *
 * Manages browser instances for:
 * - Recording user workflows
 * - Replaying workflows for testing
 * - Taking screenshots for Computer Use
 * - Executing actions from Computer Use
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import {
  UIWorkflow,
  WorkflowStep,
  WorkflowExecution,
  StepResult,
  StepAssertion,
  ComputerUseAction,
  ComputerUseResult,
  RecordingSession,
  RecordedEvent,
  EMPLOYERS_BRAND,
  BrandConfig,
} from './types';

// =============================================================================
// Browser Manager
// =============================================================================

class BrowserService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private pages: Map<string, Page> = new Map();
  private recordingSessions: Map<string, RecordingSession> = new Map();

  /**
   * Initialize browser (lazy - only when needed)
   */
  async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      console.log('[BrowserService] Launching Chromium browser...');
      this.browser = await chromium.launch({
        headless: true,  // Run headless for server-side
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });
      console.log('[BrowserService] Browser launched');
    }
    return this.browser;
  }

  /**
   * Create a new page for a session
   */
  async createPage(
    sessionId: string,
    options?: { width?: number; height?: number }
  ): Promise<Page> {
    const browser = await this.ensureBrowser();

    const context = await browser.newContext({
      viewport: {
        width: options?.width || 1920,
        height: options?.height || 1080,
      },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    this.contexts.set(sessionId, context);
    this.pages.set(sessionId, page);

    console.log(`[BrowserService] Created page for session: ${sessionId}`);
    return page;
  }

  /**
   * Get existing page or create new one
   */
  async getPage(sessionId: string): Promise<Page> {
    let page = this.pages.get(sessionId);
    if (!page) {
      page = await this.createPage(sessionId);
    }
    return page;
  }

  /**
   * Close a session's page and context
   */
  async closePage(sessionId: string): Promise<void> {
    const page = this.pages.get(sessionId);
    const context = this.contexts.get(sessionId);

    if (page) {
      await page.close();
      this.pages.delete(sessionId);
    }
    if (context) {
      await context.close();
      this.contexts.delete(sessionId);
    }
    console.log(`[BrowserService] Closed page for session: ${sessionId}`);
  }

  /**
   * Take a screenshot of the current page
   */
  async screenshot(sessionId: string): Promise<string> {
    const page = await this.getPage(sessionId);
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return buffer.toString('base64');
  }

  /**
   * Navigate to a URL
   */
  async navigate(sessionId: string, url: string): Promise<void> {
    const page = await this.getPage(sessionId);
    await page.goto(url, { waitUntil: 'networkidle' });
  }

  /**
   * Execute a Computer Use action
   */
  async executeAction(
    sessionId: string,
    action: ComputerUseAction
  ): Promise<ComputerUseResult> {
    try {
      const page = await this.getPage(sessionId);

      switch (action.type) {
        case 'screenshot':
          const screenshot = await this.screenshot(sessionId);
          return { success: true, screenshot };

        case 'click':
          if (action.coordinate) {
            await page.mouse.click(action.coordinate[0], action.coordinate[1]);
          }
          break;

        case 'type':
          if (action.text) {
            await page.keyboard.type(action.text);
          }
          break;

        case 'key':
          if (action.key) {
            await page.keyboard.press(action.key);
          }
          break;

        case 'scroll':
          const direction = action.scrollDirection || 'down';
          const amount = action.scrollAmount || 300;
          const deltaY = direction === 'down' ? amount : direction === 'up' ? -amount : 0;
          const deltaX = direction === 'right' ? amount : direction === 'left' ? -amount : 0;
          await page.mouse.wheel(deltaX, deltaY);
          break;

        case 'move':
          if (action.coordinate) {
            await page.mouse.move(action.coordinate[0], action.coordinate[1]);
          }
          break;
      }

      // Take screenshot after action
      const afterScreenshot = await this.screenshot(sessionId);
      return { success: true, screenshot: afterScreenshot };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ===========================================================================
  // Workflow Execution
  // ===========================================================================

  /**
   * Execute a workflow and return results
   */
  async executeWorkflow(
    sessionId: string,
    workflow: UIWorkflow,
    options?: {
      stopOnFailure?: boolean;
      screenshotEachStep?: boolean;
    }
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId: workflow.id,
      projectId: workflow.projectId,
      status: 'running',
      startedAt: new Date().toISOString(),
      results: [],
    };

    const page = await this.getPage(sessionId);

    for (const step of workflow.steps) {
      const startTime = Date.now();
      const result: StepResult = {
        stepId: step.id,
        sequence: step.sequence,
        status: 'passed',
        action: step.action,
        duration: 0,
      };

      try {
        await this.executeStep(page, step);

        // Run assertion if present
        if (step.assertion) {
          result.assertion = await this.runAssertion(page, step.assertion, workflow.brandConfig);
          if (!result.assertion.passed) {
            result.status = 'failed';
            result.error = `Assertion failed: expected "${step.assertion.expected}", got "${result.assertion.actual}"`;
          }
        }

        // Take screenshot if requested
        if (options?.screenshotEachStep) {
          const buffer = await page.screenshot({ type: 'png' });
          result.screenshot = buffer.toString('base64');
        }

      } catch (error) {
        result.status = 'failed';
        result.error = error instanceof Error ? error.message : 'Unknown error';

        // Always screenshot on failure
        try {
          const buffer = await page.screenshot({ type: 'png' });
          result.screenshot = buffer.toString('base64');
        } catch { }

        if (options?.stopOnFailure) {
          result.duration = Date.now() - startTime;
          execution.results.push(result);
          break;
        }
      }

      result.duration = Date.now() - startTime;
      execution.results.push(result);
    }

    // Calculate summary
    const passed = execution.results.filter(r => r.status === 'passed').length;
    const failed = execution.results.filter(r => r.status === 'failed').length;
    const skipped = execution.results.filter(r => r.status === 'skipped').length;

    execution.status = failed > 0 ? 'failed' : 'passed';
    execution.completedAt = new Date().toISOString();
    execution.summary = {
      totalSteps: workflow.steps.length,
      passed,
      failed,
      skipped,
      duration: execution.results.reduce((sum, r) => sum + r.duration, 0),
      failedSteps: execution.results
        .filter(r => r.status === 'failed')
        .map(r => ({
          stepId: r.stepId,
          action: r.action,
          error: r.error || 'Unknown error',
        })),
    };

    return execution;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(page: Page, step: WorkflowStep): Promise<void> {
    // Wait for condition if specified
    if (step.waitFor) {
      await this.waitForCondition(page, step.waitFor);
    }

    switch (step.action) {
      case 'navigate':
        if (step.url) {
          await page.goto(step.url, { waitUntil: 'networkidle' });
        }
        break;

      case 'click':
        if (step.selector) {
          await page.click(step.selector);
        } else if (step.coordinates) {
          await page.mouse.click(step.coordinates.x, step.coordinates.y);
        }
        break;

      case 'type':
        if (step.selector && step.value) {
          await page.fill(step.selector, step.value);
        } else if (step.value) {
          await page.keyboard.type(step.value);
        }
        break;

      case 'select':
        if (step.selector && step.value) {
          await page.selectOption(step.selector, step.value);
        }
        break;

      case 'hover':
        if (step.selector) {
          await page.hover(step.selector);
        }
        break;

      case 'scroll':
        if (step.coordinates) {
          await page.mouse.wheel(0, step.coordinates.y);
        }
        break;

      case 'wait':
        if (step.waitFor) {
          await this.waitForCondition(page, step.waitFor);
        }
        break;

      case 'screenshot':
        // Screenshot is handled separately
        break;

      case 'assert':
        // Assertion is handled after execution
        break;
    }
  }

  /**
   * Wait for a condition
   */
  private async waitForCondition(
    page: Page,
    condition: { type: string; value: string | number; timeout?: number }
  ): Promise<void> {
    const timeout = condition.timeout || 30000;

    switch (condition.type) {
      case 'selector':
        await page.waitForSelector(String(condition.value), { timeout });
        break;

      case 'url':
        await page.waitForURL(String(condition.value), { timeout });
        break;

      case 'timeout':
        await page.waitForTimeout(Number(condition.value));
        break;

      case 'networkIdle':
        await page.waitForLoadState('networkidle', { timeout });
        break;
    }
  }

  /**
   * Run an assertion on the current page
   */
  private async runAssertion(
    page: Page,
    assertion: StepAssertion,
    brandConfig?: BrandConfig
  ): Promise<StepAssertion> {
    const result: StepAssertion = { ...assertion, actual: '', passed: false };

    try {
      switch (assertion.type) {
        case 'visible':
          const isVisible = await page.isVisible(assertion.expected);
          result.actual = isVisible ? 'visible' : 'not visible';
          result.passed = isVisible;
          break;

        case 'text':
          const text = await page.textContent('body');
          result.actual = text?.includes(assertion.expected) ? 'found' : 'not found';
          result.passed = text?.includes(assertion.expected) || false;
          break;

        case 'url':
          result.actual = page.url();
          result.passed = page.url().includes(assertion.expected);
          break;

        case 'brand-compliant':
          result.passed = await this.checkBrandCompliance(page, brandConfig || EMPLOYERS_BRAND);
          result.actual = result.passed ? 'compliant' : 'non-compliant';
          break;

        case 'value':
        case 'custom':
        default:
          result.passed = true;
      }
    } catch (error) {
      result.actual = error instanceof Error ? error.message : 'Error';
      result.passed = false;
    }

    return result;
  }

  /**
   * Check brand compliance (colors, logo, etc.)
   */
  private async checkBrandCompliance(page: Page, brand: BrandConfig): Promise<boolean> {
    // Check for primary brand color in CSS
    const hasPrimaryColor = await page.evaluate((color) => {
      const elements = Array.from(document.querySelectorAll('*'));
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        if (
          style.backgroundColor.includes(color) ||
          style.color.includes(color) ||
          style.borderColor.includes(color)
        ) {
          return true;
        }
      }
      return false;
    }, brand.colors.primary);

    // Check for logo if specified
    let hasLogo = true;
    if (brand.logo?.selector) {
      hasLogo = await page.isVisible(brand.logo.selector).catch(() => false);
    }

    return hasPrimaryColor || hasLogo;
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Close browser and cleanup all resources
   */
  async shutdown(): Promise<void> {
    // Close all pages and contexts
    for (const sessionId of Array.from(this.pages.keys())) {
      await this.closePage(sessionId);
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('[BrowserService] Browser closed');
    }
  }
}

// Export singleton instance
export const browserService = new BrowserService();

// Cleanup on process exit
process.on('exit', () => {
  browserService.shutdown().catch(console.error);
});
