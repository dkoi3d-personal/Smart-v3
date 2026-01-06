# Epic-Based Workflow Implementation

## ✅ IMPLEMENTATION COMPLETE

Changed the development workflow to process ONE EPIC AT A TIME instead of processing stories from multiple epics in parallel. This prevents conflicts and provides better epic-level progress tracking.

**Status:** Fully implemented in `lib/agents/orchestrator.ts`

## New Workflow

### Epic-Level Processing
1. **Group stories by epic**
2. **Sort epics by priority** (critical → high → medium → low)
3. **Process each epic sequentially:**
   - Start epic (emit `epic:started`)
   - Process ALL stories in the epic
   - After all stories pass, run security scan for entire epic
   - Mark epic complete (emit `epic:completed`)
   - Move to next epic

### Story-Level Processing (within each epic)
For each story in the current epic:
1. **Code** - Coder agent implements the story
2. **Test** - Tester agent writes and runs tests
3. **Mark complete** - Story marked as done
4. Loop to next story in epic

### Security Scanning
- Security scan runs ONCE per epic (not per story)
- Only runs after ALL stories in epic are complete
- Scans all changes made during the entire epic

## Key Changes to orchestrator.ts

### Location: `developmentLoop()` function (around line 246)

Replace the entire function with:

```typescript
private async developmentLoop(): Promise<void> {
  this.state.status = 'developing';

  // Group stories by epic
  const epicMap = new Map<string, Story[]>();
  this.state.stories.forEach(story => {
    if (!epicMap.has(story.epicId)) {
      epicMap.set(story.epicId, []);
    }
    epicMap.get(story.epicId)!.push(story);
  });

  // Sort epics by priority
  const sortedEpics = this.state.epics.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  console.log(`🎯 Processing ${sortedEpics.length} epics sequentially...`);

  // Process each epic one at a time
  for (let epicIndex = 0; epicIndex < sortedEpics.length; epicIndex++) {
    const epic = sortedEpics[epicIndex];
    const epicStories = epicMap.get(epic.id) || [];

    console.log(`\n===============================================================================`);
    console.log(`📋 EPIC ${epicIndex + 1}/${sortedEpics.length}: ${epic.title}`);
    console.log(`   ${epicStories.length} stories to implement`);
    console.log(`===============================================================================\n`);

    // Update epic status
    epic.status = 'in_progress';
    this.emit('epic:started', epic);

    // Process all stories in this epic
    let completedStoryCount = 0;
    const failedStories: Story[] = [];

    for (let storyIndex = 0; storyIndex < epicStories.length; storyIndex++) {
      const story = epicStories[storyIndex];

      console.log(`\n📝 Story ${storyIndex + 1}/${epicStories.length} in Epic "${epic.title}"`);
      console.log(`   "${story.title}"`);

      this.state.currentStory = story;
      story.status = 'in_progress';
      this.emit('story:started', story);

      // Update epic progress
      epic.progress = Math.round((completedStoryCount / epicStories.length) * 100);
      this.emit('epic:progress', { epic, progress: epic.progress, currentStory: storyIndex + 1, totalStories: epicStories.length });

      try {
        // Code the story
        console.log(`   💻 Coding...`);
        await this.invokeCoder('implement_story', story);

        // Test the story
        console.log(`   🧪 Testing...`);
        await this.invokeTester('test_story', story);

        // Mark story as done
        story.status = 'done';
        story.progress = 100;
        completedStoryCount++;
        this.emit('story:completed', story);

        console.log(`   ✅ Story completed (${completedStoryCount}/${epicStories.length})`);
      } catch (error) {
        console.error(`   ❌ Story failed:`, error);
        story.status = 'backlog';
        story.progress = 0;
        failedStories.push(story);
        this.emit('story:error', { story, error });

        // Decide whether to continue or stop
        const shouldContinue = await this.handleStoryError(story, error);
        if (!shouldContinue) {
          epic.status = 'backlog';
          throw error;
        }
      }
    }

    // All stories in epic completed - now run security scan for entire epic
    if (failedStories.length === 0) {
      console.log(`\n🔒 Running security scan for epic "${epic.title}"...`);

      try {
        await this.invokeSecurity('scan_epic', epic);

        // Epic fully complete
        epic.status = 'done';
        epic.progress = 100;
        this.emit('epic:completed', epic);

        console.log(`\n✅ EPIC COMPLETED: "${epic.title}"`);
        console.log(`   ${completedStoryCount}/${epicStories.length} stories ✓`);
      } catch (error) {
        console.error(`\n❌ Security scan failed for epic "${epic.title}":`, error);
        epic.status = 'backlog';
        this.emit('epic:error', { epic, error });
      }
    } else {
      console.log(`\n⚠️  Epic "${epic.title}" has ${failedStories.length} failed stories - skipping security scan`);
      epic.status = 'backlog';
    }
  }

  console.log(`\n===============================================================================`);
  console.log(`🎉 All epics processed!`);
  console.log(`===============================================================================\n`);
}
```

## New Events Emitted

1. `epic:started` - When an epic begins processing
2. `epic:progress` - As stories complete within the epic (includes currentStory and totalStories)
3. `epic:completed` - When all stories + security scan complete
4. `epic:error` - If epic fails

## Benefits

1. **No Conflicts** - Only one epic being worked on at a time
2. **Better Progress Tracking** - Clear epic-level progress visible
3. **Logical Security Scans** - Scan entire epic once, not each story
4. **Easier Debugging** - Clear epic boundaries in logs
5. **Resource Efficiency** - Focused work on related features

## UI Updates Needed

Update dashboard to:
- Show current epic being processed
- Show epic progress bar
- Show story N/M within current epic
- Display epic-level status
