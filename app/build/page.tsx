'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ProjectLaunchOverlay } from '@/components/ProjectLaunchOverlay';
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Shield,
  Figma,
  FileText,
  ExternalLink,
  Upload,
  CheckCircle2,
  X,
  Layers,
  Bot,
  CheckCircle,
  HeartPulse,
  Sparkles,
} from 'lucide-react';

type ComplianceMode = 'standard' | 'hipaa';
type BuildSource = 'text' | 'figma';

export default function NewClinicalBuild() {
  const router = useRouter();
  const [projectName, setProjectName] = useState('');
  const [requirements, setRequirements] = useState('');
  const [figmaUrl, setFigmaUrl] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null);
  const [buildSource, setBuildSource] = useState<BuildSource>('text');
  const [figmaConfigured, setFigmaConfigured] = useState(false);
  const [figmaUser, setFigmaUser] = useState<{ email: string; handle?: string } | null>(null);
  const [figmaContext, setFigmaContext] = useState('');
  const [complianceMode, setComplianceMode] = useState<ComplianceMode>('standard');
  const [useTemplates, setUseTemplates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string | null>(null);
  const [contextDocuments, setContextDocuments] = useState<Array<{ name: string; text: string; size: number }>>([]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setExtractionStatus(null);

    try {
      const fileType = file.name.toLowerCase();
      if (fileType.endsWith('.doc') && !fileType.endsWith('.docx')) {
        alert(`The older .doc format is not supported. Please convert "${file.name}" to .docx format first.`);
        setIsProcessingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      let extractedText = '';
      if (fileType.endsWith('.pdf') || fileType.endsWith('.docx')) {
        setExtractionStatus(`Extracting text from ${file.name}...`);
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to extract text from document');
        }
        const { text } = await response.json();
        extractedText = text || '';
      } else {
        extractedText = await file.text();
      }

      if (extractedText.trim()) {
        setContextDocuments(prev => [...prev, { name: file.name, text: extractedText, size: file.size }]);
        setExtractionStatus(`Added "${file.name}" as context (${extractedText.length.toLocaleString()} chars)`);
      } else {
        alert(`No text could be extracted from ${file.name}.`);
      }
    } catch (err) {
      console.error('Error processing file:', err);
      alert(`Failed to process file: ${file.name}. ${err instanceof Error ? err.message : ''}`);
      setExtractionStatus(null);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setExtractionStatus(null), 5000);
    }
  }, []);

  const removeContextDocument = useCallback((index: number) => {
    setContextDocuments(prev => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    const checkFigmaStatus = async () => {
      try {
        const response = await fetch('/api/settings/figma');
        if (response.ok) {
          const data = await response.json();
          const isConfigured = data.configured || data.hasEnvToken;
          setFigmaConfigured(isConfigured);
          if (isConfigured) {
            const filesResponse = await fetch('/api/figma/files');
            if (filesResponse.ok) {
              const filesData = await filesResponse.json();
              setFigmaUser(filesData.user || null);
            }
          }
        }
      } catch {
        // Figma not configured
      }
    };
    checkFigmaStatus();
  }, []);

  const handleStart = async () => {
    if (!projectName.trim()) return;
    if (buildSource === 'text' && !requirements.trim() && contextDocuments.length === 0) return;
    if (buildSource === 'figma' && !figmaUrl.trim()) return;

    setIsLaunching(true);

    try {
      const requestBody: Record<string, unknown> = {
        projectName: projectName.trim(),
        useMockData: true,
        complianceMode: complianceMode === 'hipaa' ? 'hipaa' : 'generic',
        useTemplates,
      };

      if (buildSource === 'figma' && figmaUrl.trim()) {
        requestBody.figmaUrl = figmaUrl.trim();
        requestBody.source = 'figma';
        if (figmaContext.trim()) {
          requestBody.figmaContext = figmaContext.trim();
        }
        if (contextDocuments.length > 0) {
          const contextText = contextDocuments
            .map(doc => `\n\n---\n\n# Context Document: ${doc.name}\n\n${doc.text}`)
            .join('');
          requestBody.figmaContext = (requestBody.figmaContext || '') + contextText;
        }
      } else {
        let fullRequirements = requirements.trim();
        if (contextDocuments.length > 0) {
          const contextText = contextDocuments
            .map(doc => `\n\n---\n\n# Context Document: ${doc.name}\n\n${doc.text}`)
            .join('');
          fullRequirements = fullRequirements + contextText;
        }
        requestBody.requirements = fullRequirements;
        requestBody.source = 'text';
      }

      const response = await fetch('/api/v2/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setPendingProjectId(data.projectId);
      } else {
        setIsLaunching(false);
        if (buildSource === 'figma' && data.details) {
          setFigmaError(data.details);
        } else {
          setFigmaError(data.error || 'Failed to start project');
        }
      }
    } catch {
      setIsLaunching(false);
      setFigmaError('Error starting project. Please check your connection and try again.');
    }
  };

  useEffect(() => {
    if (pendingProjectId) {
      const timer = setTimeout(() => {
        router.push(`/build/${pendingProjectId}?autoStart=true`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [pendingProjectId, router]);

  return (
    <>
      <ProjectLaunchOverlay isVisible={isLaunching} projectName={projectName} />

      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 relative">
        {/* Header */}
        <header className="border-b border-white/10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="icon" className="text-white/70 hover:text-white hover:bg-white/10">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-blue-400" />
                <h1 className="text-xl font-bold text-white">New Clinical Build</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">Multi-Agent</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <Sparkles className="h-3 w-3 mr-1" />
                5 AI Agents
              </Badge>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="border-blue-500/30 bg-slate-900/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bot className="h-5 w-5 text-blue-400" />
                Clinical Application Builder
              </CardTitle>
              <CardDescription className="text-white/60">
                Build full-featured healthcare apps with EHR integration, security scanning, and HIPAA compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Project Name */}
              <div>
                <label className="text-sm font-medium mb-2 block text-white">Project Name</label>
                <Input
                  placeholder="My Healthcare App..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="text-lg bg-slate-800 border-white/20 text-white placeholder:text-white/40"
                />
              </div>

              {/* Build Source Selector */}
              <div>
                <label className="text-sm font-medium mb-2 block text-white">Build Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setBuildSource('text'); setFigmaError(null); }}
                    className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                      buildSource === 'text'
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-white/20 hover:border-blue-500/50'
                    }`}
                  >
                    <FileText className={`h-5 w-5 ${buildSource === 'text' ? 'text-blue-400' : 'text-white/60'}`} />
                    <div className="text-left">
                      <div className={`font-medium text-sm ${buildSource === 'text' ? 'text-white' : 'text-white/80'}`}>Text Requirements</div>
                      <div className="text-xs text-white/50">Describe what to build</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBuildSource('figma'); setFigmaError(null); }}
                    className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                      buildSource === 'figma'
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-white/20 hover:border-purple-500/50'
                    }`}
                  >
                    <Figma className={`h-5 w-5 ${buildSource === 'figma' ? 'text-purple-400' : 'text-white/60'}`} />
                    <div className="text-left">
                      <div className={`font-medium text-sm ${buildSource === 'figma' ? 'text-white' : 'text-white/80'}`}>Figma Design</div>
                      <div className="text-xs text-white/50">Build from design</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Compliance Mode */}
              <div>
                <label className="text-sm font-medium mb-2 block text-white">Compliance Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setComplianceMode('standard')}
                    className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                      complianceMode === 'standard'
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-white/20 hover:border-blue-500/50'
                    }`}
                  >
                    <Shield className={`h-5 w-5 ${complianceMode === 'standard' ? 'text-blue-400' : 'text-white/60'}`} />
                    <div className="text-left">
                      <div className={`font-medium text-sm ${complianceMode === 'standard' ? 'text-white' : 'text-white/80'}`}>Standard</div>
                      <div className="text-xs text-white/50">General purpose app</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setComplianceMode('hipaa')}
                    className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-all ${
                      complianceMode === 'hipaa'
                        ? 'border-emerald-500 bg-emerald-500/20'
                        : 'border-white/20 hover:border-emerald-500/50'
                    }`}
                  >
                    <ShieldCheck className={`h-5 w-5 ${complianceMode === 'hipaa' ? 'text-emerald-400' : 'text-white/60'}`} />
                    <div className="text-left">
                      <div className={`font-medium text-sm ${complianceMode === 'hipaa' ? 'text-white' : 'text-white/80'}`}>HIPAA</div>
                      <div className="text-xs text-white/50">Healthcare compliance</div>
                    </div>
                  </button>
                </div>
                {complianceMode === 'hipaa' && (
                  <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Includes audit logging, PHI protection, role-based access, and session security
                  </p>
                )}
              </div>

              {/* Templates Toggle */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">Feature Templates</label>
                  <button
                    type="button"
                    onClick={() => setUseTemplates(!useTemplates)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useTemplates ? 'bg-purple-600' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useTemplates ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
                <p className="text-xs text-white/50 mt-1">
                  {useTemplates ? (
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3 text-purple-400" />
                      Pre-built templates will scaffold auth, database, and UI components
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400">
                      <X className="h-3 w-3" />
                      Templates disabled - build from scratch
                    </span>
                  )}
                </p>
              </div>

              {/* Text Requirements Input */}
              {buildSource === 'text' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white">What do you want to build?</label>
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx" onChange={handleFileUpload} className="hidden" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingFile}
                        className="h-7 px-2 text-xs border-white/20 text-white/70 hover:bg-white/10"
                      >
                        {isProcessingFile ? (
                          <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Extracting...</>
                        ) : (
                          <><Upload className="h-3 w-3 mr-1" />Upload Doc</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Textarea
                    placeholder="A claims management dashboard where adjusters can review claims, track status, and manage documentation..."
                    value={requirements}
                    onChange={(e) => setRequirements(e.target.value)}
                    className="min-h-[150px] text-base bg-slate-800 border-white/20 text-white placeholder:text-white/40"
                  />
                  {contextDocuments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {contextDocuments.map((doc, index) => (
                        <div key={index} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/20 border border-blue-500/30">
                          <FileText className="h-4 w-4 text-blue-400" />
                          <div className="flex flex-col">
                            <span className="text-xs text-blue-300 font-medium">{doc.name}</span>
                            <span className="text-[10px] text-blue-400/70">{doc.text.length.toLocaleString()} chars</span>
                          </div>
                          <button onClick={() => removeContextDocument(index)} className="ml-1 text-blue-400 hover:text-blue-300">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {extractionStatus && (
                    <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-md mt-2 bg-green-500/20 text-green-400 border border-green-500/30">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {extractionStatus}
                    </div>
                  )}
                </div>
              )}

              {/* Figma URL Input */}
              {buildSource === 'figma' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2 text-white">
                      <Figma className="h-4 w-4 text-purple-400" />
                      Figma File or Frame URL
                      {figmaConfigured && figmaUser && (
                        <Badge variant="outline" className="ml-auto text-xs font-normal text-purple-400 border-purple-500/30">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {figmaUser.email}
                        </Badge>
                      )}
                    </label>
                    <Input
                      placeholder="https://www.figma.com/design/abc123..."
                      value={figmaUrl}
                      onChange={(e) => { setFigmaUrl(e.target.value); setFigmaError(null); }}
                      className="text-base font-mono bg-slate-800 border-white/20 text-white placeholder:text-white/40"
                    />
                    {figmaError && (
                      <div className="mt-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                        <p className="text-sm text-red-400 whitespace-pre-wrap">{figmaError}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block text-white">Build Context (Optional)</label>
                    <Textarea
                      placeholder="Describe how you want the app to work..."
                      value={figmaContext}
                      onChange={(e) => setFigmaContext(e.target.value)}
                      className="min-h-[100px] text-sm bg-slate-800 border-white/20 text-white placeholder:text-white/40"
                    />
                  </div>

                  {!figmaConfigured && (
                    <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Link href="/settings" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                          Configure Figma in Settings <ArrowRight className="h-3 w-3" />
                        </Link>
                        <span className="text-xs text-white/40">|</span>
                        <a href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens" target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                          Get a token <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mock-first Notice */}
              <div className="p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-blue-300">Fast Iteration Mode</span>
                </div>
                <p className="text-xs text-white/60 mt-1">
                  Apps are built with mock data for rapid testing. When ready for production,
                  we&apos;ll provision a real database.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                size="lg"
                className={`w-full ${buildSource === 'figma' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                disabled={
                  !projectName.trim() ||
                  isLaunching ||
                  (buildSource === 'text' && !requirements.trim() && contextDocuments.length === 0) ||
                  (buildSource === 'figma' && !figmaUrl.trim())
                }
                onClick={handleStart}
              >
                {isLaunching ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{buildSource === 'figma' ? 'Extracting design...' : 'Setting up environment...'}</>
                ) : buildSource === 'figma' ? (
                  <><Figma className="mr-2 h-5 w-5" />Build from Figma <ArrowRight className="ml-2 h-5 w-5" /></>
                ) : (
                  <><Bot className="mr-2 h-5 w-5" />Start Clinical Build <ArrowRight className="ml-2 h-5 w-5" /></>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Example Templates */}
          <div className="mt-8">
            <h3 className="text-sm font-medium text-white/50 mb-4 text-center">Quick Start Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'Epic Patient Dashboard', desc: 'Full patient dashboard using Epic FHIR APIs' },
                { name: 'Patient Rounding Tool', desc: 'Track patient rounds, vitals, and care notes' },
                { name: 'Nurse Handoff Dashboard', desc: 'Structured handoff reports with SBAR format' },
                { name: 'Fall Risk Assessment', desc: 'Morse Fall Scale calculator with scoring' },
              ].map((example) => (
                <button
                  key={example.name}
                  onClick={() => { setProjectName(example.name); setRequirements(example.desc); }}
                  className="p-3 text-left border border-white/10 rounded-lg hover:bg-white/5 hover:border-white/20 transition-colors"
                >
                  <div className="font-medium text-sm text-white flex items-center gap-2">
                    <HeartPulse className="h-4 w-4 text-emerald-400" />
                    {example.name}
                  </div>
                  <div className="text-xs text-white/50 mt-1">{example.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
