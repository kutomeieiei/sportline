import { db, firebase } from '../firebase';

// Every chat doc (chats/{chatId}) keeps a small summary so the chat list can
// show the latest message and unread badges without reading all messages:
//   lastMessage: { text, senderId, type, timestamp }
//   unread:      { [uid]: number }   // messages each member hasn't seen yet
// Direct chats use the id "<uidA>_<uidB>" (sorted) and get created on first message.

export const directChatId = (a: string, b: string) => [a, b].sort().join('_');

export const isDirectChatId = (chatId: string) => chatId.split('_').length === 2;

export type MessageKind = 'text' | 'image' | 'audio' | 'venue_share' | 'system';

export const previewText = (kind: MessageKind, text: string) => {
  switch (kind) {
    case 'image': return '📷 Photo';
    case 'audio': return '🎤 Voice message';
    case 'venue_share': return '📍 Shared a venue';
    default: return text.length > 80 ? text.slice(0, 80) + '…' : text;
  }
};

/**
 * Updates the chat summary after a message is sent: sets the preview and adds
 * 1 to everyone else's unread count. `members` must include the sender.
 */
export async function recordMessage(
  chatId: string, members: string[], senderId: string, kind: MessageKind, text: string,
  opts: { batch?: firebase.firestore.WriteBatch; intro?: boolean } = {},
) {
  const unread: Record<string, firebase.firestore.FieldValue> = {};
  members.filter((m) => m !== senderId).forEach((m) => {
    unread[m] = firebase.firestore.FieldValue.increment(1);
  });
  const data: Record<string, unknown> = {
    lastMessage: {
      text: previewText(kind, text),
      senderId,
      type: kind,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    },
    unread,
  };
  if (isDirectChatId(chatId)) {
    // Direct chats: make sure the chat doc exists with exactly these two people.
    data.members = chatId.split('_');
    data.isGroup = false;
  }
  // Not friends yet: the sender's one allowed message is now used.
  if (opts.intro) data.intro = { [senderId]: true };
  const ref = db.collection('chats').doc(chatId);
  if (opts.batch) { opts.batch.set(ref, data, { merge: true }); return; }
  await ref.set(data, { merge: true });
}

/** Clears my unread badge for a chat. */
export async function markChatRead(chatId: string, myUid: string) {
  const ref = db.collection('chats').doc(chatId);
  try {
    await ref.update({ [`unread.${myUid}`]: 0 });
  } catch {
    // Doc may not exist yet (direct chat with no messages): nothing to clear.
  }
}
