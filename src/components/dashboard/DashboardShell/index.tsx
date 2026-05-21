'use client';

import { type ReactNode } from 'react';
import { useWebSocket } from '@/src/hooks/useWebSocket';

export function DashboardShell({ children }: { children: ReactNode }) {
  useWebSocket();
  return <>{children}</>;
}
