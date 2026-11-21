import React, { useState } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw, Trash2, Copy, Circle } from 'lucide-react';
import { db, auth, storage, firebase } from '../firebase';
import { buildIceServers, hasTurnRelay } from '../services/callService';

type CheckState = 'idle' | 'running' | 'ok' | 'warn' | 'fail';
interface CheckResult { state: CheckState; detail: string }

interface CheckDef {
  id: string;
  label: string;
  run: () => Promise<CheckResult>;
}

const withTimeout = <T,>(p: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT: ${what} did not respond in ${ms / 1000}s`)), ms))]);

const ok = (detail: string): CheckResult => ({ state: 'ok', detail });
const warn = (detail: string): CheckResult => ({ state: 'warn', detail });
const fail = (detail: string): CheckResult => ({ state: 'fail', detail });

const errMessage = (e: unknown) => {
  const err = e as { code?: string; message?: string };
  if (err.message?.startsWith('TIMEOUT')) return err.message.replace('TIMEOUT: ', '') + '. A firewall or slow connection may be blocking it.';
  if (err.code === 'permission-denied') return 'Permission denied by database rules.';
  if (err.code === 'unavailable') return 'Server unreachable (offline?).';
  return err.message || 'Unknown error';
};

async function permissionState(name: 'camera' | 'microphone'): Promise<CheckResult> {
  if (!navigator.mediaDevices?.getUserMedia) return fail('Not supported here. Open the site over https in Chrome, Safari or Edge.');
  try {
    const status = await navigator.permissions.query({ name: name as PermissionName });
    if (status.state === 'granted') return ok('Allowed');
    if (status.state === 'denied') return fail(`Blocked. Allow ${name} access for this site in your browser settings.`);
    return warn('Not asked yet. You\'ll be asked the first time you use it.');
  } catch {
    return warn('Your browser doesn\'t report this. You\'ll be asked when needed.');
  }
}

/**
 * Checks how well calls can connect from this network.
 * - Asks two public STUN servers for our public address. If each one sees a
 *   different port, this is a "strict" network (symmetric NAT): direct calls
 *   with people on other networks usually fail without a relay (TURN).
 * - If a TURN relay is set up, checks that it answers.
 */
function checkCallNetwork(): Promise<CheckResult> {
  return new Promise((resolve) => {
    if (typeof RTCPeerConnection === 'undefined') { resolve(fail('This browser does not support calls.')); return; }
    const turn = hasTurnRelay();
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        ...buildIceServers().filter((s) => JSON.stringify(s.urls).includes('turn')),
      ],
    });
    const publicPorts = new Map<string, Set<string>>();
    let relayFound = false;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { pc.close(); } catch { /* ignore */ }
      const strict = Array.from(publicPorts.values()).some((ports) => ports.size > 1);
      const relayNote = turn ? (relayFound ? ' The relay (TURN) server works.' : ' The relay (TURN) server did not answer. Check its settings.') : '';
      if (publicPorts.size === 0 && !relayFound) {
        resolve(warn('Could not reach the call server. Calls will probably fail on this network (strict Wi-Fi or mobile data). A relay (TURN) server would fix this.' + relayNote));
      } else if (strict && !relayFound) {
        resolve(warn('This network is strict about connections, so calls with people on other networks may connect but stay silent, or fail. Try Wi-Fi instead of mobile data (or the other way), or add a relay (TURN) server.' + relayNote));
      } else if (turn && !relayFound) {
        resolve(warn('Calls can connect directly.' + relayNote));
      } else {
        resolve(ok((strict ? 'Strict network, but calls can use the relay.' : 'Calls can connect directly.') + relayNote));
      }
    };
    const timer = setTimeout(finish, 7000);

    pc.onicecandidate = (e) => {
      if (!e.candidate) { finish(); return; } // gathering finished
      const m = /^candidate:\S+ \d+ (\S+) \d+ (\S+) (\d+) typ (\S+)/i.exec(e.candidate.candidate);
      if (!m) return;
      const [, protocol, ip, port, type] = m;
      if (type === 'relay') relayFound = true;
      if (type === 'srflx' && protocol.toLowerCase() === 'udp') {
        const ports = publicPorts.get(ip) || new Set<string>();
        ports.add(port);
        publicPorts.set(ip, ports);
      }
    };
    pc.createDataChannel('diag');
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {
      done = true;
      clearTimeout(timer);
      try { pc.close(); } catch { /* ignore */ }
      resolve(fail('Could not start a test connection.'));
    });
  });
}

const CHECKS: CheckDef[] = [
  {
    id: 'internet',
    label: 'Internet',
    run: async () => navigator.onLine ? ok('Online') : fail('You appear to be offline.'),
  },
  {
    id: 'signin',
    label: 'Signed in with Google',
    run: async () => {
      const u = auth.currentUser;
      if (!u) return fail('Not signed in.');
      const google = u.providerData.some((p) => p?.providerId === 'google.com');
      return google ? ok(u.email || 'Signed in') : fail('Signed in without Google. Please sign out and use Google.');
    },
  },
  {
    id: 'db-read',
    label: 'Database (read)',
    run: async () => {
      const start = performance.now();
      try {
        await withTimeout(db.collection('connection_test').doc('ping').get({ source: 'server' }), 10000, 'Database');
        const ms = Math.round(performance.now() - start);
        return ms > 3000 ? warn(`Slow: ${ms} ms`) : ok(`${ms} ms`);
      } catch (e) { return fail(errMessage(e)); }
    },
  },
  {
    id: 'db-write',
    label: 'Database (save)',
    run: async () => {
      const u = auth.currentUser;
      if (!u) return fail('Sign in first.');
      const start = performance.now();
      try {
        await withTimeout(db.collection('connection_test').add({
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          uid: u.uid,
          test: true,
        }), 10000, 'Database');
        return ok(`${Math.round(performance.now() - start)} ms`);
      } catch (e) { return fail(errMessage(e)); }
    },
  },
  {
    id: 'profile',
    label: 'Your profile',
    run: async () => {
      const u = auth.currentUser;
      if (!u) return fail('Sign in first.');
      try {
        const snap = await withTimeout(db.collection('users').doc(u.uid).get({ source: 'server' }), 10000, 'Database');
        if (!snap.exists) return fail('Profile missing. Sign out and sign in again to recreate it.');
        const d = snap.data() || {};
        return d.username ? ok(`@${d.username}`) : warn('Profile has no username. Set one in Edit Profile.');
      } catch (e) { return fail(errMessage(e)); }
    },
  },
  {
    id: 'storage',
    label: 'Photo & voice uploads',
    run: async () => {
      try {
        // Asking for a file we can't see: a "not allowed"/"not found" answer still
        // proves the upload server is reachable.
        await withTimeout(storage.ref('chats/__diagnostics__/ping.txt').getMetadata(), 10000, 'File storage');
        return ok('Reachable');
      } catch (e) {
        const code = (e as { code?: string }).code || '';
        if (code === 'storage/unauthorized' || code === 'storage/object-not-found') return ok('Reachable');
        if (code === 'storage/retry-limit-exceeded' || (e as Error).message?.startsWith('TIMEOUT')) return fail('Upload server unreachable.');
        return warn(code || errMessage(e));
      }
    },
  },
  {
    id: 'maps',
    label: 'Map',
    run: async () => {
      const g = (window as unknown as { google?: { maps?: unknown } }).google;
      return g?.maps ? ok('Loaded') : warn('Map not loaded yet. Open the Explore tab, or check the Google Maps key.');
    },
  },
  { id: 'mic', label: 'Microphone permission', run: () => permissionState('microphone') },
  { id: 'camera', label: 'Camera permission', run: () => permissionState('camera') },
  { id: 'calls', label: 'Voice/video calls network', run: checkCallNetwork },
];

const StateIcon: React.FC<{ state: CheckState }> = ({ state }) => {
  switch (state) {
    case 'running': return <Loader2 size={16} className="animate-spin text-gray-600 shrink-0" />;
    case 'ok': return <CheckCircle size={16} className="text-green-500 shrink-0" />;
    case 'warn': return <AlertTriangle size={16} className="text-amber-400 shrink-0" />;
    case 'fail': return <XCircle size={16} className="text-red-600 shrink-0" />;
    default: return <Circle size={16} className="text-gray-300 shrink-0" />;
  }
};

const ConnectionDiagnostics: React.FC = () => {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const runAll = async () => {
    setRunning(true);
    setResults(Object.fromEntries(CHECKS.map((c) => [c.id, { state: 'running', detail: 'Checking…' }])));
    await Promise.all(CHECKS.map(async (c) => {
      let r: CheckResult;
      try { r = await c.run(); } catch (e) { r = fail(errMessage(e)); }
      setResults((prev) => ({ ...prev, [c.id]: r }));
    }));
    setRunning(false);
  };

  const resetCache = async () => {
    if (!confirm("This will refresh the app and clear its saved offline data. Continue?")) return;
    try {
      await db.terminate();
      await db.clearPersistence();
    } catch {
      // Reload anyway.
    }
    window.location.reload();
  };

  const copyReport = async () => {
    const lines = [
      `SportSphere diagnostics - ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      ...CHECKS.map((c) => `${c.label}: ${results[c.id]?.state || 'not run'} - ${results[c.id]?.detail || ''}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(lines.join('\n'));
    }
  };

  const hasRun = Object.keys(results).length > 0;
  const failures = Object.values(results).filter((r) => r.state === 'fail').length;
  const warnings = Object.values(results).filter((r) => r.state === 'warn').length;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
        <Activity size={16} className="text-red-600" /> Connection Diagnostics
      </h3>
      <p className="text-xs text-gray-500 mb-3">Checks every part of the app if something isn't working.</p>

      {hasRun && (
        <>
          {!running && (
            <div className={`text-xs p-2 rounded-lg mb-3 border ${failures ? 'bg-red-50 text-red-600 border-red-200' : warnings ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {failures ? `${failures} problem${failures > 1 ? 's' : ''} found. See below.` : warnings ? 'Working, with a few notes below.' : 'Everything is working.'}
            </div>
          )}
          <ul className="space-y-2 mb-3">
            {CHECKS.map((c) => {
              const r = results[c.id] || { state: 'idle' as CheckState, detail: '' };
              return (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="mt-0.5"><StateIcon state={r.state} /></span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{c.label}</p>
                    <p className={`text-[11px] break-words ${r.state === 'fail' ? 'text-red-600' : r.state === 'warn' ? 'text-amber-700' : 'text-gray-500'}`}>{r.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="flex gap-2">
        <button
          onClick={runAll}
          disabled={running}
          className="flex-1 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-200 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          <RefreshCw size={12} className={running ? 'animate-spin' : ''} />
          {hasRun ? 'Run Again' : 'Run Diagnostics'}
        </button>
        {hasRun && !running && (
          <button
            onClick={copyReport}
            title="Copy results to send to support"
            className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-200 flex items-center justify-center gap-2 active:scale-95"
          >
            <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
        <button
          onClick={resetCache}
          title="Clear the app's offline data and reload"
          className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-100 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Trash2 size={12} /> Reset
        </button>
      </div>
    </div>
  );
};

export default ConnectionDiagnostics;
