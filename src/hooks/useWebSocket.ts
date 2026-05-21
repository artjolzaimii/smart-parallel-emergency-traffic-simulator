'use client';

import { useEffect } from 'react';
import { wsService } from '@/src/services/websocketService';

export function useWebSocket(): void {
  useEffect(() => {
    wsService.connect();
    return () => wsService.disconnect();
  }, []);
}
