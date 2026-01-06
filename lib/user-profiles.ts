/**
 * User Profile and Role System
 *
 * Supports different user types:
 * - Developer: Full access to all features
 * - UAT Tester: Focused on testing, bug reporting, and requesting fixes
 * - Stakeholder: View-only access with approval capabilities
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type UserRole = 'developer' | 'uat_tester' | 'stakeholder' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  lastActive: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultView: string;
  notifications: {
    email: boolean;
    inApp: boolean;
    buildComplete: boolean;
    testResults: boolean;
    bugUpdates: boolean;
  };
  uatSettings?: {
    autoScreenshot: boolean;
    showDevTools: boolean;
    highlightChanges: boolean;
  };
}

export interface RolePermissions {
  canCreateProjects: boolean;
  canEditCode: boolean;
  canRunAgents: boolean;
  canDeploy: boolean;
  canReportBugs: boolean;
  canRequestFixes: boolean;
  canApprove: boolean;
  canViewAllProjects: boolean;
  canManageUsers: boolean;
  canAccessSettings: boolean;
  canViewAnalytics: boolean;
}

// Role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    canCreateProjects: true,
    canEditCode: true,
    canRunAgents: true,
    canDeploy: true,
    canReportBugs: true,
    canRequestFixes: true,
    canApprove: true,
    canViewAllProjects: true,
    canManageUsers: true,
    canAccessSettings: true,
    canViewAnalytics: true,
  },
  developer: {
    canCreateProjects: true,
    canEditCode: true,
    canRunAgents: true,
    canDeploy: true,
    canReportBugs: true,
    canRequestFixes: true,
    canApprove: false,
    canViewAllProjects: true,
    canManageUsers: false,
    canAccessSettings: true,
    canViewAnalytics: true,
  },
  uat_tester: {
    canCreateProjects: false,
    canEditCode: false,
    canRunAgents: false,
    canDeploy: false,
    canReportBugs: true,
    canRequestFixes: true,
    canApprove: true,
    canViewAllProjects: true,
    canManageUsers: false,
    canAccessSettings: false,
    canViewAnalytics: true,
  },
  stakeholder: {
    canCreateProjects: false,
    canEditCode: false,
    canRunAgents: false,
    canDeploy: false,
    canReportBugs: false,
    canRequestFixes: false,
    canApprove: true,
    canViewAllProjects: true,
    canManageUsers: false,
    canAccessSettings: false,
    canViewAnalytics: true,
  },
};

// Default dashboard views per role
export const DEFAULT_VIEWS: Record<UserRole, string> = {
  admin: '/projects',
  developer: '/projects',
  uat_tester: '/uat',
  stakeholder: '/projects',
};

// Navigation items per role
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Home', href: '/', icon: 'Home' },
    { label: 'Projects', href: '/projects', icon: 'FolderOpen' },
    { label: 'UAT Testing', href: '/uat', icon: 'TestTube' },
    { label: 'Database', href: '/settings/database', icon: 'Database' },
    { label: 'Users', href: '/settings/users', icon: 'Users' },
    { label: 'Settings', href: '/settings', icon: 'Settings' },
  ],
  developer: [
    { label: 'Home', href: '/', icon: 'Home' },
    { label: 'Projects', href: '/projects', icon: 'FolderOpen' },
    { label: 'UAT Testing', href: '/uat', icon: 'TestTube' },
    { label: 'Database', href: '/settings/database', icon: 'Database' },
    { label: 'Settings', href: '/settings', icon: 'Settings' },
  ],
  uat_tester: [
    { label: 'UAT Dashboard', href: '/uat', icon: 'TestTube' },
    { label: 'My Bugs', href: '/uat/bugs', icon: 'Bug' },
    { label: 'Test Cases', href: '/uat/test-cases', icon: 'ClipboardCheck' },
    { label: 'Projects', href: '/projects', icon: 'FolderOpen' },
  ],
  stakeholder: [
    { label: 'Projects', href: '/projects', icon: 'FolderOpen' },
    { label: 'Approvals', href: '/approvals', icon: 'CheckCircle' },
    { label: 'Reports', href: '/reports', icon: 'BarChart' },
  ],
};

const PROFILES_FILE = path.join(process.cwd(), 'data', 'user-profiles.json');

interface ProfilesStore {
  profiles: UserProfile[];
  activeProfileId?: string;
}

/**
 * Load all user profiles
 */
