import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { APP_CONFIG } from '../constants';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-base font-bold text-white">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-zinc-400">{children}</div>
  </section>
);

const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1.5">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

const PrivacyPolicyView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const app = APP_CONFIG.appName;
  const contact = APP_CONFIG.contactEmail;
  const contactIsEmail = contact.includes('@') && !contact.startsWith('[');

  return (
    <div className="fixed inset-0 bg-zinc-950 z-[2500] flex flex-col animate-in slide-in-from-right duration-300">
      <div className="px-4 py-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-10">
        <button onClick={onClose} aria-label="Back" className="p-1 -ml-1 text-red-500 rounded-full hover:bg-zinc-800 active:scale-95">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-white">Privacy Policy</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <article className="max-w-2xl mx-auto px-6 py-6 pb-24 space-y-7">
          <p className="text-xs text-zinc-500">Last updated: {APP_CONFIG.privacyPolicyUpdated}</p>

          <p className="text-sm leading-relaxed text-zinc-300">
            {app} helps you find people to play sports with, join games near you, and chat with other players.
            This policy explains what information the app collects, how it's used, who can see it, and the choices you have.
          </p>

          <Section title="1. Information we collect">
            <p><span className="text-zinc-200 font-semibold">Your Google account.</span> You sign in with Google. We receive your name, Gmail address, profile photo, and a unique account ID. We never see your Google password.</p>
            <p><span className="text-zinc-200 font-semibold">Your profile.</span> Your username, display name, bio, gender, favourite sports and profile photo, plus any changes you make.</p>
            <p><span className="text-zinc-200 font-semibold">Location.</span></p>
            <Bullets items={[
              'Your device location is used in your browser to centre the map and sort nearby games. It is not saved just for opening the map.',
              <>When you choose <span className="text-zinc-200">Play Sport → broadcast</span>, we save your current position, the sport you picked, and the time, so nearby players can find you. Broadcasts stop showing to others after 60 minutes or when you turn them off.</>,
              'When you create a party, its location, time and details are saved.',
            ]} />
            <p><span className="text-zinc-200 font-semibold">Messages and media.</span> Chat messages, photos, voice messages and venues you share, plus group names and photos.</p>
            <p><span className="text-zinc-200 font-semibold">Calls.</span> Voice and video go directly between the devices in the call and are <span className="text-zinc-200">not recorded or stored</span>. We save a small call record (who was invited, who joined, the type of call, and when) so the app can ring people and show who's in a call.</p>
            <p><span className="text-zinc-200 font-semibold">Friends and groups.</span> Your friend list, friend requests, the groups you're in, and the parties you've joined.</p>
            <p><span className="text-zinc-200 font-semibold">Diagnostics.</span> If you run Connection Diagnostics, a test entry with your account ID and the time is saved. Results you choose to copy stay on your device.</p>
          </Section>

          <Section title="2. How we use it">
            <Bullets items={[
              'To run the app: show your profile, map, parties, chats and calls.',
              'To let you find friends by username or Gmail address.',
              'To show nearby players and games.',
              'To keep the app safe, for example enforcing who can read each chat, and to fix problems.',
            ]} />
            <p>We do not sell your information, and we don't use it for advertising.</p>
          </Section>

          <Section title="3. Who can see your information">
            <Bullets items={[
              <><span className="text-zinc-200">Other signed-in users</span> can see your profile (name, username, photo, bio, gender, favourite sports) <span className="text-zinc-200">and your Gmail address</span>. That lets friends find you by Gmail.</>,
              'Other signed-in users can see parties (including their location and members) and live locations you broadcast.',
              'Chat messages, photos and voice messages can only be seen by the people in that chat. Anyone added to a group later can see its earlier messages.',
              'Group members can rename the group, change its photo, and add their friends.',
              'Admins of the app can manage venue and sport information.',
            ]} />
          </Section>

          <Section title="4. Services we use">
            <p>We rely on these companies to run the app. They process data on our behalf, under their own privacy policies:</p>
            <Bullets items={[
              'Google Firebase: sign-in, database, and file storage for photos and voice messages.',
              'Google Maps Platform: the map, place search and travel times. Your searches and map location are sent to Google.',
              'Google STUN servers: help call participants connect to each other.',
              'Vercel: hosts the website.',
              'UI Avatars (ui-avatars.com): creates default profile pictures from your initials when you don\'t have a photo. Your name is sent to it.',
              'Pixabay: the background video on the sign-in screen is loaded from Pixabay.',
              'Voice search in the search bar uses your browser\'s speech recognition. In Chrome and some other browsers, the audio is sent to the browser maker (for example Google) to turn it into text.',
            ]} />
          </Section>

          <Section title="5. How long we keep it">
            <p>We keep your information while your account exists. Messages, photos and voice messages stay until the chat data is deleted. Broadcast locations stop being shown after 60 minutes. You can ask us to delete your account and data at any time (see Contact).</p>
          </Section>

          <Section title="6. Your choices">
            <Bullets items={[
              'Edit your profile, photo and username at any time in Settings.',
              'Choose whether to broadcast your location, and stop at any time.',
              'Deny or remove camera, microphone and location permissions in your browser or phone settings. The related features won\'t work without them.',
              'Remove friends and leave groups.',
              'Ask for a copy of your data, a correction, or deletion of your account, by contacting us.',
            ]} />
          </Section>

          <Section title="7. Security">
            <p>Data is sent over encrypted connections (HTTPS). Database rules limit who can read and change each piece of information. No system is perfectly secure, so please don't share anything you'd be unhappy for others to see.</p>
          </Section>

          <Section title="8. Children">
            <p>{app} is not meant for children under 13, and we don't knowingly collect their information. If you think a child has created an account, contact us and we'll delete it.</p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>If we change this policy, we'll update the date at the top. For important changes, we'll let you know in the app.</p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions, or want to access or delete your data? Contact the {app} team at{' '}
              {contactIsEmail
                ? <a href={`mailto:${contact}`} className="text-red-500 hover:text-red-400 font-semibold">{contact}</a>
                : <span className="text-zinc-200 font-semibold">{contact}</span>}.
            </p>
          </Section>
        </article>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;
