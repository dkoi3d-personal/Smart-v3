/**
 * Patient Dashboard Template
 * Comprehensive patient view with all clinical data
 *
 * This template demonstrates:
 * - usePatientSummary hook for fetching all patient data
 * - Multiple Epic components working together
 * - Real-time data refresh
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  LayoutDashboard,
  Heart,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  User,
  Loader2,
  Activity,
  Pill,
  Stethoscope,
  AlertTriangle,
  Calendar,
  Syringe,
} from 'lucide-react';

// Import Epic hooks and components
import { useEpicConnection, usePatientSummary } from '@/lib/epic-fhir';
import {
  PatientCard,
  VitalSignsCard,
  MedicationsList,
  ConditionsList,
  AllergiesList,
} from '@/components/epic';

// Epic sandbox test patient IDs
const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', fhirId: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', fhirId: 'erXuFYUfucBZaryVksYEcMg3' },
  { name: 'Derrick Lin', fhirId: 'erXuFYUfucBZaryVksYEcMg3' },
  { name: 'Camila Lopez', fhirId: 'eq081-VQEgP8drUUqCWzHfw3' },
];

export default function PatientDashboardPage() {
  const [patientIdInput, setPatientIdInput] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Epic connection status
  const connection = useEpicConnection();

  // Fetch ALL patient data at once
  const { data: summary, loading, errors, refetch } = usePatientSummary(selectedPatientId);

  const handleSearch = () => {
    if (patientIdInput.trim()) {
      setSelectedPatientId(patientIdInput.trim());
    }
  };

  const handleQuickSelect = (fhirId: string) => {
    setPatientIdInput(fhirId);
    setSelectedPatientId(fhirId);
  };

  // Check if any errors occurred
  const hasErrors = Object.values(errors).some(e => e !== null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/templates/epic">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <div>
                <h1 className="text-lg font-bold">Patient Dashboard</h1>
                <p className="text-xs text-muted-foreground">Comprehensive patient view</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedPatientId && (
                <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              )}
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

      <main className="max-w-7xl mx-auto p-4">
        {/* Patient Selector */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex gap-2 flex-1">
                <Input
                  placeholder="Enter FHIR Patient ID"
                  value={patientIdInput}
                  onChange={(e) => setPatientIdInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 font-mono text-sm"
                />
                <Button onClick={handleSearch} disabled={!patientIdInput.trim() || !connection.isConnected}>
                  Load Patient
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {SANDBOX_PATIENTS.map((p) => (
                  <Button
                    key={p.fhirId}
                    variant={selectedPatientId === p.fhirId ? 'default' : 'outline'}
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

        {/* No Patient Selected */}
        {!selectedPatientId && (
          <Card className="py-12">
            <CardContent className="text-center">
              <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Select a Patient</h2>
              <p className="text-muted-foreground">
                Enter a FHIR Patient ID or select a sandbox patient to view their dashboard.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Patient Dashboard */}
        {selectedPatientId && (
          <div className="space-y-6">
            {/* Patient Header */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <PatientCard
                  patient={summary.patient}
                  loading={loading && !summary.patient}
                  error={errors.patient}
                />
              </div>
              <div className="md:col-span-2">
                <VitalSignsCard
                  vitals={summary.vitalSigns}
                  loading={loading && summary.vitalSigns.length === 0}
                  error={errors.vitalSigns}
                />
              </div>
            </div>

            {/* Data Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.conditions.length}</p>
                    <p className="text-xs text-muted-foreground">Conditions</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.medications.length}</p>
                    <p className="text-xs text-muted-foreground">Medications</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.allergies.length}</p>
                    <p className="text-xs text-muted-foreground">Allergies</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.recentEncounters.length}</p>
                    <p className="text-xs text-muted-foreground">Encounters</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Syringe className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{summary.immunizations.length}</p>
                    <p className="text-xs text-muted-foreground">Immunizations</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="conditions" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="conditions" className="flex items-center gap-1">
                  <Stethoscope className="h-4 w-4" />
                  Conditions
                </TabsTrigger>
                <TabsTrigger value="medications" className="flex items-center gap-1">
                  <Pill className="h-4 w-4" />
                  Medications
                </TabsTrigger>
                <TabsTrigger value="allergies" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Allergies
                </TabsTrigger>
                <TabsTrigger value="encounters" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Encounters
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conditions" className="mt-4">
                <ConditionsList
                  conditions={summary.conditions}
                  loading={loading && summary.conditions.length === 0}
                  error={errors.conditions}
                  maxHeight="500px"
                />
              </TabsContent>

              <TabsContent value="medications" className="mt-4">
                <MedicationsList
                  medications={summary.medications}
                  loading={loading && summary.medications.length === 0}
                  error={errors.medications}
                  maxHeight="500px"
                />
              </TabsContent>

              <TabsContent value="allergies" className="mt-4">
                <AllergiesList
                  allergies={summary.allergies}
                  loading={loading && summary.allergies.length === 0}
                  error={errors.allergies}
                  maxHeight="500px"
                />
              </TabsContent>

              <TabsContent value="encounters" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-purple-500" />
                      Recent Encounters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {summary.recentEncounters.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No encounters on record</p>
                    ) : (
                      <div className="space-y-3">
                        {summary.recentEncounters.map((encounter, i) => (
                          <div key={encounter.id || i} className="p-3 rounded-lg border">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">
                                  {encounter.type?.[0]?.text || encounter.class?.display || 'Encounter'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Status: {encounter.status}
                                </p>
                              </div>
                              {encounter.period?.start && (
                                <Badge variant="outline" className="text-xs">
                                  {new Date(encounter.period.start).toLocaleDateString()}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
