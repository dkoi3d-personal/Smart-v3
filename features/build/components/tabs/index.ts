export { SecurityTab } from './SecurityTab';
export { TestingTab } from './TestingTab';
export { SettingsTab } from './SettingsTab';
export { BuildTab } from './BuildTab';
// Backward compatibility alias
export { BuildTab as OverviewTab } from './BuildTab';
export { DevelopmentTab } from './DevelopmentTab';
export { AuditTab } from './AuditTab';
export { HistoryTab } from './HistoryTab';
export { UATTab } from './UATTab';

// Re-export existing tabs from components/panels for unified imports
export { ComplianceTab } from '@/components/panels/ComplianceTab';
export { default as DeployTab } from '@/components/panels/DeployTab';
