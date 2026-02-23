import { db, firebase } from '../firebase';
import { FriendRequest, User } from '../types';

export const sendFriendRequest = async (fromUid: string, toUsername: string) => {
  // 1. Find user by username
  const userSnapshot = await db.collection('users').where('username', '==', toUsername).get();
  if (userSnapshot.empty) {
    throw new Error('User not found');
  }
  const toUser = userSnapshot.docs[0].data() as User;
  const toUid = toUser.uid;

  if (fromUid === toUid) {
    throw new Error('Cannot add yourself');
  }

  // 2. Check if request already exists
  const existingRequest = await db.collection('friend_requests')
    .where('from', '==', fromUid)
    .where('to', '==', toUid)
    .get();

  if (!existingRequest.empty) {
    throw new Error('Friend request already sent');
  }

  // 3. Check if already friends
  const senderDoc = await db.collection('users').doc(fromUid).get();
  const senderData = senderDoc.data() as User;
  if (senderData.friends?.includes(toUid)) {
    throw new Error('Already friends');
  }

  // 4. Create request
  await db.collection('friend_requests').add({
    from: fromUid,
    to: toUid,
    status: 'pending',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
};

export const acceptFriendRequest = async (requestId: string) => {
  const requestRef = db.collection('friend_requests').doc(requestId);
  const requestDoc = await requestRef.get();
  
  if (!requestDoc.exists) {
    throw new Error('Request not found');
  }

  const requestData = requestDoc.data() as FriendRequest;
  
  if (requestData.status !== 'pending') {
    throw new Error('Request already handled');
  }

  const batch = db.batch();

  // 1. Update request status
  batch.update(requestRef, { status: 'accepted' });

  // 2. Add to sender's friend list
  const senderRef = db.collection('users').doc(requestData.from);
  batch.update(senderRef, {
    friends: firebase.firestore.FieldValue.arrayUnion(requestData.to)
  });

  // 3. Add to receiver's friend list
  const receiverRef = db.collection('users').doc(requestData.to);
  batch.update(receiverRef, {
    friends: firebase.firestore.FieldValue.arrayUnion(requestData.from)
  });

  await batch.commit();
};

export const rejectFriendRequest = async (requestId: string) => {
  await db.collection('friend_requests').doc(requestId).update({
    status: 'rejected'
  });
};

export const getIncomingFriendRequests = async (uid: string): Promise<FriendRequest[]> => {
  const snapshot = await db.collection('friend_requests')
    .where('to', '==', uid)
    .where('status', '==', 'pending')
    .get();

  const requests = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as FriendRequest[];

  // Hydrate with sender user data
  const hydratedRequests = await Promise.all(requests.map(async (req) => {
    const userDoc = await db.collection('users').doc(req.from).get();
    return {
      ...req,
      fromUser: userDoc.data() as User
    };
  }));

  return hydratedRequests;
};

export const getFriends = async (uid: string): Promise<User[]> => {
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data() as User;
  
  if (!userData.friends || userData.friends.length === 0) {
    return [];
  }

  // Firestore 'in' query supports up to 10 items.
  // For production, we'd need to batch this or fetch individually.
  // For now, we'll fetch individually to be safe.
  const friendsData = await Promise.all(userData.friends.map(async (friendUid) => {
    const friendDoc = await db.collection('users').doc(friendUid).get();
    return friendDoc.data() as User;
  }));

  return friendsData;
};
