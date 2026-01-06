/**
 * AI Clinical Summary Template
 * Uses Claude to generate intelligent patient summaries
 *
 * This template demonstrates:
 * - Integration with Claude AI for clinical insights
 * - Complex data aggregation from Epic FHIR
 * - Structured summary generation
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Brain,
  Heart,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  User,
  Loader2,
  Sparkles,
  FileText,
  Copy,
  Check,
} from 'lucide-react';

// Import Epic hooks
import {
  useEpicConnection,
  usePatientSummary,
  formatPatientName,
  getCodeableConceptDisplay,
  formatFHIRDate,
} from '@/lib/epic-fhir';
import { PatientCard } from '@/components/epic';

// Sandbox patients
const SANDBOX_PATIENTS = [
  { name: 'Theodore Mychart', fhirId: 'e63wRTbPfr1p8UW81d8Seiw3' },
  { name: 'Camila Lopez', fhirId: 'erXuFYUfucBZaryVksYEcMg3' },
  { name: 'Derrick Lin', fhirId: 'erXuFYUfucBZaryVksYEcMg3' },
];

export default function ClinicalSummaryPage() {
  const [patientIdInput, setPatientIdInput] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const connection = useEpicConnection();
  const { data: summary, loading, errors, refetch } = usePatientSummary(selectedPatientId);

  const handleSearch = () => {
    if (patientIdInput.trim()) {
      setSelectedPatientId(patientIdInput.trim());
      setAiSummary(null);
    }
  };

  const handleQuickSelect = (fhirId: string) => {
    setPatientIdInput(fhirId);
    setSelectedPatientId(fhirId);
    setAiSummary(null);
  };

  // Generate AI summary using the collected patient data
  const generateAISummary = async () => {
    if (!summary.patient) return;

    setGenerating(true);
    try {
      // Build a structured prompt with patient data
      const patientData = buildPatientDataPrompt(summary);

      // Call Claude API (through our backend)
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clinical-summary',
          data: patientData,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAiSummary(result.summary);
      } else {
        // Fallback: Generate a basic summary locally
        setAiSummary(generateLocalSummary(summary));
      }
    } catch (error) {
      // Fallback to local summary
      setAiSummary(generateLocalSummary(summary));
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (aiSummary) {
      await navigator.clipboard.writeText(aiSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/templates/epic">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Templates
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <Brain className="h-5 w-5 text-purple-500" />
              <div>
                <h1 className="text-lg font-bold">AI Clinical Summary</h1>
                <p className="text-xs text-muted-foreground">Intelligent patient insights</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connection.isConnected ? (
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

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Patient Selector */}
        <Card>
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
                  Load
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
              <Brain className="h-16 w-16 mx-auto text-purple-300 mb-4" />
              <h2 className="text-xl font-semibold mb-2">AI-Powered Clinical Summaries</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Select a patient to generate an intelligent clinical summary using AI.
                The summary includes conditions, medications, allergies, and clinical insights.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Patient Data & Summary */}
        {selectedPatientId && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Patient Info */}
            <div className="space-y-4">
              <PatientCard
                patient={summary.patient}
                loading={loading && !summary.patient}
                error={errors.patient}
              />

              {/* Data Stats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Clinical Data Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Active Conditions:</span>
                      <Badge variant="secondary">{summary.conditions.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Medications:</span>
                      <Badge variant="secondary">{summary.medications.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Allergies:</span>
                      <Badge variant="secondary">{summary.allergies.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vital Signs:</span>
                      <Badge variant="secondary">{summary.vitalSigns.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Encounters:</span>
                      <Badge variant="secondary">{summary.recentEncounters.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Immunizations:</span>
                      <Badge variant="secondary">{summary.immunizations.length}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Generate Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={generateAISummary}
                disabled={generating || loading || !summary.patient}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Generating Summary...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Generate AI Summary
                  </>
                )}
              </Button>
            </div>

            {/* Right: AI Summary */}
            <div>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-purple-500" />
                      Clinical Summary
                    </CardTitle>
                    {aiSummary && (
                      <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                        {copied ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                  <CardDescription>
                    AI-generated summary based on patient&apos;s clinical data
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {aiSummary ? (
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg">
                        {aiSummary}
                      </div>
                    </div>
                  ) : generating ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-purple-500 mb-4" />
                      <p className="text-muted-foreground">Analyzing clinical data...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Click &quot;Generate AI Summary&quot; to create an intelligent clinical summary
                        based on the patient&apos;s data.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Code Example */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Integration Example
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-black text-green-400 p-4 rounded-lg overflow-auto">
{`// Fetch all patient data at once
const { data: summary } = usePatientSummary(patientId);

// Build prompt for Claude
const prompt = \`
Summarize this patient's clinical status:

Patient: \${summary.patient.displayName}, \${summary.patient.age} years old

Conditions: \${summary.conditions.map(c => c.code?.text).join(', ')}

Medications: \${summary.medications.map(m => m.medicationReference?.display || m.medicationCodeableConcept?.text).join(', ')}

Allergies: \${summary.allergies.map(a => a.code?.text).join(', ')}
\`;

// Call Claude API
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: prompt }],
});`}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Helper: Build structured patient data for AI prompt
function buildPatientDataPrompt(summary: any): string {
  const patient = summary.patient;
  if (!patient) return '';

  let prompt = `## Patient Information
- Name: ${patient.displayName}
- Age: ${patient.age} years old
- Gender: ${patient.gender || 'Unknown'}
- DOB: ${patient.birthDate || 'Unknown'}

`;

  if (summary.conditions.length > 0) {
    prompt += `## Active Conditions (${summary.conditions.length})
${summary.conditions.map((c: any) => `- ${getCodeableConceptDisplay(c.code)}`).join('\n')}

`;
  }

  if (summary.medications.length > 0) {
    prompt += `## Current Medications (${summary.medications.length})
${summary.medications.map((m: any) => {
  const name = m.medicationReference?.display ||
    (m.medicationCodeableConcept ? getCodeableConceptDisplay(m.medicationCodeableConcept) : null) ||
    'Unknown';
  const dosage = m.dosageInstruction?.[0]?.text || '';
  return `- ${name}${dosage ? ` (${dosage})` : ''}`;
}).join('\n')}

`;
  }

  if (summary.allergies.length > 0) {
    prompt += `## Known Allergies (${summary.allergies.length})
${summary.allergies.map((a: any) => {
  const name = getCodeableConceptDisplay(a.code);
  const severity = a.criticality || '';
  return `- ${name}${severity ? ` [${severity}]` : ''}`;
}).join('\n')}

`;
  }

  if (summary.vitalSigns.length > 0) {
    prompt += `## Recent Vital Signs
${summary.vitalSigns.slice(0, 5).map((v: any) => {
  const name = getCodeableConceptDisplay(v.code);
  const value = v.valueQuantity
    ? `${v.valueQuantity.value} ${v.valueQuantity.unit || ''}`
    : v.valueString || 'N/A';
  return `- ${name}: ${value}`;
}).join('\n')}

`;
  }

  return prompt;
}

// Fallback: Generate summary locally without AI
function generateLocalSummary(summary: any): string {
  const patient = summary.patient;
  if (!patient) return 'Unable to generate summary - no patient data available.';

  let text = `CLINICAL SUMMARY
================

PATIENT: ${patient.displayName}
Age: ${patient.age} years | Gender: ${patient.gender || 'Unknown'}
DOB: ${patient.birthDate || 'Unknown'}

`;

  if (summary.conditions.length > 0) {
    text += `ACTIVE CONDITIONS (${summary.conditions.length}):
${summary.conditions.map((c: any) => `• ${getCodeableConceptDisplay(c.code)}`).join('\n')}

`;
  } else {
    text += `ACTIVE CONDITIONS: None documented

`;
  }

  if (summary.medications.length > 0) {
    text += `CURRENT MEDICATIONS (${summary.medications.length}):
${summary.medications.map((m: any) => {
  const name = m.medicationReference?.display ||
    (m.medicationCodeableConcept ? getCodeableConceptDisplay(m.medicationCodeableConcept) : null) ||
    'Unknown Medication';
  return `• ${name}`;
}).join('\n')}

`;
  } else {
    text += `CURRENT MEDICATIONS: None documented

`;
  }

  if (summary.allergies.length > 0) {
    const highRisk = summary.allergies.filter((a: any) => a.criticality === 'high');
    text += `ALLERGIES (${summary.allergies.length}${highRisk.length > 0 ? `, ${highRisk.length} HIGH RISK` : ''}):
${summary.allergies.map((a: any) => {
  const name = getCodeableConceptDisplay(a.code);
  const risk = a.criticality === 'high' ? ' ⚠️ HIGH RISK' : '';
  return `• ${name}${risk}`;
}).join('\n')}

`;
  } else {
    text += `ALLERGIES: No known allergies documented

`;
  }

  text += `---
Summary generated: ${new Date().toLocaleString()}
Data source: Epic FHIR R4 API`;

  return text;
}
