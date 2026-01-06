'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plug,
  ExternalLink,
  Zap,
  BarChart3,
  CreditCard,
  Mail,
  Database,
  Cloud,
  Eye,
  ArrowRight,
} from 'lucide-react';

const INTEGRATION_CATEGORIES = [
  {
    id: 'analytics',
    name: 'Analytics',
    icon: BarChart3,
    color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/30',
    description: 'Google Analytics, Mixpanel, Amplitude',
    examples: ['Google Analytics 4', 'Mixpanel', 'PostHog'],
  },
  {
    id: 'payments',
    name: 'Payments',
    icon: CreditCard,
    color: 'text-green-500 bg-green-100 dark:bg-green-900/30',
    description: 'Stripe, PayPal, Square',
    examples: ['Stripe', 'PayPal', 'Square'],
  },
  {
    id: 'email',
    name: 'Email',
    icon: Mail,
    color: 'text-pink-500 bg-pink-100 dark:bg-pink-900/30',
    description: 'SendGrid, Mailchimp, Resend',
    examples: ['SendGrid', 'Resend', 'Mailchimp'],
  },
  {
    id: 'auth',
    name: 'Authentication',
    icon: Plug,
    color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/30',
    description: 'Auth0, Clerk, NextAuth',
    examples: ['Auth0', 'Clerk', 'Supabase Auth'],
  },
  {
    id: 'database',
    name: 'Database',
    icon: Database,
    color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/30',
    description: 'Supabase, PlanetScale, Neon',
    examples: ['Supabase', 'PlanetScale', 'Neon'],
  },
  {
    id: 'storage',
    name: 'Storage',
    icon: Cloud,
    color: 'text-cyan-500 bg-cyan-100 dark:bg-cyan-900/30',
    description: 'AWS S3, Cloudflare R2, Vercel Blob',
    examples: ['AWS S3', 'Cloudflare R2', 'Uploadthing'],
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    icon: Eye,
    color: 'text-red-500 bg-red-100 dark:bg-red-900/30',
    description: 'Sentry, LogRocket, Datadog',
    examples: ['Sentry', 'LogRocket', 'Datadog'],
  },
];

export function ExternalIntegrationsSection() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">External Integrations</h2>
        <p className="text-muted-foreground">
          Configure third-party services that get automatically injected into builds
        </p>
      </div>

      {/* Service Catalog Link */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Service Catalog</h3>
                <p className="text-sm text-muted-foreground">
                  Manage all external integrations, APIs, MCP servers, and LLM providers
                </p>
              </div>
            </div>
            <Button onClick={() => (window.location.href = '/settings/services')}>
              Open Catalog
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integration Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Integration Types</CardTitle>
          <CardDescription>
            These integration types can be added to your builds via the Service Catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {INTEGRATION_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.id}
                  className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${category.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h4 className="font-medium">{category.name}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {category.examples.map((example) => (
                      <Badge key={example} variant="secondary" className="text-xs">
                        {example}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Integrations Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            When you enable an integration in the Service Catalog, it gets automatically
            injected into new builds:
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Package Installation:</strong> Required npm packages are added to
              package.json
            </li>
            <li>
              <strong>Environment Variables:</strong> Required env vars are documented and
              added to .env.example
            </li>
            <li>
              <strong>Code Injection:</strong> Initialization code is added to the
              appropriate files (layout.tsx, providers, etc.)
            </li>
            <li>
              <strong>Type Definitions:</strong> TypeScript types are configured where needed
            </li>
          </ol>
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
            <p className="text-blue-700 dark:text-blue-300 text-xs">
              <strong>Tip:</strong> You can also enable "Mock Mode" for integrations during
              development to test without real API keys.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