export async function loadProfiles(): Promise<ProfilesStore> {
  try {
    const data = await fs.readFile(PROFILES_FILE, 'utf-8');
    return JSON.parse(data) as ProfilesStore;
  } catch {
    // Return default developer profile if no profiles exist
    const defaultProfile: UserProfile = {
      id: 'default-dev',
      name: 'Developer',
      email: 'developer@local',
      role: 'developer',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      preferences: {
        theme: 'dark',
        defaultView: '/projects',
        notifications: {
          email: false,
          inApp: true,
          buildComplete: true,
          testResults: true,
          bugUpdates: true,
        },
      },
    };

    return {
      profiles: [defaultProfile],
      activeProfileId: defaultProfile.id,
    };
  }
}

/**
 * Save profiles to file
 */
export async function saveProfiles(store: ProfilesStore): Promise<void> {
  const dataDir = path.dirname(PROFILES_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(PROFILES_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Get active profile
 */
export async function getActiveProfile(): Promise<UserProfile | null> {
  const store = await loadProfiles();
  if (!store.activeProfileId) return store.profiles[0] || null;
  return store.profiles.find(p => p.id === store.activeProfileId) || null;
}

/**
 * Set active profile
 */
export async function setActiveProfile(profileId: string): Promise<UserProfile | null> {
  const store = await loadProfiles();
  const profile = store.profiles.find(p => p.id === profileId);

  if (!profile) return null;

  store.activeProfileId = profileId;
  profile.lastActive = new Date().toISOString();
  await saveProfiles(store);

  return profile;
}

/**
 * Create new profile
 */
export async function createProfile(
  profile: Omit<UserProfile, 'id' | 'createdAt' | 'lastActive'>
): Promise<UserProfile> {
  const store = await loadProfiles();

  const newProfile: UserProfile = {
    ...profile,
    id: `user-${Date.now()}`,
    createdAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    preferences: profile.preferences || {
      theme: 'dark',
      defaultView: DEFAULT_VIEWS[profile.role],
      notifications: {
        email: false,
        inApp: true,
        buildComplete: true,
        testResults: true,
        bugUpdates: true,
      },
      ...(profile.role === 'uat_tester' && {
        uatSettings: {
          autoScreenshot: true,
          showDevTools: false,
          highlightChanges: true,
        },
      }),
    },
  };

  store.profiles.push(newProfile);
  await saveProfiles(store);

  return newProfile;
}

/**
 * Update profile
 */
export async function updateProfile(
  id: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  const store = await loadProfiles();
  const index = store.profiles.findIndex(p => p.id === id);

  if (index === -1) return null;

  store.profiles[index] = { ...store.profiles[index], ...updates };
  await saveProfiles(store);

  return store.profiles[index];
}

/**
 * Delete profile
 */
export async function deleteProfile(id: string): Promise<boolean> {
  const store = await loadProfiles();
  const index = store.profiles.findIndex(p => p.id === id);

  if (index === -1) return false;

  store.profiles.splice(index, 1);

  if (store.activeProfileId === id) {
    store.activeProfileId = store.profiles[0]?.id;
  }

  await saveProfiles(store);
  return true;
}

/**
 * Check if user has permission
 */
export function hasPermission(role: UserRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Get permissions for role
 */
export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export const userProfiles = {
  loadProfiles,
  saveProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  hasPermission,
  getPermissions,
  ROLE_PERMISSIONS,
  DEFAULT_VIEWS,
  ROLE_NAV_ITEMS,
};

export default userProfiles;
