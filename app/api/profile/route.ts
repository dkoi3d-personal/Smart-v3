import { NextRequest, NextResponse } from 'next/server';
import {
  loadProfiles,
  getActiveProfile,
  setActiveProfile,
  createProfile,
  getPermissions,
  ROLE_NAV_ITEMS,
  DEFAULT_VIEWS,
} from '@/lib/user-profiles';

// GET - Get active profile or list all profiles
export async function GET(request: NextRequest) {
  try {
    const listAll = request.nextUrl.searchParams.get('all') === 'true';

    if (listAll) {
      const store = await loadProfiles();
      return NextResponse.json({
        profiles: store.profiles,
        activeProfileId: store.activeProfileId,
      });
    }

    const profile = await getActiveProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'No active profile' },
        { status: 404 }
      );
    }

    const permissions = getPermissions(profile.role);
    const navItems = ROLE_NAV_ITEMS[profile.role];
    const defaultView = DEFAULT_VIEWS[profile.role];

    return NextResponse.json({
      profile,
      permissions,
      navItems,
      defaultView,
    });
  } catch (error) {
    console.error('Failed to get profile:', error);
    return NextResponse.json(
      { error: 'Failed to get profile' },
      { status: 500 }
    );
  }
}

// POST - Create new profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, role, avatar } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { error: 'Name, email, and role are required' },
        { status: 400 }
      );
    }

    const validRoles = ['developer', 'uat_tester', 'stakeholder', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    const profile = await createProfile({
      name,
      email,
      role,
      avatar,
      preferences: {
        theme: 'dark',
        defaultView: DEFAULT_VIEWS[role as keyof typeof DEFAULT_VIEWS],
        notifications: {
          email: false,
          inApp: true,
          buildComplete: true,
          testResults: true,
          bugUpdates: true,
        },
        ...(role === 'uat_tester' && {
          uatSettings: {
            autoScreenshot: true,
            showDevTools: false,
            highlightChanges: true,
          },
        }),
      },
    });

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to create profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}

// PUT - Switch active profile
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      );
    }

    const profile = await setActiveProfile(profileId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const permissions = getPermissions(profile.role);
    const navItems = ROLE_NAV_ITEMS[profile.role];
    const defaultView = DEFAULT_VIEWS[profile.role];

    return NextResponse.json({
      profile,
      permissions,
      navItems,
      defaultView,
    });
  } catch (error) {
    console.error('Failed to switch profile:', error);
    return NextResponse.json(
      { error: 'Failed to switch profile' },
      { status: 500 }
    );
  }
}
