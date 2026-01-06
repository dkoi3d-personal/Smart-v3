/**
 * Patient Lookup Template
 * Simple patient search and demographics display
 *
 * This template demonstrates:
 * - useEpicConnection hook for connection status
 * - usePatient hook for fetching patient data
 * - PatientCard component for display
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Search,
  Heart,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  User,
  Loader2,
} from 'lucide-react';

// Import Epic hooks and components
import { useEpicConnection, usePatient } from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

// Epic sandbox test patient IDs
const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', fhirId: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', fhirId: 'erXuFYUfucBZaryVksYEcMg3' },
  { name: 'Derrick Lin', fhirId: 'erXuFYUfucBZaryVksYEcMg3' },
  { name: 'Camila Lopez', fhirId: 'eq081-VQEgP8drUUqCWzHfw3' },
];

export default function PatientLookupPage() {
  // State for the patient ID input
  const [patientIdInput, setPatientIdInput] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Epic connection status
  const connection = useEpicConnection();

  // Fetch patient data when ID is selected
  const patient = usePatient(selectedPatientId);

  const handleSearch = () => {
    if (patientIdInput.trim()) {
      setSelectedPatientId(patientIdInput.trim());
    }
  };

  const handleQuickSelect = (fhirId: string) => {
    setPatientIdInput(fhirId);
    setSelectedPatientId(fhirId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/templates/epic">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <Search className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Patient Lookup</h1>
                <p className="text-xs text-muted-foreground">Simple patient search template</p>
              </div>
            </div>
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {connection.loading ? (
                <Badge variant="secondary">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Checking...
                </Badge>
              ) : connection.isConnected ? (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Link href="/settings">
                  <Badge variant="destructive" className="cursor-pointer">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Connection Warning */}
        {!connection.loading && !connection.isConnected && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">Epic Not Connected</p>
                  <p className="text-sm text-yellow-700">
                    Go to{' '}
                    <Link href="/settings" className="underline">
                      Settings
                    </Link>{' '}
                    → Epic Healthcare → Paste Token to connect.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Find Patient
            </CardTitle>
            <CardDescription>
              Enter a FHIR Patient ID to look up patient demographics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Enter FHIR Patient ID (e.g., e63wRTbPfr1p8UW81d8Seiw3)"
                value={patientIdInput}
                onChange={(e) => setPatientIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 font-mono text-sm"
              />
              <Button onClick={handleSearch} disabled={!patientIdInput.trim() || !connection.isConnected}>
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>

            {/* Quick Select - Sandbox Patients */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Quick select (sandbox patients):</p>
              <div className="flex flex-wrap gap-2">
                {SANDBOX_PATIENTS.map((p) => (
                  <Button
                    key={p.fhirId}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSelect(p.fhirId)}
                    disabled={!connection.isConnected}
                    className="text-xs"
                  >
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Result */}
        {selectedPatientId && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Patient Information
            </h2>

            <PatientCard
              patient={patient.data}
              loading={patient.loading}
              error={patient.error}
            />

            {/* Raw Data View */}
            {patient.data && !patient.loading && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Raw FHIR Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-64">
                    {JSON.stringify(patient.data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Code Example */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Code Example
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-black text-green-400 p-4 rounded-lg overflow-auto">
{`// Import the hook and component
import { usePatient } from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

function MyComponent() {
  const [patientId, setPatientId] = useState('e63wRTbPfr1p8UW81d8Seiw3');

  // Fetch patient data
  const { data, loading, error } = usePatient(patientId);

  return (
    <PatientCard
      patient={data}
      loading={loading}
      error={error}
    />
  );
}`}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
