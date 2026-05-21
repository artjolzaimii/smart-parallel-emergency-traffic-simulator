import { create } from 'zustand';
import type { WsConnectionStatus } from '@/src/types/websocket';

interface WsStore {
  status: WsConnectionStatus;
  setStatus: (status: WsConnectionStatus) => void;
}

export const useWsStore = create<WsStore>()((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));
