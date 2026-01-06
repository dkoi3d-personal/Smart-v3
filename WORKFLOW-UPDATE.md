# Epic-Based Workflow Update

## Summary
Replace the current `developmentLoop()` in `lib/agents/orchestrator.ts` with epic-based sequential processing:
- Process one epic at a time (sequential)
- Within each epic: Process stories in parallel (max 3 concurrent) respecting dependencies
- Each story: Code → Test loop (max 3 retries)
- After all stories in epic complete: ONE security scan for the entire epic

## Method 1: Update developmentLoop()

Replace lines 243-356 in orchestrator.ts with:

```typescript
  /**
   * Main development loop - epic-based with parallel story processing
   * - Process epics sequentially (one at a time)
   * - Within each epic: parallel story processing (max 3 concurrent)
   * - Each story: Code → Test loop (max 3 retries)
   * - After epic completes: One security scan
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
        content: `📋 Starting Epic ${epicIndex + 1}/${epicGroups.length}: "${epic.title}"\n${stories.length} stories (parallel processing within epic)`,
        timestamp: new Date(),
      });

      epic.status = 'in_progress';

      // Process all stories in this epic (with parallelism)
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

      epic.status = 'completed';
      console.log(`✅ Epic ${epicIndex + 1}/${epicGroups.length} complete: "${epic.title}"`);
    }

    console.log(`\n🎉 All epics complete!`);
  }
```

## Method 2: Add groupStoriesByEpic()

Add after `getSortedStories()` method (around line 2175):

```typescript
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
```

## Method 3: Add processEpicStories()

Add after `groupStoriesByEpic()`:

```typescript
  /**
   * Process stories within an epic with controlled parallelism
   * Each story goes through Code → Test loop (max 3 retries)
   */
  private async processEpicStories(epic: Epic, stories: Story[]): Promise<void> {
    const MAX_CONCURRENT_STORIES = 3; // Process up to 3 stories in parallel
    const completedStories = new Set<string>();
    const failedStories = new Set<string>();
    const pendingStories = [...stories];
    const runningPromises: Promise<void>[] = [];

    const processStoryWithRetries = async (story: Story, storyIndex: number): Promise<void> => {
      this.state.currentStory = story;
      story.status = 'in_progress';
      this.emit('story:started', story);

      try {
        // Code → Test loop (max 3 attempts)
        const MAX_RETRIES = 3;
        let testsPassed = false;
        let retryCount = 0;

        while (!testsPassed && retryCount < MAX_RETRIES) {
          console.log(`🔄 Story "${story.title}" - Loop ${retryCount + 1}/${MAX_RETRIES}`);

          // Emit loop iteration for UI
          this.emit('story:loop-iteration', {
            storyId: story.id,
            storyIndex,
            totalStories: stories.length,
            iteration: retryCount,
            maxIterations: MAX_RETRIES,
            phase: 'coding',
          });

          // STEP 1: Code
          await this.invokeCoder('implement_story', story);
          if (this.isStopping) throw new Error('Workflow was stopped');

          // Update phase
          this.emit('story:loop-iteration', {
            storyId: story.id,
            storyIndex,
            totalStories: stories.length,
            iteration: retryCount,
            maxIterations: MAX_RETRIES,
            phase: 'testing',
          });

          // STEP 2: Test
          story.status = 'testing';
          await this.invokeTester('test_story', story);
          if (this.isStopping) throw new Error('Workflow was stopped');

          // Check results
          const testResults = this.state.testResults;
          if (testResults && testResults.failed === 0 && testResults.passed > 0) {
            testsPassed = true;
          } else if (testResults && testResults.failed > 0) {
            retryCount++;
            if (retryCount < MAX_RETRIES) {
              story.status = 'in_progress';
            } else {
              testsPassed = true; // Give up after max retries
            }
          } else {
            testsPassed = true;
          }
        }

        story.status = 'done';
        story.progress = 100;
        completedStories.add(story.id);
        this.emit('story:completed', story);
      } catch (error) {
        failedStories.add(story.id);
        story.status = 'error';
        this.emit('story:error', { story, error });
      }
    };

    // Process with controlled concurrency
    while (pendingStories.length > 0 || runningPromises.length > 0) {
      // Start new stories if we have capacity
      while (runningPromises.length < MAX_CONCURRENT_STORIES && pendingStories.length > 0) {
        const story = pendingStories.shift()!;

        // Check dependencies
        const canStart = !story.dependencies ||
          story.dependencies.every(depId => completedStories.has(depId));

        if (canStart) {
          const storyIndex = stories.indexOf(story);
          runningPromises.push(processStoryWithRetries(story, storyIndex));
        } else {
          pendingStories.push(story); // Put back
        }
      }

      // Wait for at least one to complete
      if (runningPromises.length > 0) {
        await Promise.race(runningPromises);
        runningPromises.splice(0, runningPromises.length,
          ...runningPromises.filter(p => {
            let settled = false;
            p.then(() => settled = true).catch(() => settled = true);
            return !settled;
          })
        );
      }
    }
  }
```

## Testing

After applying these changes:
1. Start a new project
2. Watch the workflow:
   - Should process Epic 1 first
   - Within Epic 1: Stories run in parallel (max 3 at once)
   - Each story: Code → Test → (retry if failed) → Done
   - After Epic 1 stories done: One security scan
   - Then move to Epic 2
3. Check loop visualization in UI updates correctly
