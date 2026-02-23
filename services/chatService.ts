import { db, firebase } from '../firebase';
import { ChatConversation, ChatMessage, User } from '../types';

export const createConversation = async (participants: string[]): Promise<string> => {
  // 1. Check if conversation already exists
  const snapshot = await db.collection('conversations')
    .where('participants', 'array-contains-any', participants)
    .get();

  // This is a simplified check. In a real app, we'd need to check for exact participants match.
  // For now, we'll assume 1:1 chat.
  const existingConv = snapshot.docs.find(doc => {
    const data = doc.data() as ChatConversation;
    return data.participants.length === participants.length && 
           data.participants.every(p => participants.includes(p));
  });

  if (existingConv) {
    return existingConv.id;
  }

  // 2. Create new conversation
  const newConvRef = await db.collection('conversations').add({
    participants,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  return newConvRef.id;
};

export const sendMessage = async (conversationId: string, senderId: string, text: string) => {
  const batch = db.batch();

  // 1. Add message
  const messageRef = db.collection('conversations').doc(conversationId).collection('messages').doc();
  batch.set(messageRef, {
    senderId,
    text,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  // 2. Update conversation last message
  const convRef = db.collection('conversations').doc(conversationId);
  batch.update(convRef, {
    lastMessage: text,
    lastMessageTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
};

export const getConversations = async (uid: string): Promise<ChatConversation[]> => {
  const snapshot = await db.collection('conversations')
    .where('participants', 'array-contains', uid)
    .orderBy('updatedAt', 'desc')
    .get();

  const conversations = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as ChatConversation[];

  // Hydrate with participant user data
  const hydratedConvs = await Promise.all(conversations.map(async (conv) => {
    const otherParticipantId = conv.participants.find(p => p !== uid);
    if (!otherParticipantId) return conv;

    const userDoc = await db.collection('users').doc(otherParticipantId).get();
    const userData = userDoc.data() as User;
    
    return {
      ...conv,
      participantUsers: [userData] // Simplified for 1:1
    };
  }));

  return hydratedConvs;
};

export const subscribeToMessages = (conversationId: string, callback: (messages: ChatMessage[]) => void) => {
  return db.collection('conversations').doc(conversationId).collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      callback(messages);
    });
};
