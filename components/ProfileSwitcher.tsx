'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  UserCog,
  TestTube,
  Eye,
  ChevronDown,
  Plus,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'developer' | 'uat_tester' | 'stakeholder' | 'admin';
  avatar?: string;
}

const roleIcons = {
  developer: UserCog,
  uat_tester: TestTube,
  stakeholder: Eye,
  admin: User,
};

const roleColors = {
  developer: 'text-blue-500',
  uat_tester: 'text-purple-500',
  stakeholder: 'text-green-500',
  admin: 'text-red-500',
};

const roleLabels = {
  developer: 'Developer',
  uat_tester: 'UAT Tester',
  stakeholder: 'Stakeholder',
  admin: 'Admin',
};

export default function ProfileSwitcher() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newProfile, setNewProfile] = useState({
    name: '',
    email: '',
    role: 'developer' as const,
  });
  const [creating, setCreating] = useState(false);

  // Load profiles
  useEffect(() => {
    async function loadProfiles() {
      try {
        // Get all profiles
        const allRes = await fetch('/api/profile?all=true');
        if (allRes.ok) {
          const data = await allRes.json();
          setProfiles(data.profiles || []);
        }

        // Get active profile
        const activeRes = await fetch('/api/profile');
        if (activeRes.ok) {
          const data = await activeRes.json();
          setActiveProfile(data.profile);
        }
      } catch (error) {
        console.error('Failed to load profiles:', error);
      }
    }
    loadProfiles();
  }, []);

  // Switch profile
  const handleSwitchProfile = async (profileId: string) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveProfile(data.profile);
        // Redirect to role's default view
        router.push(data.defaultView);
      }
    } catch (error) {
      console.error('Failed to switch profile:', error);
    }
  };

  // Create new profile
  const handleCreateProfile = async () => {
    if (!newProfile.name || !newProfile.email) return;

    setCreating(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProfile),
      });

      if (res.ok) {
        const profile = await res.json();
        setProfiles([...profiles, profile]);
        setShowCreateDialog(false);
        setNewProfile({ name: '', email: '', role: 'developer' });
        // Switch to new profile
        handleSwitchProfile(profile.id);
      }
    } catch (error) {
      console.error('Failed to create profile:', error);
    } finally {
      setCreating(false);
    }
  };

  if (!activeProfile) return null;

  const RoleIcon = roleIcons[activeProfile.role];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className={roleColors[activeProfile.role]}>
                {activeProfile.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden md:inline">{activeProfile.name}</span>
            <span className={`text-xs ${roleColors[activeProfile.role]}`}>
              {roleLabels[activeProfile.role]}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Switch Profile</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.map(profile => {
            const Icon = roleIcons[profile.role];
            const isActive = profile.id === activeProfile.id;
            return (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => handleSwitchProfile(profile.id)}
                className="gap-2"
              >
                <Icon className={`h-4 w-4 ${roleColors[profile.role]}`} />
                <span className="flex-1">{profile.name}</span>
                <span className="text-xs text-muted-foreground">
                  {roleLabels[profile.role]}
                </span>
                {isActive && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Profile
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Profile Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Profile</DialogTitle>
            <DialogDescription>
              Create a profile to access the platform with a specific role
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={newProfile.name}
                onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={newProfile.email}
                onChange={(e) => setNewProfile({ ...newProfile, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newProfile.role}
                onValueChange={(value: any) => setNewProfile({ ...newProfile, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">
                    <span className="flex items-center gap-2">
                      <UserCog className="h-4 w-4 text-blue-500" />
                      Developer
                    </span>
                  </SelectItem>
                  <SelectItem value="uat_tester">
                    <span className="flex items-center gap-2">
                      <TestTube className="h-4 w-4 text-purple-500" />
                      UAT Tester
                    </span>
                  </SelectItem>
                  <SelectItem value="stakeholder">
                    <span className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-green-500" />
                      Stakeholder
                    </span>
                  </SelectItem>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-2">
                      <User className="h-4 w-4 text-red-500" />
                      Admin
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-muted-foreground">
              <strong>Role Descriptions:</strong>
              <ul className="mt-2 space-y-1">
                <li><span className="text-blue-500">Developer:</span> Full access to build and deploy apps</li>
                <li><span className="text-purple-500">UAT Tester:</span> Test apps, report bugs, request fixes</li>
                <li><span className="text-green-500">Stakeholder:</span> View projects and approve changes</li>
                <li><span className="text-red-500">Admin:</span> Full access including user management</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProfile} disabled={creating}>
              {creating ? 'Creating...' : 'Create Profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
