'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Heart, Shield, Database, TestTube, Code2, AlertCircle } from 'lucide-react';

export interface PreBuildAnswers {
  includeEpicAPIs: boolean;
  includeTestPatients: boolean;
  includeFHIRExamples: boolean;
  complianceLevel: 'hipaa' | 'hipaa-hitrust' | 'basic';
  appType: 'patient-facing' | 'clinical' | 'administrative' | 'analytics';
  dataTypes: string[];
}

interface PreBuildQuestionnaireProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (answers: PreBuildAnswers) => void;
  initialSettings?: Partial<PreBuildAnswers>;
}

const DATA_TYPE_OPTIONS = [
  { id: 'patient-demographics', label: 'Patient Demographics', icon: '👤' },
  { id: 'conditions', label: 'Conditions/Diagnoses', icon: '🏥' },
  { id: 'medications', label: 'Medications', icon: '💊' },
  { id: 'allergies', label: 'Allergies', icon: '⚠️' },
  { id: 'lab-results', label: 'Lab Results', icon: '🧪' },
  { id: 'vital-signs', label: 'Vital Signs', icon: '❤️' },
  { id: 'immunizations', label: 'Immunizations', icon: '💉' },
  { id: 'encounters', label: 'Encounters/Visits', icon: '📅' },
  { id: 'procedures', label: 'Procedures', icon: '🔧' },
  { id: 'documents', label: 'Clinical Documents', icon: '📄' },
];

const APP_TYPE_INFO = {
  'patient-facing': {
    label: 'Patient-Facing Portal',
    description: 'Patient access to their own health records',
    compliance: 'Requires patient authentication, consent tracking',
  },
  'clinical': {
    label: 'Clinical Workflow',
    description: 'Tools for healthcare providers during patient care',
    compliance: 'Requires provider authentication, audit logging',
  },
  'administrative': {
    label: 'Administrative/Scheduling',
    description: 'Back-office operations, scheduling, billing',
    compliance: 'Limited PHI access, role-based permissions',
  },
  'analytics': {
    label: 'Analytics/Reporting',
    description: 'Population health, quality metrics, dashboards',
    compliance: 'De-identification may be required, aggregate data',
  },
};

