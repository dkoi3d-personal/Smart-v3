# Next.js App Router Patterns

Reference guide for Next.js 14+ App Router patterns. Read this when encountering SSR, hydration, or routing issues.

## App Router Structure (CRITICAL)

We use ONLY App Router (Next.js 13+), NOT Pages Router!

### Correct Structure
```
app/
  layout.tsx      # Root layout (metadata, html, body)
  page.tsx        # Home page
  [route]/
    page.tsx      # Route pages (e.g., app/about/page.tsx)
  api/
    [route]/
      route.ts    # API routes
  components/     # Shared components
```

### NEVER Use Pages Router
- NEVER create `pages/` folder
- NEVER import from `next/document` (no Html, Head, Main, NextScript)
- NEVER create `_app.tsx` or `_document.tsx`
- NEVER use `getServerSideProps` or `getStaticProps`

### Correct layout.tsx
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'My App',
  description: 'My app description',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

---

## Client vs Server Components

ALL components are Server Components by default in App Router.

### When to use 'use client'
Add `'use client'` at TOP of file when using:
- useState, useEffect, useContext, useRef, useMemo, useCallback (any hook)
- onClick, onChange, onSubmit (any event handler)
- Browser APIs (localStorage, window, document)
- Third-party libraries that use hooks

### Correct Client Component
```tsx
'use client';  // REQUIRED at TOP for hooks!

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Keep as Server Component (no 'use client')
- Static content with no interactivity
- Data fetching with async/await
- Components that only render props/children

### Provider Pattern
Wrap client-only providers in a separate 'use client' component:
```tsx
// app/providers.tsx
'use client';
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// app/layout.tsx (Server Component - no 'use client'!)
import { Providers } from './providers';
export default function RootLayout({ children }) {
  return <html><body><Providers>{children}</Providers></body></html>;
}
```

---

## SSR-Safe Code Patterns

### NEVER access browser APIs in initial render
```tsx
// BAD - breaks SSR
useState(localStorage.getItem('key'))
const width = window.innerWidth

// GOOD - use useEffect
const [value, setValue] = useState(null);
useEffect(() => {
  setValue(localStorage.getItem('key'));
}, []);
```

### Hydration Error Prevention

Causes of hydration errors (server/client content differs):
1. `new Date()` or `Date.now()` rendered directly
2. `Math.random()` for content or keys
3. `typeof window !== 'undefined'` rendering different content
4. localStorage/sessionStorage during initial render

### Correct Pattern for Dynamic Data
```tsx
'use client';
import { useState, useEffect } from 'react';

export default function MyComponent() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCurrentTime(new Date().toLocaleString());
  }, []);

  if (!isClient) return <div>Loading...</div>;
  return <div>{currentTime}</div>;
}
```

### Seeded Random for Deterministic Mock Data
```tsx
function seededRandom(seed: number) {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
const random = seededRandom(42); // Same on server AND client
```

---

## API Route Configuration (CRITICAL)

### Force Dynamic for Database/SearchParams Routes

ALL API routes that use `searchParams` OR Prisma database calls MUST include:

```typescript
export const dynamic = 'force-dynamic';
```

This prevents Next.js build errors like "Dynamic server usage: Page couldn't be rendered statically because it used searchParams.get".

### Correct API Route Pattern
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// REQUIRED for routes using searchParams or database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  const data = await prisma.myModel.findMany({
    where: id ? { id: parseInt(id) } : {},
  });

  return NextResponse.json({ data });
}
```

### When to Add `force-dynamic`
- Route uses `request.nextUrl.searchParams`
- Route calls Prisma or any database
- Route depends on request headers or cookies
- Route has any dynamic data that can't be statically analyzed

---

## Common Errors & Fixes

### "Dynamic server usage" / "Page couldn't be rendered statically"
- Add `export const dynamic = 'force-dynamic';` at top of the API route file
- This tells Next.js to skip static rendering for routes with dynamic data

### "Html imported outside _document"
- DELETE the `pages/` folder - we use App Router only
- Move content to `app/layout.tsx` (no Html import needed)

### "getServerSideProps is not supported in app/"
- Convert to async Server Component:
```tsx
// Instead of getServerSideProps
export default async function Page() {
  const data = await fetch('...').then(r => r.json());
  return <div>{data.title}</div>;
}
```

### "Can't use hooks in Server Components"
- Add `'use client'` at TOP of file

### Stale Cache Errors
If you see cache-related errors:
```bash
rm -rf .next && npm run build
```

### Turbopack Errors
If you see app-build-manifest.json errors, disable Turbopack:
```bash
npm pkg set scripts.dev='next dev' scripts.build='next build'
rm -rf .next
```
