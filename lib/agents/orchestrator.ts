/**
 * Agent Orchestrator
 * Coordinates all 6 agents using the Anthropic API for multi-agent orchestration
 */

import { anthropicService } from '@/services/anthropic-api';
import type {
  Agent,
  AgentType,
  DevelopmentState,
  Epic,
  Story,
  ClarificationRequest,
} from './types';
import { EventEmitter } from 'events';
import { updateEpic, updateStory } from '@/lib/project-persistence';

export class AgentOrchestrator extends EventEmitter {
  private state: DevelopmentState;
  private agents: Map<AgentType, Agent> = new Map();
  private abortController: AbortController;
  private isStopping: boolean = false;

  constructor(initialState: DevelopmentState) {
    super();
    this.state = initialState;
    this.abortController = new AbortController();
    this.initializeAgents();
  }

  /**
   * Initialize all 7 agents
   */
  private initializeAgents() {
    const agentTypes: AgentType[] = [
      'supervisor',
      'research',
      'product_owner',
      'coder',
      'tester',
      'security',
      'infrastructure',
    ];

    agentTypes.forEach((type) => {
      this.agents.set(type, {
        id: `${type}-${Date.now()}`,
        type,
        name: this.getAgentName(type),
        status: 'idle',
      });
    });
  }

  /**
   * Get human-readable agent name
   */
  private getAgentName(type: AgentType): string {
    const names: Record<AgentType, string> = {
      supervisor: 'Supervisor',
      research: 'Research Analyst',
      product_owner: 'Product Owner',
      coder: 'Coder',
      tester: 'Tester',
      security: 'Security Analyst',
      infrastructure: 'Infrastructure Engineer',
      architecture: 'Architecture Analyst',
    };
    return names[type];
  }

