/**
 * AI Summarization API
 * Uses Claude to generate intelligent summaries of clinical data
 */

import { NextRequest, NextResponse } from 'next/server';

// System prompts for different summary types
const SYSTEM_PROMPTS: Record<string, string> = {
  'clinical-summary': `You are a clinical documentation specialist. Generate a clear, professional clinical summary based on the provided patient data.

Guidelines:
- Use clear, professional medical language
- Highlight any critical information (high-risk allergies, concerning conditions)
- Organize information logically
- Keep the summary concise but comprehensive
- Note any potential drug interactions or concerns
- Do not make diagnoses or treatment recommendations
- Format the output in a readable, structured way

Output Format:
1. Brief patient overview
2. Key clinical concerns (if any)
3. Current problem list summary
4. Medication summary with any notable interactions
5. Allergy alerts
6. Summary of recent clinical data`,

  'patient-brief': `You are a healthcare assistant. Create a brief, one-paragraph summary of the patient suitable for quick review.`,

  'medication-review': `You are a pharmacist. Review the medication list and identify any potential interactions, duplications, or concerns.`,
};

export async function POST(request: NextRequest) {
  try {
    const { type, data } = await request.json();

    if (!type || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: type, data' },
        { status: 400 }
      );
    }

    const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS['clinical-summary'];

    // Try to use Claude API if available
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (anthropicApiKey) {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: `Please generate a clinical summary based on the following patient data:\n\n${data}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          const summary = result.content?.[0]?.text || 'Unable to generate summary';
          return NextResponse.json({ summary, source: 'claude' });
        }
      } catch (claudeError) {
        console.error('[AI Summarize] Claude API error:', claudeError);
        // Fall through to local generation
      }
    }

    // Fallback: Generate summary locally
    const summary = generateLocalSummary(type, data);
    return NextResponse.json({ summary, source: 'local' });

  } catch (error: any) {
    console.error('[AI Summarize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary', details: error.message },
      { status: 500 }
    );
  }
}

// Local summary generation (fallback when Claude is not available)
function generateLocalSummary(type: string, data: string): string {
  // Parse the structured data if possible
  const lines = data.split('\n').filter(l => l.trim());

  // Extract sections
  const sections: Record<string, string[]> = {};
  let currentSection = 'general';

  for (const line of lines) {
    if (line.startsWith('##')) {
      currentSection = line.replace(/^#+\s*/, '').toLowerCase();
      sections[currentSection] = [];
    } else if (line.startsWith('-') || line.startsWith('•')) {
      if (!sections[currentSection]) sections[currentSection] = [];
      sections[currentSection].push(line.replace(/^[-•]\s*/, ''));
    }
  }

  // Build summary
  let summary = `CLINICAL SUMMARY
================

`;

  // Patient info
  const patientLines = lines.filter(l =>
    l.includes('Name:') || l.includes('Age:') || l.includes('Gender:') || l.includes('DOB:')
  );
  if (patientLines.length > 0) {
    summary += `PATIENT DEMOGRAPHICS:
${patientLines.map(l => l.replace(/^-\s*/, '')).join('\n')}

`;
  }

  // Conditions
  if (sections['active conditions'] || sections['conditions']) {
    const conditions = sections['active conditions'] || sections['conditions'] || [];
    summary += `PROBLEM LIST (${conditions.length} active):
${conditions.map(c => `• ${c}`).join('\n')}

`;
  }

  // Medications
  if (sections['current medications'] || sections['medications']) {
    const meds = sections['current medications'] || sections['medications'] || [];
    summary += `MEDICATIONS (${meds.length}):
${meds.map(m => `• ${m}`).join('\n')}

`;
  }

  // Allergies
  if (sections['known allergies'] || sections['allergies']) {
    const allergies = sections['known allergies'] || sections['allergies'] || [];
    const highRisk = allergies.filter(a => a.toLowerCase().includes('high'));
    summary += `ALLERGIES (${allergies.length}${highRisk.length > 0 ? ` - ${highRisk.length} HIGH RISK` : ''}):
${allergies.map(a => `• ${a}`).join('\n')}

`;
  }

  // Vitals
  if (sections['recent vital signs'] || sections['vitals']) {
    const vitals = sections['recent vital signs'] || sections['vitals'] || [];
    summary += `RECENT VITALS:
${vitals.map(v => `• ${v}`).join('\n')}

`;
  }

  summary += `---
Generated: ${new Date().toISOString()}
Note: This is an automated summary. Please review original records for complete information.`;

  return summary;
}
