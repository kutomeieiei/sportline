import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const REQUIRED_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

const missingEnv = REQUIRED_ENV.filter((key) => !import.meta.env[key]);

const ConfigErrorScreen: React.FC<{ title: string; details: string[] }> = ({ title, details }) => (
  <div className="w-full min-h-screen flex items-center justify-center bg-zinc-950 p-6">
    <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-left">
      <h1 className="text-lg font-bold text-white mb-2">{title}</h1>
      <p className="text-sm text-zinc-400 mb-3">
        The app can't start. If you run this site, add these settings as environment
        variables in your hosting (for example Vercel → Settings → Environment Variables)
        and redeploy:
      </p>
      <ul className="text-sm text-red-400 font-mono space-y-1">
        {details.map((d) => <li key={d}>{d}</li>)}
      </ul>
    </div>
  </div>
);

if (missingEnv.length > 0) {
  console.error('Missing environment variables:', missingEnv.join(', '));
  root.render(<ConfigErrorScreen title="Site settings are missing" details={missingEnv} />);
} else {
  // Load the app only when config exists, so Firebase never starts with an empty key
  // (which would crash and leave a blank black screen).
  import('./App').then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
}