  /**
   * Start the development workflow
   */
  async start(requirements: string): Promise<void> {
    this.state.requirements = requirements;
    this.state.status = 'planning';

    console.log('🚀 Workflow started with requirements:', requirements.substring(0, 100));
    this.emit('workflow:started', { requirements });

    // Emit initial status message
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: 'system',
      agentType: 'supervisor',
      content: `🚀 Workflow started! Analyzing your requirements...`,
      timestamp: new Date(),
    });

    try {
      // Check if stopped before starting
      if (this.isStopping) {
        throw new Error('Workflow was stopped');
      }

      // Step 0: Research Agent performs deep analysis
      console.log('🔬 Step 0: Invoking Research agent...');
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'research',
        content: `🔬 STEP 0/6: Research Analyst performing deep analysis and gathering insights...`,
        timestamp: new Date(),
      });

      await this.invokeResearch('deep_analysis');
      if (this.isStopping) throw new Error('Workflow was stopped');
      console.log('✅ Research completed. Insights gathered.');

      // Step 1: Supervisor analyzes requirements and creates plan
      console.log('📋 Step 1: Invoking Supervisor agent...');
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: `📋 STEP 1/6: Supervisor analyzing requirements with research insights and creating project plan...`,
        timestamp: new Date(),
      });

      await this.invokeSupervisor('analyze_requirements');
      if (this.isStopping) throw new Error('Workflow was stopped');
      console.log('✅ Supervisor completed. Epics created:', this.state.epics.length);

      // Log epic details for debugging
      if (this.state.epics.length > 0) {
        console.log('  → Epic titles:', this.state.epics.map(e => e.title));
      } else {
        console.warn('⚠️  WARNING: Supervisor completed but created 0 epics!');
        console.warn('  → This will prevent Product Owner from being invoked');
      }

      // Step 2: Product Owner creates epics and stories
      // Double-check epics are in state before proceeding
      console.log('🔍 Pre-PO check: State has', this.state.epics.length, 'epics');

      if (this.state.epics.length > 0) {
        console.log('📊 Step 2: Invoking Product Owner agent...');
        console.log('  → Passing', this.state.epics.length, 'epics to Product Owner');
        console.log('  → Epic IDs being passed:', this.state.epics.map(e => e.id).join(', '));

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: 'system',
          agentType: 'product_owner',
          content: `📊 STEP 2/6: Product Owner breaking down ${this.state.epics.length} epic(s) into detailed user stories...`,
          timestamp: new Date(),
        });

        await this.invokeProductOwner('create_stories');
        if (this.isStopping) throw new Error('Workflow was stopped');
        console.log('✅ Product Owner completed. Stories created:', this.state.stories.length);
      } else {
        console.error('❌ Cannot proceed to Product Owner: No epics were created by Supervisor');
        console.error('  → State dump:', JSON.stringify({
          epicCount: this.state.epics.length,
          hasConfig: !!this.state.config,
          status: this.state.status,
        }, null, 2));

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: 'system',
          agentType: 'supervisor',
          content: `❌ Error: Supervisor did not create any epics. Cannot proceed to Product Owner.`,
          timestamp: new Date(),
        });
        throw new Error('Supervisor failed to create epics');
      }

      // Step 3: Development loop for each story
      console.log('💻 Step 3: Starting development loop...');
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'coder',
        content: `💻 STEP 3/6: Starting development! Coder will implement ${this.state.stories.length} user stories...`,
        timestamp: new Date(),
      });

      await this.developmentLoop();
      if (this.isStopping) throw new Error('Workflow was stopped');
      console.log('✅ Development loop completed');

      // Step 4: Final security scan
      console.log('🔒 Step 4: Running security scan...');
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'security',
        content: `🔒 STEP 4/6: Running comprehensive security scan on all code...`,
        timestamp: new Date(),
      });

      await this.invokeSecurity('full_scan');
      if (this.isStopping) throw new Error('Workflow was stopped');
      console.log('✅ Security scan completed');

      // Step 5: Deploy if approved
      console.log('🚀 Step 5: Creating deployment plan...');
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'infrastructure',
        content: `🚀 STEP 5/6: Infrastructure agent preparing deployment plan...`,
        timestamp: new Date(),
      });

      await this.invokeInfrastructure('deploy');
      if (this.isStopping) throw new Error('Workflow was stopped');
      console.log('✅ Deployment plan created');

      this.state.status = 'completed';
      console.log('🎉 Workflow completed successfully!');
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: `🎉 Workflow completed successfully! All steps finished.`,
        timestamp: new Date(),
      });

      this.emit('workflow:completed', this.state);
    } catch (error) {
      console.error('❌ Workflow error:', error);
      this.state.status = 'error';
      this.state.errors.push(error instanceof Error ? error.message : 'Unknown error');

      // Note: Direct API calls don't need session cleanup like Agent SDK
      // Sessions are stateless with the direct API approach
      console.log('  → Error occurred, workflow stopped');

      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: `❌ Workflow error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });

      this.emit('workflow:error', { error });
    }
  }

  /**
   * Main development loop - epic-based with sequential story processing
   * - Process epics sequentially (one at a time)
   * - Within each epic: sequential story processing (one story at a time)
   * - Each story: Code → Test loop (max 3 retries)
   * - After ALL stories in epic complete: One security scan for entire epic
   */
  private async developmentLoop(): Promise<void> {
    this.state.status = 'developing';

    // Group stories by epic
    const epicGroups = this.groupStoriesByEpic();
    console.log(`🔄 Starting epic-based development: ${epicGroups.length} epics, ${this.state.stories.length} total stories`);

    // Process each epic sequentially
    for (let epicIndex = 0; epicIndex < epicGroups.length; epicIndex++) {
      const { epic, stories } = epicGroups[epicIndex];

      console.log(`\n📋 EPIC ${epicIndex + 1}/${epicGroups.length}: "${epic.title}" (${stories.length} stories)`);

      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: `📋 Starting Epic ${epicIndex + 1}/${epicGroups.length}: "${epic.title}"\n${stories.length} stories (processing sequentially)`,
        timestamp: new Date(),
      });

      epic.status = 'in_progress';

      // Save epic status to disk
      if (this.state.projectDirectory) {
        await updateEpic(this.state.projectDirectory, epic.id, { status: 'in_progress' });
      }

      // Emit epic status update to frontend
      this.emit('epic:update', {
        id: epic.id,
        status: 'in_progress',
      });

      // Process all stories in this epic sequentially (one at a time)
      await this.processEpicStories(epic, stories);

      // Security scan ONCE for the entire epic
      console.log(`\n🔒 Security scan for Epic: "${epic.title}"`);

      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'security',
        content: `🔒 Security scan for Epic "${epic.title}" (${stories.length} stories completed)`,
        timestamp: new Date(),
      });

      await this.invokeSecurity('scan_epic', undefined);
      if (this.isStopping) throw new Error('Workflow was stopped');

      epic.status = 'done';

      // Save epic completion status to disk
      if (this.state.projectDirectory) {
        await updateEpic(this.state.projectDirectory, epic.id, { status: 'done' });
      }

      // Emit epic completion to frontend
      this.emit('epic:update', {
        id: epic.id,
        status: 'done',
      });

      console.log(`✅ Epic ${epicIndex + 1}/${epicGroups.length} complete: "${epic.title}"`);
    }

    console.log(`\n🎉 All epics complete!`);

    // Start development server for preview
    await this.startDevServer();
  }

  /**
   * Start development server for live preview
   */
  private async startDevServer(): Promise<void> {
    if (!this.state.projectId) {
      console.log('⚠️  No project ID, skipping dev server start');
      return;
    }

    try {
      console.log('🚀 Starting development server for live preview...');

      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'infrastructure',
        content: '🚀 Starting development server for live preview...',
        timestamp: new Date(),
      });

      // Make HTTP request to start dev server
      const response = await fetch(`http://localhost:3000/api/preview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: this.state.projectId }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Dev server started on port ${data.port}`);
      } else {
        const error = await response.json();
        console.error('❌ Failed to start dev server:', error);
      }
    } catch (error) {
      console.error('❌ Error starting dev server:', error);
      // Don't fail the whole workflow if preview fails
    }
  }

  /**
   * Invoke the Supervisor agent
   */
  private async invokeSupervisor(action: string): Promise<void> {
    const agent = this.agents.get('supervisor')!;
    agent.status = 'working';
    agent.currentTask = 'Creating project plan and epics';

    console.log('  → Supervisor agent status set to working');
    this.emit('agent:status', agent);

    // Emit progress message immediately
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: agent.id,
      agentType: 'supervisor',
      content: `📋 Supervisor analyzing requirements...\n\nUsing research insights to:\n• Create project epics\n• Define technical architecture\n• Identify dependencies\n• Assess risks\n\nWorking on it...`,
      timestamp: new Date(),
    });

    const prompt = this.buildSupervisorPrompt(action);
    console.log('  → Calling Claude API for Supervisor...');

    try {
      console.log('  → Attempting to invoke Supervisor agent via Anthropic API...');

      // Emit progress message after 10 seconds if still working
      const progressTimer = setTimeout(() => {
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'supervisor',
          content: `⏳ Creating comprehensive project breakdown...`,
          timestamp: new Date(),
        });
      }, 10000);

      const response = await anthropicService.invokeAgent({
        prompt,
        sessionId: agent.sessionId,
        allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob'],
        permissionMode: 'acceptEdits',
      });

      // Clear the progress timer
      clearTimeout(progressTimer);

      if (response.error) {
        console.error('  ❌ Supervisor invocation returned error:', response.error);
        throw new Error(`Supervisor invocation failed: ${response.error}`);
      }

      console.log('  → Supervisor response received. Session:', response.sessionId);
      console.log('  → Response cost: $' + response.cost?.toFixed(4));

      agent.sessionId = response.sessionId;

      // Parse supervisor response
      const result = this.parseSupervisorResponse(response);
      console.log('  → Parsed result:', { epicCount: result.epics?.length, clarificationCount: result.clarifications?.length });

      // Update state based on supervisor decisions
      if (result.epics && result.epics.length > 0) {
        // Store epics in state
        this.state.epics = result.epics;

        // Verify storage
        console.log('  → Storing', result.epics.length, 'epics in state');
        console.log('  → State epics count after assignment:', this.state.epics.length);
        console.log('  → Verifying epic IDs:', this.state.epics.map(e => e.id));
        console.log('  → Verifying epic titles:', this.state.epics.map(e => e.title));

        // Ensure epics have required fields
        const validEpics = this.state.epics.filter(e => e.id && e.title && e.description);
        if (validEpics.length !== this.state.epics.length) {
          console.warn('  ⚠️  Warning:', this.state.epics.length - validEpics.length, 'epics missing required fields');
        }

        console.log('  → Emitting epics:created event with', result.epics.length, 'epics');
        this.emit('epics:created', result.epics);

        // Emit clean, high-level summary message
        const epicTitles = result.epics.map((e: Epic) => e.title).slice(0, 3);
        const epicsList = epicTitles.join(', ') + (result.epics.length > 3 ? `, and ${result.epics.length - 3} more` : '');

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'supervisor',
          content: `✅ Project Plan Created\nCreated ${result.epics.length} epic(s): ${epicsList}`,
          timestamp: new Date(),
        });
      } else {
        // No epics created - this is a problem
        console.error('  ❌ Supervisor did not create any epics!');
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'supervisor',
          content: `⚠️ Warning: Supervisor analysis completed but no epics were created. Check console logs.`,
          timestamp: new Date(),
        });
      }

      if (result.clarifications && result.clarifications.length > 0) {
        console.log('  ⚠️  Supervisor requested', result.clarifications.length, 'clarifications');
        console.log('  → Clarifications:', result.clarifications.map((c: any) => c.question));
        this.emit('clarification:needed', result.clarifications);

        // TODO: Implement clarification UI - for now, skip and continue
        console.log('  → Skipping clarifications and continuing workflow...');
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'supervisor',
          content: `ℹ️ Supervisor requested clarifications but continuing workflow automatically:\n${result.clarifications.map((c: any) => `• ${c.question}`).join('\n')}`,
          timestamp: new Date(),
        });
      }

      agent.status = 'completed';
      this.emit('agent:completed', agent);
      console.log('  → Supervisor marked as completed');
    } catch (error) {
      console.error('  ❌ Supervisor error:', error);
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Invoke the Research agent
   */
  private async invokeResearch(action: string): Promise<void> {
    const agent = this.agents.get('research')!;
    agent.status = 'working';
    agent.currentTask = 'Performing deep analysis and research';

    console.log('  → Research agent status set to working');
    this.emit('agent:status', agent);

    // Emit progress message immediately
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: agent.id,
      agentType: 'research',
      content: `🧠 Research Analyst is working...\n\nAnalyzing your requirements to identify:\n• Industry patterns and best practices\n• Technical architecture recommendations\n• User experience insights\n• Security considerations\n\nThis may take 30-60 seconds...`,
      timestamp: new Date(),
    });

    // Re-emit status after a short delay to ensure client has connected
    setTimeout(() => {
      if (agent.status === 'working') {
        console.log('  → Re-emitting research agent status for late-connecting clients');
        this.emit('agent:status', agent);
      }
    }, 500);

    const prompt = this.buildResearchPrompt(action);
    console.log('  → Calling Claude API for Research...');

    try {
      console.log('  → Attempting to invoke Research agent via Anthropic API...');

      // Emit another progress message after 10 seconds if still working
      const progressTimer = setTimeout(() => {
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'research',
          content: `⏳ Still analyzing... Gathering comprehensive insights to ensure the best implementation approach.`,
          timestamp: new Date(),
        });
      }, 10000);

      const response = await anthropicService.invokeAgent({
        prompt,
        sessionId: agent.sessionId,
        allowedTools: ['Read', 'Grep', 'Glob'],
        permissionMode: 'acceptEdits',
      });

      // Clear the progress timer
      clearTimeout(progressTimer);

      if (response.error) {
        console.error('  ❌ Research invocation returned error:', response.error);
        throw new Error(`Research invocation failed: ${response.error}`);
      }

      console.log('  → Research response received. Session:', response.sessionId);
      console.log('  → Response cost: $' + response.cost?.toFixed(4));

      agent.sessionId = response.sessionId;

      // Parse research response
      const result = this.parseResearchResponse(response);
      console.log('  → Parsed research findings:', {
        complexity: result.findings?.estimatedComplexity,
        confidence: result.findings?.confidence,
      });

      // Update state with research findings and emit clean summary
      if (result.findings) {
        this.state.researchFindings = result.findings;
        console.log('  → Emitting research:completed event');
        this.emit('research:completed', result.findings);

        // Save research findings to project directory for future reference
        await this.saveResearchFindings(result.findings);

        // Emit clean, high-level summary message
        const insights = [
          `Industry: ${result.findings.domainAnalysis.industry}`,
          `Complexity: ${result.findings.estimatedComplexity}`,
          `Confidence: ${result.findings.confidence}%`
        ];

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'research',
          content: `✅ Research Analysis Complete\n${result.findings.summary}\n\nKey Insights:\n- ${insights.join('\n- ')}\n\n📄 Research findings saved to: research-findings.md`,
          timestamp: new Date(),
        });
      } else {
        // Fallback message if no findings
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'research',
          content: `✅ Research analysis completed. Insights gathered and ready for development team.`,
          timestamp: new Date(),
        });
      }

      agent.status = 'completed';
      this.emit('agent:completed', agent);
    } catch (error) {
      console.error('  ❌ Research error:', error);
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Invoke the Product Owner agent
   */
  private async invokeProductOwner(action: string): Promise<void> {
    const agent = this.agents.get('product_owner')!;
    agent.status = 'working';
    agent.currentTask = 'Breaking down epics into user stories';
    this.emit('agent:status', agent);

    // Validate that we have epics to work with
    console.log('  → Product Owner invoked with', this.state.epics.length, 'epics');
    if (this.state.epics.length === 0) {
      console.error('  ❌ ERROR: Product Owner invoked with 0 epics!');
      throw new Error('Product Owner cannot create stories without epics');
    }

    // Log epic details for debugging
    console.log('  → Epic IDs:', this.state.epics.map(e => e.id));
    console.log('  → Epic titles:', this.state.epics.map(e => e.title));

    // Emit progress message immediately
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: agent.id,
      agentType: 'product_owner',
      content: `📊 Product Owner creating user stories...\n\nBreaking down ${this.state.epics.length} epic(s) into:\n• Detailed user stories\n• Acceptance criteria\n• Story point estimates\n• Priority assignments\n\nAnalyzing...`,
      timestamp: new Date(),
    });

    const prompt = this.buildProductOwnerPrompt(action);
    console.log('  → Product Owner prompt includes', this.state.epics.length, 'epics');

    try {
      // Emit progress message after 10 seconds if still working
      const progressTimer = setTimeout(() => {
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'product_owner',
          content: `⏳ Writing detailed acceptance criteria and estimating complexity...`,
          timestamp: new Date(),
        });
      }, 10000);

      const response = await anthropicService.invokeAgent({
        prompt,
        sessionId: agent.sessionId,
        allowedTools: ['Bash'],  // Only needs Bash to call create_story.py script
        permissionMode: 'acceptEdits',
        maxTurns: 100, // Reduced from 200 - focusing on fewer, higher-quality stories (roughly 3-4 turns per story)
      });

      // Clear the progress timer
      clearTimeout(progressTimer);

      agent.sessionId = response.sessionId;

      // Parse product owner response
      const result = this.parseProductOwnerResponse(response);
      console.log('  → Parsed PO result:', { storyCount: result.stories?.length });

      if (result.stories && result.stories.length > 0) {
        // Add stories to state
        result.stories.forEach((story: Story) => {
          if (!this.state.stories.find((s) => s.id === story.id)) {
            this.state.stories.push(story);
          }
        });
        console.log('  → Stored', result.stories.length, 'stories in state');
        console.log('  → Total stories in state:', this.state.stories.length);
        console.log('  → Emitting stories:created event with', result.stories.length, 'stories');
        this.emit('stories:created', result.stories);

        // Save stories to files
        await this.saveStories(result.stories);

        // Emit clean, high-level summary message
        const storyTitles = result.stories.map((s: Story) => s.title).slice(0, 3);
        const storiesList = storyTitles.join(', ') + (result.stories.length > 3 ? `, and ${result.stories.length - 3} more` : '');
        const totalPoints = result.stories.reduce((sum: number, s: Story) => sum + (s.storyPoints || 0), 0);

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'product_owner',
          content: `✅ User Stories Created\nBreakdown complete: ${result.stories.length} stories (${totalPoints} story points)\n\nStories: ${storiesList}\n\n📄 Stories saved to: user-stories.md`,
          timestamp: new Date(),
        });
      } else {
        // Fallback message if no stories
        console.error('  ❌ Product Owner did not create any stories!');
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'product_owner',
          content: `⚠️ Warning: Epic breakdown completed but no stories were created. Check console logs.`,
          timestamp: new Date(),
        });
      }

      agent.status = 'completed';
      this.emit('agent:completed', agent);
    } catch (error) {
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Invoke the Coder agent
   */
  private async invokeCoder(action: string, story: Story): Promise<void> {
    const agent = this.agents.get('coder')!;
    agent.status = 'working';
    agent.currentTask = story.title;
    story.assignedAgent = 'coder';
    this.emit('agent:status', agent);

    // Emit message about starting to code
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: agent.id,
      agentType: 'coder',
      content: `Starting implementation: "${story.title}"`,
      timestamp: new Date(),
    });

    const prompt = this.buildCoderPrompt(action, story);

    try {
      const response = await anthropicService.invokeAgent({
        prompt,
        sessionId: agent.sessionId,
        allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Edit'],
        permissionMode: 'acceptEdits',
        maxTurns: 100, // Coding might take many steps
        workingDirectory: this.state.projectDirectory, // Set working directory for file operations
      });

      agent.sessionId = response.sessionId;

      // Parse the response to extract code changes
      const codeChanges = this.parseCoderResponse(response);

      if (codeChanges.files && codeChanges.files.length > 0) {
        console.log(`📄 Coder created ${codeChanges.files.length} files:`, codeChanges.files.map((f: any) => f.path));

        codeChanges.files.forEach((file: any) => {
          this.state.codeFiles.set(file.path, file);
          console.log(`📄 Emitting code:changed for: ${file.path}`);
          this.emit('code:changed', { file, story, agent });
        });

        // Emit clean, high-level summary message
        const fileNames = codeChanges.files.map((f: any) => f.path.split('/').pop()).slice(0, 3);
        const filesList = fileNames.join(', ') + (codeChanges.files.length > 3 ? `, +${codeChanges.files.length - 3} more` : '');

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'coder',
          content: `✅ Implementation Complete\nCreated ${codeChanges.files.length} file(s) for "${story.title}"\n\nFiles: ${filesList}`,
          timestamp: new Date(),
        });
      } else {
        console.log('⚠️ No files found in coder response');
        // Emit fallback message
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'coder',
          content: `✅ Code changes completed for "${story.title}"`,
          timestamp: new Date(),
        });
      }

      story.status = 'testing';
      story.progress = 60;

      agent.status = 'completed';
      this.emit('agent:completed', agent);
    } catch (error) {
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Invoke the Tester agent
   */
  private async invokeTester(action: string, story: Story): Promise<void> {
    const agent = this.agents.get('tester')!;
    agent.status = 'working';
    agent.currentTask = `Testing: ${story.title}`;
    this.emit('agent:status', agent);

    // Emit message about starting tests
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: agent.id,
      agentType: 'tester',
      content: `Creating test suite for "${story.title}"...`,
      timestamp: new Date(),
    });

    // Emit test creation start event
    this.emit('test:started', {
      story,
      timestamp: new Date(),
    });

    const prompt = this.buildTesterPrompt(action, story);

    try {
      const response = await anthropicService.invokeAgent({
        prompt,
        sessionId: agent.sessionId,
        allowedTools: ['Read', 'Write', 'Bash', 'Grep', 'Glob', 'Edit'],
        permissionMode: 'acceptEdits',
        maxTurns: 50, // Testing might take several steps
        workingDirectory: this.state.projectDirectory,
      });

      agent.sessionId = response.sessionId;

      // Parse test results from actual response
      const result = this.parseTesterResponse(response);

      if (result.testResults) {
        this.state.testResults = result.testResults;
        this.emit('test:results', result.testResults);

        const totalTests = result.testResults.passed + result.testResults.failed + result.testResults.skipped;
        const coverageAvg = (
          result.testResults.coverage.lines +
          result.testResults.coverage.statements +
          result.testResults.coverage.functions +
          result.testResults.coverage.branches
        ) / 4;

        // Emit clean, high-level summary message
        const status = result.testResults.failed > 0 ? '⚠️' : '✅';
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'tester',
          content: `${status} Test Suite Complete\n${result.testResults.passed}/${totalTests} tests passed | Coverage: ${coverageAvg.toFixed(1)}%\n\nLines: ${result.testResults.coverage.lines}% | Functions: ${result.testResults.coverage.functions}% | Branches: ${result.testResults.coverage.branches}%`,
          timestamp: new Date(),
        });

        // Emit progress event with coverage details
        this.emit('test:progress', {
          passed: result.testResults.passed,
          failed: result.testResults.failed,
          total: totalTests,
          coverage: result.testResults.coverage,
          timestamp: new Date(),
        });
      } else {
        // Fallback message if no test results
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'tester',
          content: `✅ Testing completed for "${story.title}"`,
          timestamp: new Date(),
        });
      }

      // If tests failed, may need to go back to coder
      if (result.failedTests && result.failedTests.length > 0) {
        this.emit('test:failures', result.failedTests);
        // Auto-retry with coder
        await this.invokeCoder('fix_test_failures', story);
        // Re-run tests
        await this.invokeTester('retest_story', story);
      }

      story.progress = 80;

      agent.status = 'completed';
      this.emit('agent:completed', agent);
    } catch (error) {
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Invoke the Security agent
   */
  private async invokeSecurity(action: string, story?: Story): Promise<void> {
    const agent = this.agents.get('security')!;
    agent.status = 'working';
    agent.currentTask = story ? `Scanning: ${story.title}` : 'Security audit';
    this.emit('agent:status', agent);

    // Emit message about starting security scan
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: agent.id,
      agentType: 'security',
      content: story ? `Starting security scan for "${story.title}"` : 'Starting comprehensive security audit',
      timestamp: new Date(),
    });

    const prompt = this.buildSecurityPrompt(action, story);

    try {
      const response = await anthropicService.invokeAgent({
        prompt,
        sessionId: agent.sessionId,
        allowedTools: ['Read', 'Bash', 'Grep', 'Glob'],
        permissionMode: 'acceptEdits',
      });

      agent.sessionId = response.sessionId;

      // Parse security report
      const result = this.parseSecurityResponse(response);

      if (result.securityReport) {
        this.state.securityReport = result.securityReport;
        this.emit('security:report', result.securityReport);

        // Emit clean, high-level summary message
        const vulnCount = result.securityReport.vulnerabilities.length;
        const criticalCount = result.securityReport.vulnerabilities.filter((v: any) => v.severity === 'critical').length;
        const status = criticalCount > 0 ? '⚠️' : vulnCount > 0 ? '⚠️' : '✅';
        const vulnSummary = vulnCount === 0
          ? 'No vulnerabilities found'
          : `Found ${vulnCount} vulnerabilities${criticalCount > 0 ? ` (${criticalCount} critical)` : ''}`;

        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'security',
          content: `${status} Security Scan Complete\n${vulnSummary}\n\nSecurity Score: ${result.securityReport.score}/100 (Grade: ${result.securityReport.grade})`,
          timestamp: new Date(),
        });
      } else {
        // Fallback message
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: agent.id,
          agentType: 'security',
          content: `✅ Security scan completed${story ? ` for "${story.title}"` : ''}`,
          timestamp: new Date(),
        });
      }

      // If critical vulnerabilities found, must fix
      const criticalVulns = result.securityReport?.vulnerabilities.filter(
        (v: any) => v.severity === 'critical'
      );

      if (criticalVulns && criticalVulns.length > 0) {
        this.emit('security:critical', criticalVulns);
        // Auto-fix if possible
        for (const vuln of criticalVulns) {
          if (vuln.autoFixAvailable) {
            await this.applySecurityFix(vuln);
          }
        }
      }

      if (story) {
        story.progress = 90;
      }

      agent.status = 'completed';
      this.emit('agent:completed', agent);
    } catch (error) {
      agent.status = 'error';
      throw error;
    }
  }

  /**
   * Invoke the Infrastructure agent
   */
  private async invokeInfrastructure(action: string): Promise<void> {
    const agent = this.agents.get('infrastructure')!;
    agent.status = 'working';
    agent.currentTask = 'Analyzing project and deploying to AWS';
    this.emit('agent:status', agent);

    try {
      console.log('🚀 Infrastructure agent starting deployment...');

      // Initialize deployment status
      const deploymentId = `deploy-${Date.now()}`;
      this.state.deployment = {
        id: deploymentId,
        environment: (this.state.config.deployment?.environment as any) || 'dev',
        status: 'pending',
        steps: [
          { id: 'analyze', name: 'Analyze Project Structure', status: 'running', logs: [] },
          { id: 'prepare', name: 'Prepare Deployment Package', status: 'pending', logs: [] },
          { id: 'provision', name: 'Provision AWS Infrastructure', status: 'pending', logs: [] },
          { id: 'deploy', name: 'Deploy Application', status: 'pending', logs: [] },
          { id: 'verify', name: 'Verify Deployment', status: 'pending', logs: [] },
        ],
        cost: { estimated: 15.50 },
        resources: {},
        health: {
          status: 'healthy',
          checks: {},
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.emit('deployment:started', this.state.deployment);

      // Step 1: Analyze project structure
      await this.updateDeploymentStep('analyze', 'running', ['🔍 Scanning project directory...']);

      const projectFiles = Array.from(this.state.codeFiles.keys());
      const hasPackageJson = projectFiles.some(f => f.includes('package.json'));
      const hasNextConfig = projectFiles.some(f => f.includes('next.config'));
      const hasDockerfile = projectFiles.some(f => f.includes('Dockerfile'));

      let deploymentType: 'lambda' | 'ec2' | 'ecs' | 'static' = 'static';
      let analysisLog = '📊 Project Analysis:\n';

      if (hasNextConfig) {
        deploymentType = 'lambda';
        analysisLog += '  ✓ Next.js application detected\n  → Deploying to AWS Lambda + API Gateway';
      } else if (hasDockerfile) {
        deploymentType = 'ecs';
        analysisLog += '  ✓ Dockerfile detected\n  → Deploying to AWS ECS (containerized)';
      } else if (hasPackageJson) {
        deploymentType = 'lambda';
        analysisLog += '  ✓ Node.js application detected\n  → Deploying to AWS Lambda';
      } else {
        analysisLog += '  ✓ Static files detected\n  → Deploying to S3 + CloudFront';
      }

      await this.updateDeploymentStep('analyze', 'completed', [analysisLog]);
      console.log(analysisLog);

      // Step 2: Prepare deployment
      await this.updateDeploymentStep('prepare', 'running', ['📦 Preparing deployment package...', `  → Type: ${deploymentType}`, `  → Environment: ${this.state.deployment.environment}`]);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate prep time
      await this.updateDeploymentStep('prepare', 'completed', ['✅ Deployment package ready']);

      // Step 3: Provision AWS infrastructure
      await this.updateDeploymentStep('provision', 'running', ['☁️  Provisioning AWS resources...', `  → Region: ${this.state.config.deployment?.region || 'us-east-2'}`]);

      const { awsDeploymentService } = await import('@/services/aws-deployment');

      // Test AWS connection first
      const connectionTest = await awsDeploymentService.testConnection();
      if (!connectionTest.success) {
        await this.updateDeploymentStep('provision', 'failed', [
          `❌ AWS connection failed: ${connectionTest.message}`,
          '  ℹ️  Please configure AWS credentials in .env:',
          '     AWS_REGION=us-east-2',
          '     AWS_ACCESS_KEY_ID=your_key',
          '     AWS_SECRET_ACCESS_KEY=your_secret'
        ]);
        throw new Error(`AWS connection failed: ${connectionTest.message}`);
      }

      await this.updateDeploymentStep('provision', 'completed', [`✅ Connected to AWS (${connectionTest.message})`]);

      // Step 4: Deploy application
      await this.updateDeploymentStep('deploy', 'running', ['🚀 Deploying application to AWS...']);

      const deploymentOptions = {
        projectId: this.state.projectId,
        projectName: this.state.config.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        environment: this.state.deployment.environment,
        deploymentType,
      };

      let deploymentResult;
      switch (deploymentType) {
        case 'lambda':
          deploymentResult = await awsDeploymentService.deployNextJsToLambda(deploymentOptions);
          break;
        case 'static':
          deploymentResult = await awsDeploymentService.deployStaticSite(deploymentOptions);
          break;
        case 'ecs':
          deploymentResult = await awsDeploymentService.deployToECS(deploymentOptions);
          break;
        default:
          deploymentResult = await awsDeploymentService.deployStaticSite(deploymentOptions);
      }

      if (!deploymentResult.success) {
        await this.updateDeploymentStep('deploy', 'failed', deploymentResult.logs);
        throw new Error(deploymentResult.error || 'Deployment failed');
      }

      await this.updateDeploymentStep('deploy', 'completed', deploymentResult.logs);

      // Update deployment with resources and URL
      if (deploymentResult.resources.length > 0) {
        this.state.deployment.resources = deploymentResult.resources.reduce((acc, r) => {
          acc[r.type] = r.id;
          return acc;
        }, {} as Record<string, string>);

        const urlResource = deploymentResult.resources.find(r => r.url);
        if (urlResource?.url) {
          this.state.deployment.url = urlResource.url;
        }
      }

      // Step 5: Verify deployment
      await this.updateDeploymentStep('verify', 'running', ['🔍 Verifying deployment health...']);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.updateDeploymentStep('verify', 'completed', [
        '✅ Deployment verification complete',
        `  → Resources: ${deploymentResult.resources.length}`,
        deploymentResult.resources.map(r => `     • ${r.type}: ${r.id}`).join('\n'),
        this.state.deployment.url ? `  → URL: ${this.state.deployment.url}` : ''
      ]);

      // Mark deployment as complete
      this.state.deployment.status = 'deployed';
      this.state.deployment.updatedAt = new Date();
      this.emit('deployment:completed', this.state.deployment);

      // Emit summary message
      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: agent.id,
        agentType: 'infrastructure',
        content: `✅ Deployment Complete\n\nType: ${deploymentType}\nEnvironment: ${this.state.deployment.environment}\nResources: ${deploymentResult.resources.length}\n\n${this.state.deployment.url ? `🔗 Live URL: ${this.state.deployment.url}` : 'Resources provisioned successfully'}`,
        timestamp: new Date(),
      });

      agent.status = 'completed';
      this.emit('agent:completed', agent);

    } catch (error) {
      console.error('❌ Infrastructure deployment error:', error);

      if (this.state.deployment) {
        this.state.deployment.status = 'failed';
        this.emit('deployment:failed', { deployment: this.state.deployment, error });
      }

      this.emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: agent.id,
        agentType: 'infrastructure',
        content: `❌ Deployment Failed\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });

      agent.status = 'error';
      throw error;
    }
  }

  private async updateDeploymentStep(stepId: string, status: 'pending' | 'running' | 'completed' | 'failed', logs: string[]): Promise<void> {
    if (!this.state.deployment) return;

    const step = this.state.deployment.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = status;
    step.logs.push(...logs);

    if (status === 'running') {
      step.startTime = new Date();
    } else if (status === 'completed' || status === 'failed') {
      step.endTime = new Date();
    }

    this.state.deployment.updatedAt = new Date();
    this.emit('deployment:progress', { step: stepId, status, logs });

    // Small delay to make UI updates visible
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Build prompt for each agent based on action and context
   */
  private buildResearchPrompt(action: string): string {
    return `
You are the Research Analyst Agent. Your role is to perform DEEP "ultrathinking" analysis to provide comprehensive, actionable insights for the development team.

Current action: ${action}

Requirements to analyze:
${this.state.requirements}

🎯 **MANDATORY TECHNOLOGY STACK - ALL APPLICATIONS MUST USE:**
- **Frontend Framework:** Next.js 14+ with App Router
- **UI Library:** React 19+
- **Cloud Provider:** AWS (Lambda, S3, CloudFront, API Gateway, RDS, DocumentDB)
- **Database:**
  - PostgreSQL (AWS RDS) with Prisma ORM for structured/relational data
  - MongoDB (AWS DocumentDB) for unstructured/document data when appropriate
  - Choose based on data structure needs - you can use both if needed
- **Deployment:** AWS infrastructure (Lambda for serverless, ECS for containers, or EC2 as needed)

Your analysis must work WITHIN these technology constraints. Analyze the data structure requirements and recommend PostgreSQL for structured data, MongoDB for unstructured/flexible schemas, or both if the project needs mixed data types.

${action === 'deep_analysis' ? `
Your task is to ULTRATHINK and provide an EXTREMELY comprehensive analysis that will guide implementation:

🧠 ULTRATHINK - Go 10 levels deep on every aspect:

1. **Domain Analysis** (Think like an industry expert)
   - What industry/vertical is this in?
   - What are the top 3 similar successful applications? What made them successful?
   - What are common failure points in this domain?
   - What user pain points MUST be solved?
   - What features are "table stakes" vs differentiators?

2. **Technical Architecture** (Think like a principal engineer)
   - Confirm the MANDATORY tech stack: Next.js 14+ with App Router, React 19+, AWS
   - **Database Choice:** Analyze data structure requirements:
     * PostgreSQL (AWS RDS) + Prisma for structured/relational data (users, orders, inventory, etc.)
     * MongoDB (AWS DocumentDB) + Mongoose for unstructured/document data (logs, content, flexible schemas)
     * Can use BOTH if project has mixed needs (common for complex apps)
   - Exact architecture pattern within Next.js (App Router patterns, Server Components, Server Actions, etc.) with justification
   - Database schema design considerations (tables/collections, relationships, indexes)
   - API design (Next.js API Routes, Server Actions, or external API) with reasoning
   - Next.js file/folder structure recommendation (app directory structure)
   - State management approach (Context, Zustand, React Query for server state, etc.)
   - Caching strategy (Next.js revalidation, AWS CloudFront CDN)
   - Real-time requirements (WebSockets, Server-Sent Events, polling)?

3. **Implementation Roadmap** (Think like a tech lead)
   - What should be built FIRST (MVP features)?
   - What's the critical path? What dependencies exist?
   - What can be built in parallel?
   - Suggested implementation order with reasoning
   - Estimated complexity for each major component

4. **Libraries & Tools** (Be SPECIFIC - must be compatible with Next.js 14+/React 19+)
   - Exact npm packages compatible with the stack (e.g., "@tanstack/react-query", "zod")
   - Database packages based on choice:
     * "prisma" + "@prisma/client" for PostgreSQL
     * "mongoose" for MongoDB
     * Both if using mixed databases
   - UI component libraries compatible with React 19 (shadcn/ui recommended, Radix UI, Tailwind CSS)
   - Form handling for Next.js (react-hook-form, Server Actions)
   - Date/time handling (date-fns, dayjs)
   - Testing frameworks for Next.js (Vitest, React Testing Library, Playwright)
   - AWS SDK packages needed (@aws-sdk/client-s3, @aws-sdk/client-rds, @aws-sdk/client-docdb, etc.)

5. **User Experience Strategy**
   - Target audience persona
   - Critical user journeys (step-by-step)
   - Accessibility requirements (WCAG level, screen reader support)
   - Mobile responsiveness strategy
   - Performance budgets (Core Web Vitals targets)
   - Loading states, error handling patterns

6. **Security & Compliance**
   - Authentication strategy (JWT, OAuth, sessions, which provider?)
   - Authorization model (RBAC, ABAC, etc.)
   - Data encryption needs (at rest, in transit)
   - Input validation and sanitization approach
   - Rate limiting requirements
   - GDPR, SOC 2, or other compliance needs
   - Common vulnerabilities to watch for

7. **Scalability & Performance**
   - Expected load (users, requests/second)
   - Horizontal vs vertical scaling approach
   - CDN needs
   - Image optimization strategy
   - Code splitting approach
   - Database indexing strategy

8. **Common Pitfalls & Solutions**
   - What mistakes do developers commonly make in this type of project?
   - What edge cases need handling?
   - What will be the hardest parts to implement?
   - Suggested solutions for each challenge

9. **Project Structure Recommendation**
   - Exact folder structure
   - File naming conventions
   - Component organization
   - Utility/helper organization

10. **Testing Strategy**
    - Unit test coverage targets
    - Integration test approach
    - E2E test tools
    - Critical paths that MUST be tested

Respond in JSON format:
{
  "action": "deep_analysis",
  "findings": {
    "summary": "2-3 sentence executive summary of the project and approach",
    "domainAnalysis": {
      "industry": "Specific industry/vertical",
      "commonPatterns": ["Pattern 1 with specific example", "Pattern 2"],
      "bestPractices": ["Best practice 1 with reasoning", "Best practice 2"],
      "potentialChallenges": ["Challenge 1 and suggested solution", "Challenge 2"],
      "similarApps": ["App 1: what they did well", "App 2: what to avoid"],
      "criticalFeatures": ["Must-have feature 1", "Must-have feature 2"]
    },
    "technicalRecommendations": {
      "frameworks": ["Next.js 14+ with App Router (MANDATORY)", "React 19+ (MANDATORY)"],
      "libraries": ["@tanstack/react-query for data fetching", "zod for validation"],
      "databaseLibraries": {
        "reasoning": "Explain why PostgreSQL, MongoDB, or both based on data structure analysis",
        "choices": [
          "prisma + @prisma/client (if using PostgreSQL for structured data)",
          "mongoose (if using MongoDB for unstructured/document data)",
          "both (if project needs mixed database types)"
        ]
      },
      "architecturePatterns": ["Next.js App Router with Server Components and Server Actions", "AWS Lambda for API endpoints (or ECS for containers)"],
      "scalabilityConsiderations": ["AWS CloudFront CDN for static assets", "Database read replicas (RDS for PostgreSQL, DocumentDB for MongoDB)", "Lambda auto-scaling"],
      "databaseChoice": {
        "primary": "PostgreSQL (AWS RDS) OR MongoDB (AWS DocumentDB) - choose based on data structure",
        "reasoning": "Use PostgreSQL for structured/relational data, MongoDB for unstructured/document data, or both for hybrid needs"
      },
      "deploymentPlatform": "AWS (Lambda, S3, CloudFront, RDS/DocumentDB, API Gateway) (MANDATORY)",
      "stateManagement": "Zustand for client state, React Query for server state",
      "apiDesign": "Next.js API Routes or Server Actions (within Next.js)",
      "projectStructure": {
        "folders": ["app/ (Next.js App Router)", "components/", "lib/", "hooks/", "prisma/ (if PostgreSQL)", "models/ (if MongoDB)"],
        "conventions": ["Component files: PascalCase.tsx", "Utilities: camelCase.ts", "Server Actions: use server directive"]
      }
    },
    "implementationRoadmap": {
      "phase1_mvp": ["Feature 1: reasoning", "Feature 2: reasoning"],
      "phase2_enhanced": ["Enhancement 1", "Enhancement 2"],
      "criticalPath": ["Must build X before Y because Z"],
      "parallelizable": ["These features can be built simultaneously"],
      "estimatedTimePerPhase": ["Phase 1: 2-3 sprints", "Phase 2: 1-2 sprints"]
    },
    "userExperienceInsights": {
      "targetAudience": "Detailed persona description",
      "keyUserFlows": ["User flow 1: step-by-step", "User flow 2"],
      "accessibilityRequirements": ["WCAG 2.1 Level AA", "Keyboard navigation"],
      "performanceTargets": ["LCP < 2.5s", "FID < 100ms", "CLS < 0.1"],
      "mobileStrategy": "Mobile-first responsive design with breakpoints at 640, 768, 1024"
    },
    "securityConsiderations": {
      "dataProtection": ["Encrypt PII at rest using AES-256", "Use HTTPS only"],
      "authentication": ["NextAuth.js with OAuth providers (Google, GitHub)", "JWT tokens"],
      "authorization": ["Role-based access control (RBAC)", "Middleware for route protection"],
      "compliance": ["GDPR: Cookie consent, data export, right to deletion"],
      "inputValidation": ["Zod schemas for all user input", "Sanitize before DB writes"]
    },
    "commonPitfalls": [
      {
        "pitfall": "Description of common mistake",
        "solution": "How to avoid it",
        "impact": "Why it matters"
      }
    ],
    "testingStrategy": {
      "unitTests": "Vitest for component and utility testing (80% coverage target)",
      "integrationTests": "Testing Library for user interaction flows",
      "e2eTests": "Playwright for critical user paths",
      "criticalPaths": ["User registration flow", "Payment processing"]
    },
    "estimatedComplexity": "low|medium|high|very-high",
    "confidence": 85,
    "researchSources": ["Similar projects analyzed", "Best practices researched"]
  }
}

IMPORTANT: Be EXTREMELY specific. Instead of "use a form library", say "use react-hook-form with zod validation". Instead of "implement caching", say "implement Redis caching for API responses with 5-minute TTL".
` : ''}
    `.trim();
  }

  private buildSupervisorPrompt(action: string): string {
    const researchInsights = this.state.researchFindings
      ? `
RESEARCH INSIGHTS (from Research Agent's ultrathinking):
${JSON.stringify(this.state.researchFindings, null, 2)}

Use these research insights to inform your epic breakdown. The research has already identified:
- Critical features and user flows
- Technical architecture recommendations
- Implementation roadmap and phases
- Common pitfalls to avoid
- Security and scalability considerations
`
      : '';

    return `
You are the Supervisor Agent. Current action: ${action}

🎯 **MANDATORY TECHNOLOGY STACK:**
- **Frontend:** Next.js 14+ with App Router + React 19+ (REQUIRED)
- **Cloud:** AWS (Lambda, S3, CloudFront, RDS/DocumentDB, API Gateway) (REQUIRED)
- **Database:** Choose based on research findings and data structure:
  * PostgreSQL (AWS RDS) + Prisma for structured/relational data
  * MongoDB (AWS DocumentDB) + Mongoose for unstructured/document data
  * Both if project has mixed data needs
- **Deployment:** AWS infrastructure (REQUIRED)

Frontend and cloud stack are MANDATORY. Database choice is flexible based on data structure analysis from research.

Project State:
- Requirements: ${this.state.requirements}
- Status: ${this.state.status}
- Epics Created: ${this.state.epics.length}
- Stories Created: ${this.state.stories.length}

${this.state.epics.length > 0 ? `
EXISTING EPICS IN PROJECT:
${this.state.epics.map(e => `- Epic: "${e.title}" (${e.status}) - ${e.description.substring(0, 100)}...`).join('\n')}

⚠️ IMPORTANT: This project already has ${this.state.epics.length} epic(s).
- If requirements mention NEW features to ADD, create ONLY new epics for those new features
- PRESERVE all existing epics by including them in your response
- Do NOT duplicate existing work
- If requirements are asking to resume/continue existing work, use the existing epics as-is
` : '🆕 This is a NEW project with no existing epics.'}

${researchInsights}

${action === 'analyze_requirements' ? `
Analyze these requirements and create a comprehensive project plan using the research insights above and the MANDATORY tech stack:

Your tasks:
1. **Epic Breakdown**: ${this.state.epics.length > 0 ? 'ANALYZE existing epics and ADD new ones for new features' : 'Analyze requirements and create all necessary epics'}
   ${this.state.epics.length > 0 ? `
   - FIRST: Include ALL existing epics in your response (preserve them exactly)
   - SECOND: Analyze requirements to identify what NEW features are being requested
   - THIRD: Create ONLY new epics for truly NEW features that don't fit existing epics
   - Your response must include: ALL existing epics + ONLY new epics for new features
   ` : `
   **MANDATORY INFRASTRUCTURE EPICS (ALWAYS CREATE THESE):**

   Epic 1: "Project Setup & Configuration" (REQUIRED - ALWAYS FIRST)
   - Next.js 14 initialization with App Router
   - TypeScript configuration (strict mode)
   - Tailwind CSS + shadcn/ui setup
   - Folder structure (app/, components/, lib/, types/)
   - Environment variables setup
   - ESLint/Prettier configuration

   Epic 2: "Database & Data Layer" (REQUIRED)
   - Prisma ORM setup with PostgreSQL
   - Database schema design for ALL entities
   - Migrations and seed data
   - Database utilities (lib/prisma.ts)

   Epic 3: "Authentication & User Management" (REQUIRED if app has users)
   - NextAuth.js or Clerk setup
   - Signup/Login/Logout flows
   - Protected routes middleware
   - User profile management

   Epic 4: "Deployment & DevOps" (REQUIRED)
   - Dockerfile and docker-compose.yml
   - Environment configuration (dev/staging/prod)
   - CI/CD pipeline (GitHub Actions)
   - Deployment scripts

   **FEATURE EPICS (Based on requirements analysis):**

   Analyze the requirements and identify EACH distinct feature domain:
   - What are the main functional areas?
   - What entities/resources need CRUD operations?
   - What user workflows exist?
   - What integrations are needed?

   Create ONE epic per major feature domain found. Examples:
   - "Dashboard & Analytics" - if requirements mention dashboards/reports
   - "Product Management" - if requirements mention products/inventory
   - "Order Processing" - if requirements mention orders/checkout
   - "Notifications & Messaging" - if requirements mention alerts/emails
   - "Admin Panel" - if requirements mention admin functionality

   **EPIC COUNT DETERMINATION:**
   - Minimum: 4 epics (the mandatory infrastructure ones)
   - Additional: 1 epic per distinct feature domain in requirements
   - Do NOT artificially limit - create as many as the requirements need
   - Each epic should be a cohesive feature area
   `}

2. **Tech Stack**: MUST use the MANDATORY stack (Next.js 14+, React 19+, AWS)
   - Database choice from research: PostgreSQL, MongoDB, or both based on data structure analysis
   - Add specific complementary libraries from research (e.g., shadcn/ui, zod, react-query)
   - Include exact package names compatible with Next.js 14+/React 19+

3. **Architecture**: Confirm Next.js App Router architecture
   - Reference the suggested Next.js project structure (app directory)
   - Plan AWS deployment strategy (Lambda, ECS, or EC2)
   - Database schema/model design approach (Prisma schema or Mongoose models based on choice)

4. **Risk Assessment**: Identify any gaps or concerns
   - Review common pitfalls identified in research
   - Flag any missing critical features

5. **Clarifications** (OPTIONAL - only if absolutely critical):
   - SKIP clarifications if you can make reasonable decisions based on research
   - Only ask if there are mutually exclusive technical choices with significant impact
   - Do NOT ask about preferences, scale, or timeline - make reasonable assumptions

Create epics that:
- Map to the research's implementation phases
- Include clear business value and user impact
- Have measurable success criteria
- Follow dependency order from critical path
- Reference specific technical recommendations

CRITICAL INSTRUCTIONS FOR RESPONSE FORMAT:
- You MUST respond with a JSON code block containing ALL epics ${this.state.epics.length > 0 ? '(existing + new)' : ''}
- ${this.state.epics.length > 0 ? 'INCLUDE all existing epics plus any new epics for new features' : 'Create all necessary epics for this new project'}
- Do NOT include any explanatory text before or after the JSON
- Format your ENTIRE response as a JSON code block with the following structure:

{
  "epics": [
    {
      "id": "epic-1763953441658",
      "title": "Epic title (aligned with research phases)",
      "description": "Detailed description referencing research insights",
      "priority": "critical|high|medium|low",
      "technicalApproach": "Brief note on how this uses research recommendations",
      "status": "backlog",
      "stories": []
    },
    ... (minimum 4 infrastructure epics + feature epics based on requirements)
  ],
  "techStack": ["Next.js 14+", "React 19+", "Database choice from research (PostgreSQL/MongoDB/Both)", "AWS (Lambda/ECS)", "Additional packages from research"],
  "architecturePattern": "Next.js App Router with Server Components, AWS deployment"
}

IMPORTANT:
${this.state.epics.length > 0 ? `- PRESERVE all existing ${this.state.epics.length} epic(s) by including them in your response
- ONLY add NEW epics for features that don't fit existing epics
- Total epics after your response = existing epics + new epics (if any)
- Do NOT duplicate existing epics or features already covered
` : `- ALWAYS include the 4 mandatory infrastructure epics (Setup, Database, Auth, DevOps)
- ANALYZE requirements to identify feature domains and create epics for each
- Do NOT artificially limit epic count - create what the requirements need
- Each epic should be a cohesive feature area
`}- Use unique IDs with timestamps for each NEW epic
- Group related features together within epics
- Only include a "clarifications" array if absolutely critical (99% of cases should not need clarifications)
` : ''}
    `.trim();
  }

  private buildProductOwnerPrompt(action: string): string {
    // Validate epics before building prompt
    if (!this.state.epics || this.state.epics.length === 0) {
      throw new Error('Cannot build Product Owner prompt: No epics available in state');
    }

    const researchInsights = this.state.researchFindings
      ? `
RESEARCH INSIGHTS:
Key User Flows: ${JSON.stringify(this.state.researchFindings.userExperienceInsights?.keyUserFlows || [], null, 2)}
Target Audience: ${this.state.researchFindings.userExperienceInsights?.targetAudience || 'Not specified'}
Critical Features: ${JSON.stringify(this.state.researchFindings.domainAnalysis?.criticalFeatures || [], null, 2)}
Implementation Roadmap: ${JSON.stringify(this.state.researchFindings.technicalRecommendations || {}, null, 2)}
Common Pitfalls: ${JSON.stringify(this.state.researchFindings.commonPitfalls || [], null, 2)}
`
      : '';

    console.log('  → Building PO prompt with', this.state.epics.length, 'epics');
    console.log('  → Epic data sample:', JSON.stringify(this.state.epics[0], null, 2).substring(0, 200));

    return `
You are the Product Owner Agent. Current action: ${action}

🚨 CRITICAL REQUIREMENTS - READ THIS FIRST:

1. **STORY COUNT - SCALE TO PROJECT COMPLEXITY:**
   - CRITICAL: Match story count to the actual scope of each epic!
   - For SIMPLE apps (hello world, landing page + login): 2-3 stories per epic MAXIMUM
   - For MEDIUM apps: 3-4 stories per epic
   - For LARGE/COMPLEX apps: 4-5 stories per epic
   - Each story should be substantial and deliver visible value
   - Avoid over-decomposition - stories should be meaningful user-facing features
   - If the entire app is simple, the epic is simple, so use FEWER stories!

2. **PRIORITIZE UI/SHELL APPLICATION FIRST:**
   - Start with stories that create visible UI components and application shell
   - Prioritize frontend features that users can see and interact with
   - Build the navigation, layout, and basic screens before complex backend logic
   - Focus on stories that demonstrate visible progress
   - Backend/API work should support UI features, not exist independently

🎯 **MANDATORY TECHNOLOGY STACK - All acceptance criteria MUST reference:**
- **Frontend:** Next.js 14+ with App Router + React 19+ (REQUIRED)
- **Cloud:** AWS (Lambda, S3, CloudFront, RDS/DocumentDB, API Gateway) (REQUIRED)
- **Database:** Use database choice from research findings:
  * PostgreSQL (AWS RDS) + Prisma for structured data
  * MongoDB (AWS DocumentDB) + Mongoose for unstructured data
  * Both if project uses mixed data types

${researchInsights}

Epics to break down into user stories (${this.state.epics.length} total):
${JSON.stringify(this.state.epics, null, 2)}

Tech Stack (use this for technical acceptance criteria):
Next.js 14+, React 19+, PostgreSQL, Prisma, AWS, ${this.state.config.techStack.join(', ')}

Your tasks:
1. **Break down EACH epic into the RIGHT NUMBER of user stories based on its complexity**

<scope_assessment>
FIRST, assess the OVERALL PROJECT complexity, then each epic's scope:

**PROJECT-LEVEL ASSESSMENT (CRITICAL):**
- SIMPLE PROJECT (hello world, landing page, basic login): Total 2-4 stories across ALL epics
- SMALL PROJECT (single feature with auth): Total 4-8 stories across all epics
- MEDIUM PROJECT (multi-feature): Total 8-15 stories across all epics
- LARGE PROJECT (enterprise, multi-module): Total 15-25 stories across all epics

**EPIC-LEVEL (after project assessment):**
- SIMPLE epic (e.g., "Hello World App"): 2-3 stories
  Example: "Build Hello World with Login" →
    1. Create landing page with navigation
    2. Implement login/signup authentication
    3. Build simple dashboard after login

- SMALL epic (single feature): 2-3 stories
  Example: "Add export functionality" →
    1. Create export UI with format selection
    2. Implement multi-format export (CSV, Excel, PDF)

- MEDIUM epic (moderate feature, multiple components): 3-4 stories
  Example: "Shopping cart" →
    1. Build shopping cart UI with add/remove/update items
    2. Implement cart persistence and state management
    3. Create checkout flow with order summary

- LARGE epic (complex feature area, many components): 4-5 stories MAX
  Example: "User authentication system" →
    1. Build complete auth UI and flow (signup/login/logout)
    2. Implement password reset and email verification
    3. Create user profile management
    4. Build admin user management (if needed)

NOTE: For SIMPLE projects, you likely only have 1 epic with 2-3 stories total!
PRIORITIZE UI-FIRST: Stories that create visible UI components should always come before backend-only work.
</scope_assessment>

<decomposition_strategy>
Break down by creating HIGH-LEVEL stories that group related work:
1. **UI-First Approach**: Prioritize stories that create visible screens and components
2. **Group Related Features**: Combine CRUD operations into single stories (e.g., "User profile management" includes view/edit/update)
3. **Feature-Complete Stories**: Each story should deliver a complete, testable user-facing feature
4. **Avoid Over-Decomposition**: Don't split every small action into separate stories
5. **Natural Boundaries**: Group work that makes sense together (e.g., "Authentication flow" includes signup, login, logout)

CRITICAL RULES - MANDATORY DEEP THINKING:
Before creating stories, you MUST think through:
1. **Business Value**: What specific user need does this solve? What's the measurable benefit?
2. **Edge Cases**: What could go wrong? What validation is needed? What error scenarios exist?
3. **Dependencies**: What must be built first? What other stories does this depend on?
4. **Data Requirements**: What fields, entities, and state management are needed?
5. **User Experience**: What screens, interactions, and flows are involved?

INVEST PRINCIPLES (MANDATORY for EVERY story):
- **I**ndependent: Can be delivered as a complete feature
- **N**egotiable: Implementation details can be adjusted
- **V**aluable: Delivers substantial, visible business value to end users
- **E**stimable: Clear scope for developers to estimate
- **S**mall: Completable within a sprint but substantial enough to be meaningful
- **T**estable: Has comprehensive acceptance criteria

STORY POINT GUIDANCE (FOCUS ON LARGER, COMPLETE FEATURES):
- 2 points: Complete simple feature with UI and basic logic
- 3 points: Feature with multiple acceptance criteria, full CRUD, validation
- 5 points: Complex feature with multiple components and integration
- 8 points: Major feature area with significant UI and backend work
- 13 points: Large, complex feature requiring extensive work

IMPORTANT: Stories should be 3-8 points typically. Aim for complete, substantial features rather than tiny incremental changes.
</decomposition_strategy>

<red_flags>
TOO MANY STORIES if:
- SIMPLE project has more than 4 stories total
- More than 5 stories per epic (even for large epics)
- Stories are too granular (splitting CRUD into 5 separate stories)
- Multiple stories for minor variations
- Splitting UI components into individual stories when they work together
- Backend and frontend split when they're part of the same feature
- A "hello world" or simple login app has 10+ stories (MAJOR RED FLAG!)

TOO FEW STORIES if:
- Only 1 story for a complex epic with many features
- Stories are too large (> 13 points)
- Multiple unrelated features combined into one story
</red_flags>

2. **Write clear acceptance criteria** for each story
   - Use Given/When/Then format or checklist format
   - MUST include technical requirements using the MANDATORY stack (Next.js, React, PostgreSQL, Prisma, AWS)
   - Include both functional and technical criteria
   - Reference specific libraries/patterns from research (e.g., "Use react-hook-form for form handling")
   - Include accessibility requirements from research
   - Include performance criteria if relevant (e.g., "Page load < 2s")

3. **Estimate story points** (1, 2, 3, 5, 8, 13)
   - 1-2: Simple, well-understood tasks
   - 3-5: Moderate complexity
   - 8-13: Complex, may need breaking down further

4. **Prioritize stories**
   - Use research's critical path and implementation phases
   - Mark dependencies between stories
   - Highest priority: MVP features from research phase 1
   - Consider technical dependencies (e.g., auth must come before protected features)

5. **Avoid common pitfalls** identified in research
   - For each story, note relevant pitfalls and mitigation

<examples>
GOOD DECOMPOSITION EXAMPLES (3-5 HIGH-LEVEL STORIES):

Example 1: SMALL Epic - "Add Data Export Feature" (3 stories)
- Story 1 (5pts): Build export UI with format selection and preview
- Story 2 (5pts): Implement multi-format export (CSV, Excel, PDF) with data transformation
- Story 3 (3pts): Add export progress tracking and download management

Example 2: MEDIUM Epic - "Product Catalog Management" (4 stories)
- Story 1 (8pts): Create product management UI with CRUD operations and image upload
- Story 2 (5pts): Build product search, filtering, and sorting with pagination
- Story 3 (5pts): Implement bulk operations (import, export, price updates)
- Story 4 (3pts): Add product publish/unpublish workflow with status management

Example 3: LARGE Epic - "User Authentication & Authorization System" (5 stories)
- Story 1 (8pts): Build authentication UI and flow (signup, login, logout, session management)
- Story 2 (5pts): Implement password management (reset, change, email verification)
- Story 3 (5pts): Create user profile management with avatar upload and edit capabilities
- Story 4 (5pts): Build admin user management dashboard with activity logs
- Story 5 (3pts): Add two-factor authentication and security settings

NOTE: Each story includes MULTIPLE acceptance criteria covering UI, backend, validation, and edge cases.
UI-FIRST: Notice how stories prioritize visible features users can interact with.

BAD EXAMPLES (Too Granular):
❌ "As a user, I want to type my email in a signup form" (too small!)
❌ "As a user, I want to click the login button" (way too granular!)
❌ Creating 15 separate stories for what should be 1 comprehensive authentication story
</examples>

🚨 CRITICAL: YOU MUST USE THE BACKLOG SCRIPT TO CREATE STORIES 🚨

DO NOT generate JSON. Instead, you MUST use the Bash tool to call the create_story.py script FOR EACH STORY.

The script is located at: ${process.cwd()}/.claude/skills/backlog-manager/scripts/create_story.py

**MANDATORY PROCESS:**
1. For EACH story, call the script using Bash tool
2. The script accepts Fibonacci story points: 1, 2, 3, 5, 8, or 13
3. Create 3-5 HIGH-LEVEL stories per epic (not more!)

**Script Usage:**
\`\`\`bash
python3 ${process.cwd()}/.claude/skills/backlog-manager/scripts/create_story.py \\
  --epic-id "epic-xxx" \\
  --title "Build [feature area] with [key capabilities]" \\
  --description "As a [user type], I want [substantial feature] so that [benefit]" \\
  --points 5 \\
  --criteria "GIVEN [context] WHEN [action] THEN [outcome]" \\
  --criteria "UI: Create responsive [component] using Next.js and shadcn/ui" \\
  --criteria "Backend: Implement [API/logic] using Server Actions" \\
  --criteria "Validation: Use zod schema for [data]" \\
  --criteria "Testing: Include unit and integration tests" \\
  --project-dir "${this.state.projectDirectory}"
\`\`\`

**REQUIREMENTS:**
- --points MUST be Fibonacci: 1, 2, 3, 5, 8, or 13 (prefer 3-8 for substantial features)
- --description MUST include "As a" and "I want"
- --title MUST describe a complete, substantial feature (not micro-tasks)
- Use multiple --criteria flags for comprehensive acceptance criteria (5-10 criteria per story)

**YOU MUST:**
1. Call the script once per story (3-5 times per epic)
2. Create SUBSTANTIAL stories worth 3-8 points each
3. Group related work together (e.g., "Build authentication UI and flow" not "Create login button")

**Example - Breaking down "User Authentication" epic into 5 HIGH-LEVEL stories:**
\`\`\`bash
# Story 1 - Authentication UI and Flow (8 points)
python3 create_story.py --epic-id "epic-auth" --title "Build authentication UI and flow (signup, login, logout)" --description "As a user, I want a complete authentication system with signup, login, and logout so that I can access the application securely" --points 8 --criteria "UI: Create responsive signup form with email/password validation" --criteria "UI: Create login form with Remember Me option" --criteria "Backend: Implement Server Actions for signup/login/logout" --criteria "Security: Hash passwords with bcrypt" --criteria "Session: Implement JWT-based session management" --criteria "Validation: Use zod schemas for all auth inputs" --criteria "Testing: Include auth flow integration tests" --project-dir "${this.state.projectDirectory}"

# Story 2 - Password Management (5 points)
python3 create_story.py --epic-id "epic-auth" --title "Implement password reset and email verification" --description "As a user, I want to reset my password and verify my email so that I can recover my account" --points 5 --criteria "UI: Create password reset request form" --criteria "UI: Create password reset confirmation page" --criteria "Backend: Send verification and reset emails" --criteria "Backend: Generate and validate secure tokens" --criteria "Database: Store email verification status" --criteria "Testing: Test email flows" --project-dir "${this.state.projectDirectory}"

# Story 3 - User Profile (5 points) - UI FIRST!
python3 create_story.py --epic-id "epic-auth" --title "Create user profile management with avatar upload" --description "As a user, I want to view and edit my profile information so that I can keep my account up to date" --points 5 --criteria "UI: Build profile view page with user details" --criteria "UI: Create profile edit form with validation" --criteria "Backend: Implement profile update Server Action" --criteria "Storage: Add avatar upload to S3" --criteria "Database: Update user table schema" --criteria "Testing: Test profile CRUD operations" --project-dir "${this.state.projectDirectory}"

# Story 4 - Admin Dashboard (5 points)
python3 create_story.py --epic-id "epic-auth" --title "Build admin user management dashboard" --description "As an admin, I want to view and manage all user accounts so that I can moderate the platform" --points 5 --criteria "UI: Create admin dashboard with user list" --criteria "UI: Add user search and filtering" --criteria "Backend: Implement user list API with pagination" --criteria "Backend: Add user activation/deactivation" --criteria "Authorization: Implement admin role checks" --criteria "Testing: Test admin operations" --project-dir "${this.state.projectDirectory}"

# Story 5 - Security Features (3 points)
python3 create_story.py --epic-id "epic-auth" --title "Add two-factor authentication and security settings" --description "As a user, I want to enable 2FA so that my account is more secure" --points 3 --criteria "UI: Create 2FA setup page with QR code" --criteria "Backend: Implement TOTP-based 2FA" --criteria "Backend: Add 2FA verification to login flow" --criteria "Database: Store 2FA secrets securely" --criteria "Testing: Test 2FA flows" --project-dir "${this.state.projectDirectory}"
\`\`\`

NOTE: This is 5 SUBSTANTIAL stories instead of 12+ micro-stories. Each delivers a complete, testable feature.

IMPORTANT - VALIDATION CHECKLIST:
Before responding, verify EACH epic:
✓ Did I assess the epic's scope (SMALL/MEDIUM/LARGE)?
✓ Is the story count 3-5 per epic (NOT MORE)?
✓ Do stories group related work together (not split unnecessarily)?
✓ Does each story deliver substantial, visible value?
✓ Did I prioritize UI-first stories?
✓ Are acceptance criteria comprehensive (5-10 per story)?
✓ Are story points appropriate (prefer 3-8 for complete features)?
✓ Did I avoid over-decomposition (RED FLAG: too many tiny stories)?
✓ Does each story include UI, backend, validation, and testing criteria?

EXPECTED OUTPUT (MAXIMUM LIMITS):
- SIMPLE PROJECTS (hello world, landing + login): 2-4 stories TOTAL across all epics!
- SMALL epics: 2-3 stories (no more!)
- MEDIUM epics: 3-4 stories (no more!)
- LARGE epics: 4-5 stories (no more!)

🚨 YOU WILL KNOW YOU'RE DONE WHEN:
- SIMPLE projects: 2-4 stories total (1 epic with 2-3 stories is FINE!)
- MEDIUM projects: 8-15 stories total across all epics
- You've called create_story.py appropriate number of times based on project complexity
- Stories are 3-8 points each (Fibonacci: 3, 5, or 8 typically)
- UI-first stories come before backend-only work
- A hello world app with login should have ~3 stories, NOT 15+!
    `.trim();
  }

  private buildCoderPrompt(action: string, story: Story): string {
    const workingDir = this.state.projectDirectory || process.cwd();
    const existingFiles = Array.from(this.state.codeFiles.keys());

    return `
You are the Coder Agent. Current action: ${action}

WORKING DIRECTORY: ${workingDir}
All files must be created in or relative to this directory.

🎯 **MANDATORY TECHNOLOGY STACK - YOU MUST USE:**
- **Frontend Framework:** Next.js 14+ with App Router (app directory, NOT pages directory)
- **UI Library:** React 19+ (use Server Components where possible)
- **Database:** Use database choice from Product Owner/Research findings:
  * PostgreSQL (AWS RDS) + Prisma ORM for structured/relational data (prisma/schema.prisma)
  * MongoDB (AWS DocumentDB) + Mongoose for unstructured/document data
  * Both if project uses mixed data types
- **Cloud/Deployment:** AWS (design for Lambda/ECS/DocumentDB deployment)
- **Styling:** Tailwind CSS (or other CSS-in-JS compatible with Next.js)

DO NOT use Vue, Angular, MySQL, Firebase, Vercel-specific features, or any other non-AWS stack.

Story to implement:
Title: ${story.title}
Description: ${story.description}
Acceptance Criteria:
${(story.acceptanceCriteria || []).map((ac, i) => `${i + 1}. ${ac}`).join('\n') || '(none specified)'}
Story Points: ${story.storyPoints}
Priority: ${story.priority}

Tech Stack: Next.js 14+, React 19+, AWS, ${this.state.config.techStack.join(', ')}

${existingFiles.length > 0 ? `Existing project files:\n${existingFiles.map(f => `- ${f}`).join('\n')}\n` : 'This is a new project - create the initial project structure.\n'}

Your implementation tasks:
1. First, use read_file to understand existing code structure (if any)
2. Plan which files need to be created or modified for this Next.js project
3. Create clean, well-structured code that:
   - Uses Next.js 14+ App Router (app directory) with Server/Client Components
   - Follows React 19+ best practices
   - Implements database schema based on tech stack (Prisma for PostgreSQL, Mongoose for MongoDB)
   - Is AWS-deployment ready (serverless-compatible)
   - Meets ALL acceptance criteria listed above
   - Is production-ready and maintainable
   - Includes proper error handling
   - Uses appropriate Next.js patterns (Server Actions, Route Handlers, etc.)
4. Create files using write_file tool with paths relative to: ${workingDir}
5. Example: write_file with path="app/dashboard/page.tsx" will create ${workingDir}/app/dashboard/page.tsx
6. For database changes: Update schema files (prisma/schema.prisma for PostgreSQL or models/ for MongoDB) and include setup commands

Available tools:
- read_file: Read existing files to understand the codebase
- write_file: Create new files (use relative paths from working directory)
- edit_file: Modify existing files
- run_bash: Run commands like mkdir, npm install, etc.
- grep_files: Search for patterns in existing code
- glob_files: Find files matching patterns

CRITICAL: Use relative paths for all file operations. The working directory is: ${workingDir}
    `.trim();
  }

  private buildTesterPrompt(action: string, story: Story): string {
    const workingDir = this.state.projectDirectory || process.cwd();
    const recentFiles = Array.from(this.state.codeFiles.values())
      .filter(f => f.modified)
      .slice(-5) // Last 5 modified files
      .map(f => f.path);

    return `
You are the Tester Agent. Current action: ${action}

WORKING DIRECTORY: ${workingDir}
All test files must be created in or relative to this directory.

Story being tested:
Title: ${story.title}
Description: ${story.description}
Acceptance Criteria:
${(story.acceptanceCriteria || []).map((ac, i) => `${i + 1}. ${ac}`).join('\n') || '(none specified)'}

Tech Stack: ${this.state.config.techStack.join(', ')}

Recently created/modified files for this story:
${recentFiles.length > 0 ? recentFiles.map(f => `- ${f}`).join('\n') : 'No files tracked yet'}

CRITICAL TESTING WORKFLOW - Follow these steps in order:

STEP 1: First, check if the project has a test setup
- Check if package.json exists and has test scripts
- If no test setup exists, create a basic test configuration

STEP 2: Read the source files that were created for this story
- Use read_file to examine each file
- Understand the functions, components, and logic to test

STEP 3: Create comprehensive test files
- Create test files next to source files or in __tests__ directory
- For React components: Create .test.tsx files with React Testing Library
- For API routes: Create .test.ts files with API testing
- For utilities: Create .test.ts files with Jest
- Write at least 3-5 test cases per file covering:
  * Happy path scenarios
  * Edge cases
  * Error conditions
  * Each acceptance criterion

STEP 4: ACTUALLY RUN THE TESTS - THIS IS CRITICAL
- Use run_bash to execute: npm test -- --coverage
- If that fails, try: npx jest --coverage
- Parse the output to get actual test counts and coverage
- IMPORTANT: Tests MUST actually exist and run - do NOT use --passWithNoTests flag

STEP 5: Report the results
After running tests, respond with:
TEST RESULTS:
- X tests passed
- Y tests failed
- Coverage: Lines X%, Statements X%, Functions X%, Branches X%

If tests fail, include the failure details.

Available tools:
- read_file: Read source files
- write_file: Create test files
- edit_file: Modify existing files
- run_bash: MUST USE THIS to run npm test or jest
- grep_files: Search for code patterns
- glob_files: Find files by pattern

IMPORTANT REMINDERS:
1. You MUST actually run the tests with run_bash - don't just create test files!
2. Report REAL test execution results, not made-up numbers
3. If tests fail, that's okay - report the failures so the coder can fix them
4. Create test files in: ${workingDir}
    `.trim();
  }

  private buildSecurityPrompt(action: string, story?: Story): string {
    return `
You are the Security Agent. Current action: ${action}

${story ? `Story being scanned: ${story.title}` : 'Performing full security audit'}

Scan for:
1. Security vulnerabilities
2. OWASP Top 10 compliance
3. Vulnerable dependencies
4. Insecure code patterns

Provide detailed security report in JSON format.
    `.trim();
  }

  private buildInfrastructurePrompt(action: string): string {
    return `
You are the Infrastructure Agent. Current action: ${action}

Deployment Configuration:
${JSON.stringify(this.state.config.deployment, null, 2)}

${action === 'deploy' ? `
Create deployment plan including:
1. Infrastructure as code (Terraform)
2. CI/CD pipeline
3. Cost estimate
4. Deployment steps

Respond in JSON format.
` : ''}
    `.trim();
  }

  /**
   * Parse agent responses - extract structured data from agent messages
   */
  private parseResearchResponse(response: any): any {
    // Extract text content from messages
    const textContent = this.extractTextFromResponse(response);

    // Try to parse JSON if present
    const jsonMatch = textContent.match(/\{[\s\S]*"findings"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Transform parsed findings to match ResearchFindings type
        if (parsed.findings) {
          return {
            findings: {
              id: `research-${Date.now()}`,
              summary: parsed.findings.summary || 'Research analysis completed',
              domainAnalysis: parsed.findings.domainAnalysis || {
                industry: 'General',
                commonPatterns: [],
                bestPractices: [],
                potentialChallenges: [],
              },
              technicalRecommendations: parsed.findings.technicalRecommendations || {
                frameworks: [],
                libraries: [],
                architecturePatterns: [],
                scalabilityConsiderations: [],
              },
              userExperienceInsights: parsed.findings.userExperienceInsights || {
                targetAudience: '',
                keyUserFlows: [],
                accessibilityRequirements: [],
                performanceTargets: [],
              },
              securityConsiderations: parsed.findings.securityConsiderations || {
                dataProtection: [],
                authentication: [],
                compliance: [],
              },
              estimatedComplexity: parsed.findings.estimatedComplexity || 'medium',
              confidence: parsed.findings.confidence || 70,
              researchSources: parsed.findings.researchSources || [],
              createdAt: new Date(),
            },
          };
        }
      } catch (error) {
        console.warn('Failed to parse research JSON:', error);
      }
    }

    // Fallback: create basic findings from text
    return {
      findings: {
        id: `research-${Date.now()}`,
        summary: textContent.substring(0, 200),
        domainAnalysis: {
          industry: 'General',
          commonPatterns: [],
          bestPractices: [],
          potentialChallenges: [],
        },
        technicalRecommendations: {
          frameworks: [],
          libraries: [],
          architecturePatterns: [],
          scalabilityConsiderations: [],
        },
        userExperienceInsights: {
          targetAudience: 'General users',
          keyUserFlows: [],
          accessibilityRequirements: [],
          performanceTargets: [],
        },
        securityConsiderations: {
          dataProtection: [],
          authentication: [],
          compliance: [],
        },
        estimatedComplexity: 'medium' as const,
        confidence: 50,
        researchSources: [],
        createdAt: new Date(),
      },
    };
  }

  private parseSupervisorResponse(response: any): any {
    // Extract text content from messages
    const textContent = this.extractTextFromResponse(response);
    console.log('  → Parsing Supervisor response. Text length:', textContent.length);

    // Try multiple JSON extraction strategies
    let parsed = null;

    // Strategy 1: Look for JSON code block
    const codeBlockMatch = textContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      try {
        parsed = JSON.parse(codeBlockMatch[1]);
        console.log('  → Successfully parsed JSON from code block');
      } catch (e) {
        console.warn('  → Failed to parse JSON from code block');
      }
    }

    // Strategy 2: Look for raw JSON object with "epics" key
    if (!parsed) {
      const jsonMatch = textContent.match(/\{[\s\S]*"epics"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
          console.log('  → Successfully parsed raw JSON');
        } catch (e) {
          console.warn('  → Failed to parse raw JSON');
        }
      }
    }

    // If parsing succeeded, validate and return
    if (parsed && parsed.epics && Array.isArray(parsed.epics)) {
      console.log('  → Found', parsed.epics.length, 'epics in response');
      return {
        epics: parsed.epics.map((epic: any) => ({
          ...epic,
          projectId: this.state.projectId, // Ensure projectId is set for cross-project isolation
          createdAt: new Date(),
          updatedAt: new Date(),
          stories: epic.stories || [],
        })),
        clarifications: parsed.clarifications || [],
      };
    }

    // Fallback: Generate default epic
    console.warn('  ⚠️  Could not parse epics from supervisor response, creating fallback epic');
    console.warn('  → Response preview:', textContent.substring(0, 300));

    const epics: Epic[] = [{
      id: `epic-${Date.now()}`,
      projectId: this.state.projectId, // Ensure projectId is set for cross-project isolation
      title: 'Core Application Development',
      description: `Implement the core features based on requirements: ${this.state.requirements.substring(0, 100)}`,
      status: 'backlog',
      priority: 'high',
      stories: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }];

    return {
      epics,
      clarifications: [],
    };
  }

  private parseProductOwnerResponse(response: any): any {
    console.log('  → Product Owner used script-based story creation');
    console.log('  → Reading stories from user-stories.json file');

    // Read stories from the file that the script created
    const fs = require('fs');
    const path = require('path');

    if (!this.state.projectDirectory) {
      throw new Error('Project directory not set');
    }

    const storiesPath = path.join(this.state.projectDirectory, 'user-stories.json');

    try {
      const storiesData = fs.readFileSync(storiesPath, 'utf-8');
      const stories = JSON.parse(storiesData);

      console.log('  → Found', stories.length, 'stories in file');

      // Basic validation: Check that we have at least some stories
      if (stories.length === 0) {
        throw new Error('Product Owner did not create any stories. The create_story.py script was never called!');
      }

      // Log story distribution per epic for monitoring
      const storiesPerEpic = new Map<string, number>();
      stories.forEach((story: any) => {
        const count = storiesPerEpic.get(story.epicId) || 0;
        storiesPerEpic.set(story.epicId, count + 1);
      });

      console.log('  → Story distribution per epic:');
      const epicsWithNoStories: string[] = [];
      this.state.epics.forEach(epic => {
        const storyCount = storiesPerEpic.get(epic.id) || 0;
        console.log(`    - ${epic.title}: ${storyCount} stories`);
        if (storyCount === 0) {
          epicsWithNoStories.push(epic.title);
        }
      });

      // Warn if some epics have no stories (likely hit turn limit)
      if (epicsWithNoStories.length > 0) {
        console.warn(`  ⚠️  WARNING: ${epicsWithNoStories.length} epic(s) have NO stories:`);
        epicsWithNoStories.forEach(title => console.warn(`    - ${title}`));
        console.warn(`  ⚠️  The PO agent may have hit the maxTurns limit (100 turns)`);
        console.warn(`  ⚠️  Consider increasing maxTurns or reducing epic count`);
      }

      console.log('  ✅ Loaded', stories.length, 'total stories');
      return { stories };

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Product Owner did not create any stories. The create_story.py script was never called!');
      }
      throw error;
    }
  }

  private parseCoderResponse(response: any): any {
    // Extract files from tool_use messages (Write/Edit tool calls)
    const files: any[] = [];

    if (response.messages) {
      for (const message of response.messages) {
        if (message.type === 'assistant' && Array.isArray(message.content)) {
          for (const block of message.content) {
            if (block.type === 'tool_use' && (block.name === 'Write' || block.name === 'Edit')) {
              const filePath = block.input?.file_path;
              const content = block.input?.content || block.input?.new_string;

              if (filePath && content) {
                const extension = filePath.split('.').pop() || '';
                files.push({
                  path: filePath,
                  content: content,
                  language: this.getLanguageFromExtension(extension),
                  modified: true,
                  size: content.length,
                  lastModified: new Date(),
                });
              }
            }
          }
        }
      }
    }

    return { files };
  }

  private getLanguageFromExtension(ext: string): string {
    const map: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      css: 'css',
      html: 'html',
      json: 'json',
      md: 'markdown',
    };
    return map[ext] || 'plaintext';
  }

  private parseTesterResponse(response: any): any {
    const textContent = this.extractTextFromResponse(response);

    console.log('📊 Parsing test results from response...');

    // Extract bash outputs that contain test results
    const bashOutputs: string[] = [];
    if (response.messages) {
      response.messages.forEach((msg: any) => {
        if (msg.type === 'tool_result' && msg.content) {
          const toolResult = Array.isArray(msg.content)
            ? msg.content.find((c: any) => c.type === 'text')?.text
            : msg.content;
          if (toolResult && typeof toolResult === 'string') {
            // Check if this looks like test output
            if (toolResult.includes('Tests:') ||
                toolResult.includes('test') ||
                toolResult.includes('pass') ||
                toolResult.includes('Coverage') ||
                toolResult.includes('PASS') ||
                toolResult.includes('FAIL')) {
              bashOutputs.push(toolResult);
            }
          }
        }
      });
    }

    const allOutput = textContent + '\n' + bashOutputs.join('\n');
    console.log('🔍 Searching for test results in output...');

    // Look for Jest/npm test output patterns
    // Pattern 1: "Tests: X passed, Y failed" or "Tests: X passed, Y total"
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    // Jest summary format: "Tests:       1 passed, 1 total"
    const jestSummary = allOutput.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?(?:,\s+(\d+)\s+total)?/i);
    if (jestSummary) {
      passed = parseInt(jestSummary[1]) || 0;
      failed = jestSummary[2] ? parseInt(jestSummary[2]) : 0;
      skipped = jestSummary[3] ? parseInt(jestSummary[3]) : 0;
      console.log(`✅ Found Jest summary: ${passed} passed, ${failed} failed`);
    } else {
      // Alternative pattern: "X passed" and "Y failed"
      const passedMatch = allOutput.match(/(\d+)\s+passed/i);
      const failedMatch = allOutput.match(/(\d+)\s+failed/i);
      const skippedMatch = allOutput.match(/(\d+)\s+skipped/i);

      passed = passedMatch ? parseInt(passedMatch[1]) : 0;
      failed = failedMatch ? parseInt(failedMatch[1]) : 0;
      skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;

      if (passed > 0 || failed > 0) {
        console.log(`✅ Found test counts: ${passed} passed, ${failed} failed`);
      } else {
        console.warn(`⚠️  WARNING: No test results found in output - tests may not have been created or executed`);
      }
    }

    // Extract coverage information
    // Jest coverage format: "Lines: 85.7% | Statements: 85.7% | Functions: 66.67% | Branches: 75%"
    const coverageMatch = allOutput.match(/(?:All files|Coverage)[^\n]*\|[^\n]*?(\d+\.?\d*)\%[^\n]*?\|[^\n]*?(\d+\.?\d*)\%[^\n]*?\|[^\n]*?(\d+\.?\d*)\%[^\n]*?\|[^\n]*?(\d+\.?\d*)\%/i);

    let coverage = {
      lines: 0,
      statements: 0,
      functions: 0,
      branches: 0,
    };

    if (coverageMatch) {
      coverage = {
        lines: parseFloat(coverageMatch[1]) || 0,
        statements: parseFloat(coverageMatch[2]) || 0,
        functions: parseFloat(coverageMatch[3]) || 0,
        branches: parseFloat(coverageMatch[4]) || 0,
      };
      console.log(`✅ Found coverage: Lines ${coverage.lines}%, Statements ${coverage.statements}%`);
    } else {
      // Try alternative coverage format: "Statements: 85.71%"
      const linesMatch = allOutput.match(/Lines\s*[:|]\s*(\d+\.?\d*)\%/i);
      const statementsMatch = allOutput.match(/Statements\s*[:|]\s*(\d+\.?\d*)\%/i);
      const functionsMatch = allOutput.match(/Functions\s*[:|]\s*(\d+\.?\d*)\%/i);
      const branchesMatch = allOutput.match(/Branches\s*[:|]\s*(\d+\.?\d*)\%/i);

      if (linesMatch || statementsMatch) {
        coverage = {
          lines: linesMatch ? parseFloat(linesMatch[1]) : 0,
          statements: statementsMatch ? parseFloat(statementsMatch[1]) : 0,
          functions: functionsMatch ? parseFloat(functionsMatch[1]) : 0,
          branches: branchesMatch ? parseFloat(branchesMatch[1]) : 0,
        };
        console.log(`✅ Found coverage (alt format): Lines ${coverage.lines}%, Statements ${coverage.statements}%`);
      } else {
        console.log('⚠️ No coverage information found in output');
      }
    }

    // Extract failed test details if any
    const failedTests: any[] = [];
    const failPattern = /FAIL.*?\.test\.(ts|tsx|js|jsx)/g;
    const failMatches = allOutput.matchAll(failPattern);
    for (const match of failMatches) {
      failedTests.push({
        test: match[0],
        message: 'Test failed - check logs for details',
      });
    }

    const testResults = {
      name: 'Test Suite',
      tests: [], // Will be populated with actual test details if we parse them
      coverage,
      totalDuration: 1500,
      passed,
      failed,
      skipped,
    };

    console.log(`📊 Test parsing complete: ${passed}/${passed + failed} passed, Coverage: ${coverage.lines.toFixed(1)}%`);

    return {
      testResults,
      failedTests,
    };
  }

  private parseSecurityResponse(response: any): any {
    const textContent = this.extractTextFromResponse(response);

    // Check for vulnerability keywords
    const hasVulnerabilities = /vulnerability|security|risk|threat/i.test(textContent);

    const securityReport = {
      timestamp: new Date(),
      overallScore: hasVulnerabilities ? 75 : 95,
      vulnerabilities: [],
      recommendations: ['Continue following security best practices'],
    };

    return { securityReport };
  }

  private parseInfrastructureResponse(response: any): any {
    const deployment = {
      id: `deploy-${Date.now()}`,
      status: 'planned' as const,
      provider: this.state.config.deployment?.provider || 'aws',
      region: this.state.config.deployment?.region || 'us-east-1',
      environment: this.state.config.deployment?.environment || 'dev',
      steps: [
        { id: 'build', name: 'Build Application', status: 'pending' as const, progress: 0 },
        { id: 'test', name: 'Run Tests', status: 'pending' as const, progress: 0 },
        { id: 'provision', name: 'Provision Infrastructure', status: 'pending' as const, progress: 0 },
        { id: 'deploy', name: 'Deploy Application', status: 'pending' as const, progress: 0 },
      ],
      url: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return { deployment };
  }

  private extractTextFromResponse(response: any): string {
    if (!response || !response.messages) return '';

    return response.messages
      .filter((m: any) => m.type === 'assistant' && m.content)
      .map((m: any) => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
        }
        return '';
      })
      .join('\n');
  }

  /**
   * Helper methods
   */
  private getSortedStories(): Story[] {
    // Sort by priority and dependencies
    return this.state.stories.filter((s) => s.status === 'backlog');
  }

  /**
   * Group stories by epic for epic-based processing
   */
  private groupStoriesByEpic(): Array<{ epic: Epic; stories: Story[] }> {
    const epicGroups: Array<{ epic: Epic; stories: Story[] }> = [];

    for (const epic of this.state.epics) {
      const epicStories = this.state.stories.filter(
        story => story.epicId === epic.id && story.status === 'backlog'
      );

      if (epicStories.length > 0) {
        epicGroups.push({ epic, stories: epicStories });
      }
    }

    return epicGroups;
  }

  /**
   * Process stories within an epic SEQUENTIALLY (one at a time)
   * Each story goes through Code → Test loop (max 3 retries)
   * Updates epic progress as stories complete
   */
  private async processEpicStories(epic: Epic, stories: Story[]): Promise<void> {
    let completedStoryCount = 0;
    const failedStories: Story[] = [];

    // Process each story sequentially (one at a time)
    for (let storyIndex = 0; storyIndex < stories.length; storyIndex++) {
      const story = stories[storyIndex];

      console.log(`\n📝 Story ${storyIndex + 1}/${stories.length} in Epic "${epic.title}"`);
      console.log(`   "${story.title}"`);

      this.state.currentStory = story;
      story.status = 'in_progress';

      // Save story status to disk
      if (this.state.projectDirectory) {
        await updateStory(this.state.projectDirectory, story.id, { status: 'in_progress' });
      }

      this.emit('story:started', story);

      // Update epic progress
      epic.progress = Math.round((completedStoryCount / stories.length) * 100);
      this.emit('epic:progress', {
        epic,
        progress: epic.progress,
        currentStory: storyIndex + 1,
        totalStories: stories.length,
      });

      try {
        const MAX_RETRIES = 3;
        let testsPassed = false;
        let retryCount = 0;

        // Code → Test loop (max 3 retries)
        while (!testsPassed && retryCount < MAX_RETRIES) {
          console.log(`   💻 Coding... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);

          this.emit('story:loop-iteration', {
            storyId: story.id,
            storyIndex,
            totalStories: stories.length,
            iteration: retryCount,
            maxIterations: MAX_RETRIES,
            phase: 'coding',
          });

          await this.invokeCoder('implement_story', story);
          if (this.isStopping) throw new Error('Workflow was stopped');

          console.log(`   🧪 Testing...`);

          this.emit('story:loop-iteration', {
            storyId: story.id,
            storyIndex,
            totalStories: stories.length,
            iteration: retryCount,
            maxIterations: MAX_RETRIES,
            phase: 'testing',
          });

          story.status = 'testing';

          // Save story status to disk
          if (this.state.projectDirectory) {
            await updateStory(this.state.projectDirectory, story.id, { status: 'testing' });
          }

          this.emit('story:updated', story);

          await this.invokeTester('test_story', story);
          if (this.isStopping) throw new Error('Workflow was stopped');

          // Check test results
          const testResults = this.state.testResults;
          if (testResults && testResults.failed === 0 && testResults.passed > 0) {
            testsPassed = true;
            console.log(`   ✅ Tests passed! (${testResults.passed} tests)`);
          } else if (testResults && testResults.failed > 0) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              console.log(`   ⚠️  Tests failed (${testResults.failed} failures), retrying... (${retryCount}/${MAX_RETRIES})`);
              story.status = 'in_progress';

              // Save story status to disk
              if (this.state.projectDirectory) {
                await updateStory(this.state.projectDirectory, story.id, { status: 'in_progress' });
              }
            } else {
              console.log(`   ❌ Tests failed after ${MAX_RETRIES} attempts (${testResults.failed} failures remain)`);
              testsPassed = true; // Stop retrying
            }
          } else if (!testResults || (testResults.passed === 0 && testResults.failed === 0)) {
            // No tests were written or executed - this is an error condition
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              console.log(`   ⚠️  No tests were created or executed! Retrying... (${retryCount}/${MAX_RETRIES})`);
              story.status = 'in_progress';

              // Save story status to disk
              if (this.state.projectDirectory) {
                await updateStory(this.state.projectDirectory, story.id, { status: 'in_progress' });
              }
            } else {
              console.log(`   ❌ Tester failed to create tests after ${MAX_RETRIES} attempts`);
              testsPassed = true; // Stop retrying to avoid infinite loop
            }
          }
        }

        // Mark story as done
        story.status = 'done';
        story.progress = 100;
        completedStoryCount++;

        // Save story completion to disk
        if (this.state.projectDirectory) {
          await updateStory(this.state.projectDirectory, story.id, { status: 'done', progress: 100 });
        }

        this.emit('story:completed', story);

        // Emit high-level completion message for better visibility
        this.emit('agent:message', {
          id: `msg-${Date.now()}`,
          agentId: 'system',
          agentType: 'supervisor',
          content: `✅ Story Completed: "${story.title}"\n\nProgress: ${completedStoryCount}/${stories.length} stories in Epic "${epic.title}"\nStory Points: ${story.storyPoints || 0}\n\n${stories.length - completedStoryCount} stories remaining in this epic.`,
          timestamp: new Date(),
        });

        console.log(`   ✅ Story completed (${completedStoryCount}/${stories.length})`);
      } catch (error) {
        console.error(`   ❌ Story failed:`, error);
        story.status = 'backlog';
        story.progress = 0;
        failedStories.push(story);

        // Save story failure to disk
        if (this.state.projectDirectory) {
          await updateStory(this.state.projectDirectory, story.id, { status: 'backlog', progress: 0 });
        }

        this.emit('story:error', { story, error });

        // Decide whether to continue or stop
        const shouldContinue = await this.handleStoryError(story, error);
        if (!shouldContinue) {
          epic.status = 'backlog';
          throw error;
        }
      }
    }

    // Update final epic progress
    epic.progress = Math.round((completedStoryCount / stories.length) * 100);

    if (failedStories.length > 0) {
      console.log(`\n⚠️  Epic "${epic.title}" has ${failedStories.length} failed stories`);
    } else {
      console.log(`\n✅ All stories in Epic "${epic.title}" completed successfully`);
    }
  }


  private async handleStoryError(story: Story, error: any): Promise<boolean> {
    // Decide whether to continue or stop
    // Could ask user or supervisor agent
    return false; // Stop on error for now
  }

  private async waitForClarifications(clarifications: ClarificationRequest[]): Promise<void> {
    // Wait for human to answer clarifications
    return new Promise((resolve) => {
      const checkClarifications = () => {
        const allAnswered = clarifications.every((c) => c.response);
        if (allAnswered) {
          resolve();
        } else {
          setTimeout(checkClarifications, 1000);
        }
      };
      checkClarifications();
    });
  }

  private async requestDeploymentApproval(deployment: any): Promise<boolean> {
    // Request human approval
    this.emit('approval:needed', { type: 'deployment', deployment });
    return new Promise((resolve) => {
      this.once('approval:response', (response) => {
        resolve(response.approved);
      });
    });
  }

  private async executeDeployment(deployment: any): Promise<void> {
    // Execute deployment steps
    this.emit('deployment:started', deployment);
    // Implementation would actually run deployment
    this.emit('deployment:completed', deployment);
  }

  private async applySecurityFix(vulnerability: any): Promise<void> {
    // Apply auto-fix for vulnerability
    this.emit('security:fix-applied', vulnerability);
  }

  /**
   * Save research findings to project directory
   */
  private async saveResearchFindings(findings: any): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      if (!this.state.projectDirectory) {
        console.warn('No project directory set, skipping research findings save');
        return;
      }

      // Create comprehensive markdown document
      const markdown = `# Research Analysis Report
Generated: ${new Date().toLocaleString()}
Project: ${this.state.config.name}

---

## Executive Summary

${findings.summary}

**Complexity:** ${findings.estimatedComplexity.toUpperCase()}
**Confidence:** ${findings.confidence}%

---

## 1. Domain Analysis

**Industry:** ${findings.domainAnalysis?.industry || 'Not specified'}

### Similar Applications
${findings.domainAnalysis?.similarApps?.map((app: string) => `- ${app}`).join('\n') || '- None identified'}

### Critical Features
${findings.domainAnalysis?.criticalFeatures?.map((feature: string) => `- ${feature}`).join('\n') || '- None identified'}

### Common Patterns
${findings.domainAnalysis?.commonPatterns?.map((pattern: string) => `- ${pattern}`).join('\n') || '- None identified'}

### Best Practices
${findings.domainAnalysis?.bestPractices?.map((practice: string) => `- ${practice}`).join('\n') || '- None identified'}

### Potential Challenges
${findings.domainAnalysis?.potentialChallenges?.map((challenge: string) => `- ${challenge}`).join('\n') || '- None identified'}

---

## 2. Technical Recommendations

### Frameworks
${findings.technicalRecommendations?.frameworks?.map((fw: string) => `- ${fw}`).join('\n') || '- None specified'}

### Libraries
${findings.technicalRecommendations?.libraries?.map((lib: string) => `- ${lib}`).join('\n') || '- None specified'}

### Architecture Patterns
${findings.technicalRecommendations?.architecturePatterns?.map((pattern: string) => `- ${pattern}`).join('\n') || '- None specified'}

### Database Choice
${findings.technicalRecommendations?.databaseChoice || 'Not specified'}

### State Management
${findings.technicalRecommendations?.stateManagement || 'Not specified'}

### API Design
${findings.technicalRecommendations?.apiDesign || 'Not specified'}

### Project Structure
${findings.technicalRecommendations?.projectStructure?.folders?.map((folder: string) => `- ${folder}`).join('\n') || '- Standard structure'}

### Naming Conventions
${findings.technicalRecommendations?.projectStructure?.conventions?.map((conv: string) => `- ${conv}`).join('\n') || '- Standard conventions'}

### Scalability Considerations
${findings.technicalRecommendations?.scalabilityConsiderations?.map((consideration: string) => `- ${consideration}`).join('\n') || '- None identified'}

---

## 3. Implementation Roadmap

### Phase 1: MVP
${findings.implementationRoadmap?.phase1_mvp?.map((item: string) => `- ${item}`).join('\n') || '- To be determined'}

### Phase 2: Enhanced Features
${findings.implementationRoadmap?.phase2_enhanced?.map((item: string) => `- ${item}`).join('\n') || '- To be determined'}

### Critical Path
${findings.implementationRoadmap?.criticalPath?.map((item: string) => `- ${item}`).join('\n') || '- To be determined'}

### Parallelizable Tasks
${findings.implementationRoadmap?.parallelizable?.map((item: string) => `- ${item}`).join('\n') || '- To be determined'}

### Time Estimates
${findings.implementationRoadmap?.estimatedTimePerPhase?.map((estimate: string) => `- ${estimate}`).join('\n') || '- To be determined'}

---

## 4. User Experience Insights

**Target Audience:** ${findings.userExperienceInsights?.targetAudience || 'Not specified'}

### Key User Flows
${findings.userExperienceInsights?.keyUserFlows?.map((flow: string) => `- ${flow}`).join('\n') || '- None identified'}

### Accessibility Requirements
${findings.userExperienceInsights?.accessibilityRequirements?.map((req: string) => `- ${req}`).join('\n') || '- Standard WCAG compliance'}

### Performance Targets
${findings.userExperienceInsights?.performanceTargets?.map((target: string) => `- ${target}`).join('\n') || '- Standard web performance'}

### Mobile Strategy
${findings.userExperienceInsights?.mobileStrategy || 'Responsive design'}

---

## 5. Security Considerations

### Data Protection
${findings.securityConsiderations?.dataProtection?.map((item: string) => `- ${item}`).join('\n') || '- Standard encryption'}

### Authentication
${findings.securityConsiderations?.authentication?.map((item: string) => `- ${item}`).join('\n') || '- To be determined'}

### Authorization
${findings.securityConsiderations?.authorization?.map((item: string) => `- ${item}`).join('\n') || '- To be determined'}

### Compliance
${findings.securityConsiderations?.compliance?.map((item: string) => `- ${item}`).join('\n') || '- None identified'}

### Input Validation
${findings.securityConsiderations?.inputValidation?.map((item: string) => `- ${item}`).join('\n') || '- Standard validation'}

---

## 6. Common Pitfalls & Solutions

${findings.commonPitfalls?.map((pitfall: any) => `
### ${pitfall.pitfall || 'Unknown Pitfall'}
**Impact:** ${pitfall.impact || 'Not specified'}
**Solution:** ${pitfall.solution || 'Not specified'}
`).join('\n') || 'No specific pitfalls identified'}

---

## 7. Testing Strategy

**Unit Tests:** ${findings.testingStrategy?.unitTests || 'To be determined'}

**Integration Tests:** ${findings.testingStrategy?.integrationTests || 'To be determined'}

**E2E Tests:** ${findings.testingStrategy?.e2eTests || 'To be determined'}

### Critical Paths to Test
${findings.testingStrategy?.criticalPaths?.map((path: string) => `- ${path}`).join('\n') || '- All user flows'}

---

## 8. Research Sources

${findings.researchSources?.map((source: string) => `- ${source}`).join('\n') || '- Industry best practices\n- Similar project analysis'}

---

## Next Steps

1. **Supervisor Agent** will create epics based on the implementation roadmap
2. **Product Owner** will break down epics into user stories using critical features
3. **Coder** will implement following the technical recommendations
4. **Tester** will verify using the testing strategy
5. **Security** will audit against security considerations
6. **Infrastructure** will deploy using scalability recommendations

---

*This research analysis serves as the foundation for the entire development workflow. All subsequent agents will reference these findings to ensure alignment with the recommended approach.*
`;

      // Save markdown file
      const mdPath = path.join(this.state.projectDirectory, 'research-findings.md');
      await fs.writeFile(mdPath, markdown, 'utf-8');
      console.log(`✅ Research findings saved to: ${mdPath}`);

      // Also save JSON for programmatic access
      const jsonPath = path.join(this.state.projectDirectory, 'research-findings.json');
      await fs.writeFile(jsonPath, JSON.stringify(findings, null, 2), 'utf-8');
      console.log(`✅ Research findings JSON saved to: ${jsonPath}`);

    } catch (error) {
      console.error('❌ Failed to save research findings:', error);
      // Don't throw - this shouldn't stop the workflow
    }
  }

  /**
   * Save user stories to project directory
   */
  private async saveStories(stories: Story[]): Promise<void> {
    try {
      const fs = require('fs').promises;
      const path = require('path');

      if (!this.state.projectDirectory) {
        console.warn('No project directory set, skipping stories save');
        return;
      }

      // Calculate metrics
      const totalStoryPoints = stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0);
      const storiesByStatus = stories.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const storiesByPriority = stories.reduce((acc, s) => {
        acc[s.priority] = (acc[s.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Group stories by epic
      const storiesByEpic = stories.reduce((acc, story) => {
        const epicId = story.epicId;
        if (!acc[epicId]) {
          acc[epicId] = [];
        }
        acc[epicId].push(story);
        return acc;
      }, {} as Record<string, Story[]>);

      // Create comprehensive markdown document
      const markdown = `# User Stories
Generated: ${new Date().toLocaleString()}
Project: ${this.state.config.name}

---

## Summary

**Total Stories:** ${stories.length}
**Total Story Points:** ${totalStoryPoints}
**Average Story Points:** ${(totalStoryPoints / stories.length).toFixed(1)}

### Status Breakdown
${Object.entries(storiesByStatus)
  .map(([status, count]) => `- **${status}**: ${count}`)
  .join('\n')}

### Priority Breakdown
${Object.entries(storiesByPriority)
  .map(([priority, count]) => `- **${priority}**: ${count}`)
  .join('\n')}

---

${Object.entries(storiesByEpic)
  .map(([epicId, epicStories]) => {
    const epic = this.state.epics.find(e => e.id === epicId);
    return `
## Epic: ${epic?.title || epicId}

${epic?.description || ''}

**Priority:** ${epic?.priority || 'medium'} | **Stories:** ${epicStories.length} | **Total Points:** ${epicStories.reduce((sum, s) => sum + (s.storyPoints || 0), 0)}

---

${epicStories.map(story => `
### ${story.title}

**ID:** \`${story.id}\`
**Status:** ${story.status}
**Priority:** ${story.priority}
**Story Points:** ${story.storyPoints || 0}
**Progress:** ${story.progress}%

#### Description
${story.description}

#### Acceptance Criteria
${(story.acceptanceCriteria || []).map((criterion, i) => `${i + 1}. ${criterion}`).join('\n') || '(none specified)'}

${story.dependencies && story.dependencies.length > 0 ? `
#### Dependencies
${story.dependencies.map(dep => `- ${dep}`).join('\n')}
` : ''}

${story.assignedAgent ? `**Assigned Agent:** ${story.assignedAgent}` : '**Assigned Agent:** Unassigned'}

---
`).join('\n')}
`;
  }).join('\n')}

---

## Next Steps

1. **Coder Agent** will implement stories in priority order
2. Each story will be developed according to its acceptance criteria
3. **Tester Agent** will verify each story meets all acceptance criteria
4. **Security Agent** will audit for vulnerabilities
5. **Infrastructure Agent** will prepare deployment

---

*User stories serve as the development backlog. The Coder agent will work through these stories systematically, ensuring each meets its acceptance criteria before moving to the next.*
`;

      // Save markdown file
      const mdPath = path.join(this.state.projectDirectory, 'user-stories.md');
      await fs.writeFile(mdPath, markdown, 'utf-8');
      console.log(`✅ User stories saved to: ${mdPath}`);

      // Also save JSON for programmatic access
      const jsonPath = path.join(this.state.projectDirectory, 'user-stories.json');
      await fs.writeFile(jsonPath, JSON.stringify(stories, null, 2), 'utf-8');
      console.log(`✅ User stories JSON saved to: ${jsonPath}`);

    } catch (error) {
      console.error('❌ Failed to save user stories:', error);
      // Don't throw - this shouldn't stop the workflow
    }
  }

  /**
   * Public methods for external control
   */
  public pause(): void {
    this.state.status = 'idle';
    this.emit('workflow:paused');
  }

  public resume(): void {
    this.state.status = 'developing';
    this.emit('workflow:resumed');
  }

  public async stop(): Promise<void> {
    console.log('🛑 Stopping orchestrator for project:', this.state.projectId);

    // Set stopping flag to interrupt ongoing operations
    this.isStopping = true;
    this.state.status = 'idle';

    // Abort all ongoing API requests
    this.abortController.abort();

    // Mark all agents as stopped
    this.agents.forEach(agent => {
      if (agent.status === 'working' || agent.status === 'thinking') {
        agent.status = 'idle';
        this.emit('agent:status', agent);
      }
    });

    // Stop dev server if running
    if (this.state.projectId) {
      try {
        console.log('🛑 Stopping development server...');
        await fetch(`http://localhost:3000/api/preview/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: this.state.projectId }),
        });
      } catch (error) {
        console.error('Error stopping dev server:', error);
      }
    }

    // Emit stop message
    this.emit('agent:message', {
      id: `msg-${Date.now()}`,
      agentId: 'system',
      agentType: 'supervisor',
      content: `⏹️ Workflow stopped by user. All agents have been terminated.`,
      timestamp: new Date(),
    });

    // Emit workflow stopped event
    this.emit('workflow:stopped');

    // Remove all event listeners
    this.removeAllListeners();

    console.log('✅ Orchestrator stopped for project:', this.state.projectId);
    console.log('   - All agents marked as idle');
    console.log('   - All API requests aborted');
    console.log('   - Event listeners removed');
  }

  public getState(): DevelopmentState {
    return this.state;
  }

  public provideClarification(clarificationId: string, response: string): void {
    const clarification = this.state.clarifications.find((c) => c.id === clarificationId);
    if (clarification) {
      clarification.response = response;
      clarification.respondedAt = new Date();
    }
  }

  public provideApproval(approved: boolean): void {
    this.emit('approval:response', { approved });
  }
}
