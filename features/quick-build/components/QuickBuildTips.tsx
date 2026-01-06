'use client';

import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function QuickBuildTips() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Tips for Best Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Keep it simple</strong> - Start with basic features and add more later
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Be specific</strong> - Describe what you want to see on the page
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              <strong>No external services</strong> - Avoid APIs, databases for quick builds
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              <strong>Use examples</strong> - Click the example buttons above for tested prompts
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
