'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

import { SettingsProvider, useSettings } from './components/SettingsContext';
import { SettingsSidebar, SettingsSection } from './components/SettingsSidebar';
import { StatusType } from './components/shared/StatusIndicator';
import {
  OverviewSection,
  ClaudeSection,
  ProjectDirSection,
  LocalAISection,
  FigmaSection,
  EpicSection,
  ExternalIntegrationsSection,
  ApiKeysSection,
  AIProvidersSection,
  AgentsSection,
  MemorySection,
  DesignSystemsSection,
  DatabaseSection,
  ServicesSection,
} from './components/sections';

function SettingsContent() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    claudeStatus,
    mlxStatus,
    ollamaStatus,
    epicStatus,
    figmaStatus,
    projectDirConfig,
  } = useSettings();

  // Calculate statuses for sidebar indicators
  const getStatuses = (): Partial<Record<SettingsSection, StatusType>> => {
    const getClaudeStatus = (): StatusType => {
      if (claudeStatus?.authenticated) return 'success';
      if (claudeStatus?.installed) return 'warning';
      return 'error';
    };

    const getLocalAIStatus = (): StatusType => {
      if (mlxStatus?.mlxAvailable && mlxStatus.model.available) return 'success';
      if (ollamaStatus?.deepseekOcrAvailable) return 'success';
      if (mlxStatus?.mlxAvailable || ollamaStatus?.ollamaAvailable) return 'warning';
      return 'inactive';
    };

    const getProjectDirStatus = (): StatusType => {
      return projectDirConfig?.directoryExists ? 'success' : 'warning';
    };

    const getFigmaStatus = (): StatusType => {
      return figmaStatus?.configured ? 'success' : 'inactive';
    };

    const getEpicStatus = (): StatusType => {
      if (epicStatus?.connected) return 'success';
      if (epicStatus?.configured) return 'warning';
      return 'inactive';
    };

    return {
      claude: getClaudeStatus(),
      'project-dir': getProjectDirStatus(),
      'local-ai': getLocalAIStatus(),
      figma: getFigmaStatus(),
      epic: getEpicStatus(),
    };
  };

  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewSection onNavigate={handleSectionChange} />;
      case 'claude':
        return <ClaudeSection />;
      case 'project-dir':
        return <ProjectDirSection />;
      case 'local-ai':
        return <LocalAISection />;
      case 'figma':
        return <FigmaSection />;
      case 'epic':
        return <EpicSection />;
      case 'integrations':
        return <ExternalIntegrationsSection />;
      case 'api-keys':
        return <ApiKeysSection />;
      case 'ai-providers':
        return <AIProvidersSection />;
      case 'agents':
        return <AgentsSection />;
      case 'memory':
        return <MemorySection />;
      case 'design-systems':
        return <DesignSystemsSection />;
      case 'database':
        return <DatabaseSection />;
      case 'services':
        return <ServicesSection />;
      default:
        return <OverviewSection onNavigate={handleSectionChange} />;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden border-b bg-card sticky top-0 z-20 flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={cn(
          'lg:hidden fixed inset-y-0 left-0 w-72 bg-card z-40 transform transition-transform shadow-xl',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          statuses={getStatuses()}
        />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden lg:flex lg:flex-col w-72 flex-shrink-0 border-r bg-card/50">
          {/* Back Button */}
          <div className="p-4 border-b bg-card flex-shrink-0">
            <Link href="/">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
          <div className="flex-1 overflow-hidden">
            <SettingsSidebar
              activeSection={activeSection}
              onSectionChange={handleSectionChange}
              statuses={getStatuses()}
            />
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-4xl mx-auto p-6 pb-12">{renderSection()}</div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  );
}
