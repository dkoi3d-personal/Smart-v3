'use client';

import { useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BuildLogsProps {
  logs: string[];
}

export function BuildLogs({ logs }: BuildLogsProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Build Log</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="bg-black rounded-lg p-3 h-40 overflow-y-auto font-mono text-xs">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className={`${
                log.includes('ERROR')
                  ? 'text-red-400'
                  : log.includes('Created:')
                  ? 'text-green-400'
                  : log.includes('Preview')
                  ? 'text-blue-400'
                  : 'text-gray-300'
              }`}
            >
              {log}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </CardContent>
    </Card>
  );
}
