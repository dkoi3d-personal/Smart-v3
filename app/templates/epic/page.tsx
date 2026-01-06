/**
 * Epic FHIR Templates Index
 * Browse and use healthcare app templates
 */

'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Heart,
  User,
  LayoutDashboard,
  Search,
  FileText,
  Brain,
  ExternalLink,
  Code,
} from 'lucide-react';

const templates = [
  {
    id: 'patient-lookup',
    title: 'Patient Lookup',
    description: 'Search and view patient demographics. Simple single-page app.',
    complexity: 'Simple',
    icon: Search,
    features: ['Patient search', 'Demographics display', 'Basic hooks usage'],
    href: '/templates/epic/patient-lookup',
  },
  {
    id: 'patient-dashboard',
    title: 'Patient Dashboard',
    description: 'Comprehensive patient view with vitals, conditions, medications, and allergies.',
    complexity: 'Medium',
    icon: LayoutDashboard,
    features: ['All patient data', 'Multiple components', 'Real-time updates'],
    href: '/templates/epic/patient-dashboard',
  },
  {
    id: 'clinical-summary',
    title: 'Clinical Summary',
    description: 'AI-powered patient summary with Claude integration for intelligent insights.',
    complexity: 'Complex',
    icon: Brain,
    features: ['AI summarization', 'Claude integration', 'Clinical insights'],
    href: '/templates/epic/clinical-summary',
  },
];

export default function EpicTemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <Heart className="h-6 w-6 text-red-500" />
            <div>
              <h1 className="text-xl font-bold">Epic FHIR Templates</h1>
              <p className="text-sm text-muted-foreground">
                Ready-to-use healthcare application templates
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Quick Start Guide */}
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Code className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-700">Quick Start</h3>
                <p className="text-sm text-blue-600 mt-1">
                  Before using these templates, make sure you have an Epic Bearer token configured.
                  Go to <Link href="/settings" className="underline">Settings</Link> → Epic Healthcare → Paste Token.
                </p>
                <div className="mt-3 p-3 bg-black/80 rounded-lg text-white text-xs font-mono">
                  <p className="text-gray-400">// Import Epic hooks and components</p>
                  <p>{`import { usePatient, usePatientSummary } from '@/lib/epic-fhir';`}</p>
                  <p>{`import { PatientCard, VitalSignsCard } from '@/components/epic';`}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const Icon = template.icon;
            return (
              <Card key={template.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge
                      variant={
                        template.complexity === 'Simple'
                          ? 'secondary'
                          : template.complexity === 'Medium'
                          ? 'default'
                          : 'destructive'
                      }
                    >
                      {template.complexity}
                    </Badge>
                  </div>
                  <CardTitle className="mt-3">{template.title}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {template.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <Link href={template.href}>
                      <Button className="w-full" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open Template
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* API Reference */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Available Hooks & Components
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">React Hooks</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">useEpicConnection()</code> - Connection status & token management</li>
                  <li><code className="bg-muted px-1 rounded">usePatient(id)</code> - Fetch patient by FHIR ID</li>
                  <li><code className="bg-muted px-1 rounded">usePatientSearch(term)</code> - Search patients by name</li>
                  <li><code className="bg-muted px-1 rounded">useVitalSigns(patientId)</code> - Get vital signs</li>
                  <li><code className="bg-muted px-1 rounded">useLabResults(patientId)</code> - Get lab results</li>
                  <li><code className="bg-muted px-1 rounded">useConditions(patientId)</code> - Get conditions/diagnoses</li>
                  <li><code className="bg-muted px-1 rounded">useMedications(patientId)</code> - Get medications</li>
                  <li><code className="bg-muted px-1 rounded">useAllergies(patientId)</code> - Get allergies</li>
                  <li><code className="bg-muted px-1 rounded">useEncounters(patientId)</code> - Get encounters</li>
                  <li><code className="bg-muted px-1 rounded">useImmunizations(patientId)</code> - Get immunizations</li>
                  <li><code className="bg-muted px-1 rounded">usePatientSummary(patientId)</code> - All data at once</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">UI Components</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">{`<PatientCard />`}</code> - Patient demographics card</li>
                  <li><code className="bg-muted px-1 rounded">{`<VitalSignsCard />`}</code> - Vital signs display</li>
                  <li><code className="bg-muted px-1 rounded">{`<MedicationsList />`}</code> - Medications list</li>
                  <li><code className="bg-muted px-1 rounded">{`<ConditionsList />`}</code> - Conditions/diagnoses list</li>
                  <li><code className="bg-muted px-1 rounded">{`<AllergiesList />`}</code> - Allergies list</li>
                </ul>
                <h4 className="font-medium mt-4 mb-2">Utility Functions</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><code className="bg-muted px-1 rounded">formatPatientName(patient)</code></li>
                  <li><code className="bg-muted px-1 rounded">calculateAge(birthDate)</code></li>
                  <li><code className="bg-muted px-1 rounded">formatFHIRDate(date)</code></li>
                  <li><code className="bg-muted px-1 rounded">getCodeableConceptDisplay(concept)</code></li>
                  <li><code className="bg-muted px-1 rounded">extractBundleResources(bundle)</code></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