export function PreBuildQuestionnaire({
  open,
  onClose,
  onConfirm,
  initialSettings,
}: PreBuildQuestionnaireProps) {
  const [answers, setAnswers] = useState<PreBuildAnswers>({
    includeEpicAPIs: initialSettings?.includeEpicAPIs ?? true,
    includeTestPatients: initialSettings?.includeTestPatients ?? true,
    includeFHIRExamples: initialSettings?.includeFHIRExamples ?? true,
    complianceLevel: initialSettings?.complianceLevel ?? 'hipaa',
    appType: initialSettings?.appType ?? 'clinical',
    dataTypes: initialSettings?.dataTypes ?? ['patient-demographics', 'conditions', 'medications'],
  });

  // Reset answers when dialog opens with new initial settings
  useEffect(() => {
    if (open && initialSettings) {
      setAnswers({
        includeEpicAPIs: initialSettings.includeEpicAPIs ?? true,
        includeTestPatients: initialSettings.includeTestPatients ?? true,
        includeFHIRExamples: initialSettings.includeFHIRExamples ?? true,
        complianceLevel: initialSettings.complianceLevel ?? 'hipaa',
        appType: initialSettings.appType ?? 'clinical',
        dataTypes: initialSettings.dataTypes ?? ['patient-demographics', 'conditions', 'medications'],
      });
    }
  }, [open, initialSettings]);

  const toggleDataType = (dataTypeId: string) => {
    setAnswers(prev => ({
      ...prev,
      dataTypes: prev.dataTypes.includes(dataTypeId)
        ? prev.dataTypes.filter(id => id !== dataTypeId)
        : [...prev.dataTypes, dataTypeId],
    }));
  };

  const handleConfirm = () => {
    onConfirm(answers);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Healthcare Build Configuration
          </DialogTitle>
          <DialogDescription>
            Configure healthcare-specific options for this build. These settings help the AI agents
            generate compliant, secure code with the right FHIR patterns.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Application Type */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Code2 className="h-4 w-4" />
              What type of healthcare application is this?
            </Label>
            <Select
              value={answers.appType}
              onValueChange={(value: PreBuildAnswers['appType']) =>
                setAnswers(prev => ({ ...prev, appType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(APP_TYPE_INFO).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <div className="font-medium">{info.label}</div>
                      <div className="text-xs text-muted-foreground">{info.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {answers.appType && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                <AlertCircle className="h-3 w-3 inline mr-1" />
                {APP_TYPE_INFO[answers.appType].compliance}
              </div>
            )}
          </div>

          {/* Compliance Level */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Compliance Level
            </Label>
            <Select
              value={answers.complianceLevel}
              onValueChange={(value: PreBuildAnswers['complianceLevel']) =>
                setAnswers(prev => ({ ...prev, complianceLevel: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hipaa">
                  <div>
                    <div className="font-medium">HIPAA</div>
                    <div className="text-xs text-muted-foreground">
                      Standard healthcare privacy & security
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="hipaa-hitrust">
                  <div>
                    <div className="font-medium">HIPAA + HITRUST</div>
                    <div className="text-xs text-muted-foreground">
                      Enhanced security controls for enterprise
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="basic">
                  <div>
                    <div className="font-medium">Basic</div>
                    <div className="text-xs text-muted-foreground">
                      General best practices (non-PHI apps)
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data Types */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              What FHIR resources will this app use?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {DATA_TYPE_OPTIONS.map(option => (
                <div
                  key={option.id}
                  className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    answers.dataTypes.includes(option.id)
                      ? 'bg-primary/10 border-primary'
                      : 'bg-muted/30 border-transparent hover:bg-muted/50'
                  }`}
                  onClick={() => toggleDataType(option.id)}
                >
                  <Checkbox
                    id={option.id}
                    checked={answers.dataTypes.includes(option.id)}
                    onCheckedChange={() => toggleDataType(option.id)}
                  />
                  <span className="text-lg">{option.icon}</span>
                  <Label htmlFor={option.id} className="cursor-pointer text-sm">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Epic Integration Options */}
          <div className="space-y-3 border-t pt-4">
            <Label className="text-base font-semibold flex items-center gap-2">
              <TestTube className="h-4 w-4" />
              Epic FHIR Integration
            </Label>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div className="space-y-1">
                  <Label htmlFor="includeEpicAPIs" className="cursor-pointer">
                    Include Epic API patterns
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add Epic-specific FHIR code examples and authentication patterns
                  </p>
                </div>
                <Checkbox
                  id="includeEpicAPIs"
                  checked={answers.includeEpicAPIs}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setAnswers(prev => ({ ...prev, includeEpicAPIs: checked === true }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div className="space-y-1">
                  <Label htmlFor="includeTestPatients" className="cursor-pointer">
                    Include Epic test patient IDs
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add sandbox patient IDs (Camila Lopez, Jason Argonaut, etc.)
                  </p>
                </div>
                <Checkbox
                  id="includeTestPatients"
                  checked={answers.includeTestPatients}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setAnswers(prev => ({ ...prev, includeTestPatients: checked === true }))
                  }
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div className="space-y-1">
                  <Label htmlFor="includeFHIRExamples" className="cursor-pointer">
                    Include FHIR code examples
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add TypeScript examples for fetching patients, conditions, medications
                  </p>
                </div>
                <Checkbox
                  id="includeFHIRExamples"
                  checked={answers.includeFHIRExamples}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    setAnswers(prev => ({ ...prev, includeFHIRExamples: checked === true }))
                  }
                />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-4 rounded-lg border border-blue-500/20">
            <div className="font-medium mb-2">Build Configuration Summary</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-background">
                {APP_TYPE_INFO[answers.appType].label}
              </Badge>
              <Badge variant="outline" className="bg-background">
                {answers.complianceLevel.toUpperCase()}
              </Badge>
              {answers.includeEpicAPIs && (
                <Badge variant="outline" className="bg-background text-blue-500">
                  Epic APIs
                </Badge>
              )}
              {answers.includeTestPatients && (
                <Badge variant="outline" className="bg-background text-green-500">
                  Test Patients
                </Badge>
              )}
              <Badge variant="outline" className="bg-background">
                {answers.dataTypes.length} FHIR resources
              </Badge>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-gradient-to-r from-red-500 to-pink-500">
            <Heart className="h-4 w-4 mr-2" />
            Start Healthcare Build
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
