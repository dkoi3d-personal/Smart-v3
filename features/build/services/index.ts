/**
 * Build Services
 *
 * API services for builds.
 * With clean-slate architecture, every build starts fresh with empty stories.
 * Previous builds are archived to .build-history/ folder.
 */

export {
  startMultiAgentBuild,
  startNewBuildOnExistingProject,
  buildExistingProjectRequirements,
  buildFigmaExistingProjectRequirements,
  type BuildConfig,
  type CoderConfig,
} from './build-api';

export {
  extractFigmaDesign,
  saveFigmaContext,
  downloadFigmaFrames,
  setupFigmaForBuild,
  type FigmaDesignContext,
  type FigmaExtractionResult,
  type FigmaSaveResult,
  type FigmaDownloadResult,
} from './figma-api';
