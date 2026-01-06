/**
 * PatientCard Component
 * Displays patient demographics in a compact card format
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Phone, Mail, MapPin, Heart } from 'lucide-react';
import { formatPatientName, calculateAge, type Patient } from '@/lib/epic-fhir';
import { cn } from '@/lib/utils';

interface PatientCardProps {
  patient: Patient | null;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

export function PatientCard({
  patient,
  loading = false,
  error = null,
  compact = false,
  className,
  onClick,
}: PatientCardProps) {
  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className={compact ? 'pb-2' : ''}>
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </CardHeader>
        {!compact && (
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-red-200 bg-red-50', className)}>
        <CardContent className="py-4">
          <p className="text-red-600 text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!patient) {
    return (
      <Card className={cn('', className)}>
        <CardContent className="py-8 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No patient selected</p>
        </CardContent>
      </Card>
    );
  }

  const name = formatPatientName(patient);
  const age = patient.birthDate ? calculateAge(patient.birthDate) : null;
  const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
  const email = patient.telecom?.find(t => t.system === 'email')?.value;
  const address = patient.address?.[0];

  const genderColors: Record<string, string> = {
    male: 'bg-blue-100 text-blue-700',
    female: 'bg-pink-100 text-pink-700',
    other: 'bg-purple-100 text-purple-700',
    unknown: 'bg-gray-100 text-gray-700',
  };

  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer hover:border-primary/50 transition-colors',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className={compact ? 'pb-2' : ''}>
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{name}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              {patient.gender && (
                <Badge className={cn('text-xs', genderColors[patient.gender] || genderColors.unknown)}>
                  {patient.gender}
                </Badge>
              )}
              {age !== null && (
                <Badge variant="outline" className="text-xs">
                  {age} years old
                </Badge>
              )}
              {patient.active === false && (
                <Badge variant="destructive" className="text-xs">Inactive</Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      {!compact && (
        <CardContent className="pt-0">
          <div className="space-y-2 text-sm">
            {patient.birthDate && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Born: {new Date(patient.birthDate).toLocaleDateString()}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{phone}</span>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{email}</span>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {[address.line?.join(', '), address.city, address.state, address.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
            {patient.maritalStatus?.text && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Heart className="h-4 w-4" />
                <span>{patient.maritalStatus.text}</span>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Simple skeleton component for loading states
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted rounded', className)} />;
}
