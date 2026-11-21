import { createContext, useContext } from 'react';
import { CallDoc, CallType } from './callService';

export interface StartCallOptions {
  chatId: string;
  isGroup: boolean;
  title: string;
  type: CallType;
  participants: string[];
}

export interface CallContextValue {
  /** The call I'm currently in (or calling out on), if any. */
  currentCall: CallDoc | null;
  /** Calls that include me and haven't ended (to show "Join" banners). */
  activeCalls: CallDoc[];
  startCall: (opts: StartCallOptions) => Promise<void>;
  joinCall: (call: CallDoc) => Promise<void>;
}

export const CallContext = createContext<CallContextValue>({
  currentCall: null,
  activeCalls: [],
  startCall: async () => {},
  joinCall: async () => {},
});

export const useCall = () => useContext(CallContext);
