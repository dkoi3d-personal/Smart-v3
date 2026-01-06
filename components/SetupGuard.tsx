'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SetupGuardProps {
  children: React.ReactNode;
}

export function SetupGuard({ children }: SetupGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  useEffect(() => {
    // Skip check for setup page itself
    if (pathname === '/setup') {
      setIsChecking(false);
      setIsSetupComplete(true);
      return;
    }

    // Skip check for settings pages (need access to configure)
    if (pathname?.startsWith('/settings')) {
      setIsChecking(false);
      setIsSetupComplete(true);
      return;
    }

    // Check localStorage for setup completion
    const setupComplete = localStorage.getItem('ai-dev-platform-setup-complete');

    if (setupComplete === 'true') {
      setIsSetupComplete(true);
      setIsChecking(false);
    } else {
      // Redirect to setup page
      router.push('/setup');
    }
  }, [pathname, router]);

  // Show loading spinner while checking
  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show children if setup is complete or we're on setup page
  if (isSetupComplete || pathname === '/setup') {
    return <>{children}</>;
  }

  return null;
}
