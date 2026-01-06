/**
 * Epic-based sequential workflow
 * One epic at a time, stories sequential within epic
 * Code → Test loop for each story
 * Security scan after all stories in epic complete
 */

export const epicBasedDevelopmentLoop = `
  /**
   * Main development loop - processes epics one at a time, stories sequentially
   * Each story: Code → Test loop until tests pass (max 3 tries)
   * After all stories in epic: One security scan for the entire epic
   */
  private async developmentLoop(): Promise<void> {
    this.state.status = 'developing';

    // Group stories by epic
    const epicGroups = this.groupStoriesByEpic();
    console.log(\`🔄 Starting sequential development: \${epicGroups.length} epics, \${this.state.stories.length} total stories\`);

    // Process each epic sequentially
    for (let epicIndex = 0; epicIndex < epicGroups.length; epicIndex++) {
      const { epic, stories } = epicGroups[epicIndex];

      console.log(\`\\n📋 EPIC \${epicIndex + 1}/\${epicGroups.length}: "\${epic.title}" (\${stories.length} stories)\`);

      this.emit('agent:message', {
        id: \`msg-\${Date.now()}\`,
        agentId: 'system',
        agentType: 'supervisor',
        content: \`📋 Starting Epic \${epicIndex + 1}/\${epicGroups.length}: "\${epic.title}"\\n\${stories.length} stories to implement\`,
        timestamp: new Date(),
      });

      epic.status = 'in_progress';

      // Process each story in this epic sequentially
      for (let storyIndex = 0; storyIndex < stories.length; storyIndex++) {
        const story = stories[storyIndex];

        if (this.isStopping) throw new Error('Workflow was stopped');

        console.log(\`\\n💻 Story \${storyIndex + 1}/\${stories.length}: "\${story.title}"\`);

        this.state.currentStory = story;
        story.status = 'in_progress';
        this.emit('story:started', story);

        try {
          // Code → Test loop for this story (max 3 attempts)
          const MAX_RETRIES = 3;
          let testsPassed = false;
          let retryCount = 0;

          while (!testsPassed && retryCount < MAX_RETRIES) {
            console.log(\`🔄 Loop \${retryCount + 1}/\${MAX_RETRIES}\`);

            this.emit('agent:message', {
              id: \`msg-\${Date.now()}\`,
              agentId: 'system',
              agentType: 'supervisor',
              content: \`🔄 Story \${storyIndex + 1}/\${stories.length}: "\${story.title}" - Loop \${retryCount + 1}/\${MAX_RETRIES}\`,
              timestamp: new Date(),
            });

            // Emit loop iteration event for UI tracking
            this.emit('story:loop-iteration', {
              storyId: story.id,
              storyIndex,
              totalStories: stories.length,
              iteration: retryCount,
              maxIterations: MAX_RETRIES,
              phase: 'coding',
            });

            // STEP 1: Code
            console.log(\`  💻 Coding...\`);
            await this.invokeCoder('implement_story', story);
            if (this.isStopping) throw new Error('Workflow was stopped');

            // Update loop phase to testing
            this.emit('story:loop-iteration', {
              storyId: story.id,
              storyIndex,
              totalStories: stories.length,
              iteration: retryCount,
              maxIterations: MAX_RETRIES,
              phase: 'testing',
            });

            // STEP 2: Test
            console.log(\`  🧪 Testing...\`);
            story.status = 'testing';
            this.emit('story:updated', story);

            await this.invokeTester('test_story', story);
            if (this.isStopping) throw new Error('Workflow was stopped');

            // Check test results
            const testResults = this.state.testResults;
            if (testResults && testResults.failed === 0 && testResults.passed > 0) {
              testsPassed = true;
              console.log(\`  ✅ Tests passed! (\${testResults.passed}/\${testResults.passed})\`);
            } else if (testResults && testResults.failed > 0) {
              console.log(\`  ⚠️  \${testResults.failed} test(s) failed\`);
              retryCount++;

              if (retryCount < MAX_RETRIES) {
                console.log(\`  🔄 Retrying...\`);
                this.emit('agent:message', {
                  id: \`msg-\${Date.now()}\`,
                  agentId: 'system',
                  agentType: 'tester',
                  content: \`⚠️ \${testResults.failed} test(s) failed. Retrying (\${retryCount}/\${MAX_RETRIES})...\`,
                  timestamp: new Date(),
                });
                story.status = 'in_progress';
              } else {
                console.log(\`  ❌ Max retries reached\`);
                testsPassed = true; // Exit loop
              }
            } else {
              console.log(\`  ⚠️  No tests or inconclusive results\`);
              testsPassed = true;
            }
          }

          story.status = 'done';
          story.progress = 100;
          this.emit('story:completed', story);

          console.log(\`✅ Story \${storyIndex + 1}/\${stories.length} complete\`);
        } catch (error) {
          console.error(\`❌ Error in story "\${story.title}":\`, error);
          story.status = 'error';
          this.emit('story:error', { story, error });
        }
      }

      // Security scan after ALL stories in epic are done
      console.log(\`\\n🔒 Security scan for Epic: "\${epic.title}"\`);

      this.emit('agent:message', {
        id: \`msg-\${Date.now()}\`,
        agentId: 'system',
        agentType: 'security',
        content: \`🔒 Security scan for Epic "\${epic.title}" (\${stories.length} stories)\`,
        timestamp: new Date(),
      });

      await this.invokeSecurity('scan_epic', undefined);
      if (this.isStopping) throw new Error('Workflow was stopped');

      epic.status = 'completed';
      console.log(\`✅ Epic \${epicIndex + 1}/\${epicGroups.length} complete\`);
    }

    console.log(\`\\n🎉 All epics complete!\`);
  }

  /**
   * Group stories by epic for sequential processing
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
`;
