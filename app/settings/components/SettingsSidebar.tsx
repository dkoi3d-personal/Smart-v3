'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Bot,
  FolderCog,
  Cpu,
  Figma,
  Heart,
  Plug,
  Key,
  Sparkles,
  Users,
  Paintbrush,
  Database,
  Server,
  Search,
  ChevronDown,
  ChevronRight,
  Settings,
  Brain,
} from 'lucide-react';
import { StatusIndicator, StatusType } from './shared/StatusIndicator';

export type SettingsSection =
  | 'overview'
  | 'claude'
  | 'project-dir'
  | 'local-ai'
  | 'figma'
  | 'epic'
  | 'integrations'
  | 'api-keys'
  | 'ai-providers'
  | 'agents'
  | 'memory'
  | 'design-systems'
  | 'database'
  | 'services';

interface NavItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  status?: StatusType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  statuses?: Partial<Record<SettingsSection, StatusType>>;
}

export function SettingsSidebar({
  activeSection,
  onSectionChange,
  statuses = {},
}: SettingsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Platform: true,
    Integrations: true,
    'AI & Agents': true,
    Build: true,
  });

  const navGroups: NavGroup[] = [
    {
      title: 'Overview',
      items: [
        {
          id: 'overview',
          label: 'Dashboard',
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
      ],
      defaultOpen: true,
    },
    {
      title: 'Platform',
      items: [
        {
          id: 'claude',
          label: 'Claude Subscription',
          icon: <Bot className="h-4 w-4" />,
          status: statuses.claude,
        },
        {
          id: 'project-dir',
          label: 'Project Directory',
          icon: <FolderCog className="h-4 w-4" />,
          status: statuses['project-dir'],
        },
        {
          id: 'local-ai',
          label: 'Local AI',
          icon: <Cpu className="h-4 w-4" />,
          status: statuses['local-ai'],
        },
      ],
      defaultOpen: true,
    },
    {
      title: 'Integrations',
      items: [
        {
          id: 'figma',
          label: 'Figma',
          icon: <Figma className="h-4 w-4" />,
          status: statuses.figma,
        },
        {
          id: 'epic',
          label: 'Epic Healthcare',
          icon: <Heart className="h-4 w-4" />,
          status: statuses.epic,
        },
        {
          id: 'integrations',
          label: 'External Services',
          icon: <Plug className="h-4 w-4" />,
        },
      ],
      defaultOpen: true,
    },
    {
      title: 'API & Keys',
      items: [
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: <Key className="h-4 w-4" />,
        },
      ],
      defaultOpen: true,
    },
    {
      title: 'AI & Agents',
      items: [
        {
          id: 'ai-providers',
          label: 'AI Providers',
          icon: <Sparkles className="h-4 w-4" />,
        },
        {
          id: 'agents',
          label: 'Agent Settings',
          icon: <Users className="h-4 w-4" />,
        },
        {
          id: 'memory',
          label: 'Agent Memory',
          icon: <Brain className="h-4 w-4" />,
        },
      ],
      defaultOpen: true,
    },
    {
      title: 'Build',
      items: [
        {
          id: 'design-systems',
          label: 'Design Systems',
          icon: <Paintbrush className="h-4 w-4" />,
        },
        {
          id: 'database',
          label: 'Database Schemas',
          icon: <Database className="h-4 w-4" />,
        },
        {
          id: 'services',
          label: 'Service Catalog',
          icon: <Server className="h-4 w-4" />,
        },
      ],
      defaultOpen: true,
    },
  ];

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col h-full border-r bg-card">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Settings</h2>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredGroups.map((group) => (
            <div key={group.title} className="mb-2">
              {group.title !== 'Overview' && (
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="uppercase tracking-wider">{group.title}</span>
                  {expandedGroups[group.title] ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}
              {(group.title === 'Overview' || expandedGroups[group.title]) && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Button
                      key={item.id}
                      variant={activeSection === item.id ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start h-9 px-2',
                        activeSection === item.id && 'bg-secondary font-medium'
                      )}
                      onClick={() => onSectionChange(item.id)}
                    >
                      <span className="mr-2">{item.icon}</span>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.status && (
                        <StatusIndicator status={item.status} size="sm" />
                      )}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
