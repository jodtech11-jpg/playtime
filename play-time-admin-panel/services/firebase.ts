import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updatePassword,
  sendEmailVerification,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
  addDoc,
  writeBatch,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getStorage, 
  FirebaseStorage, 
  ref, 
  uploadBytes, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll,
  getMetadata,
  UploadTask,
  UploadTaskSnapshot
} from 'firebase/storage';
import { 
  getMessaging, 
  Messaging, 
  getToken, 
  onMessage,
  MessagePayload,
  isSupported
} from 'firebase/messaging';

// Firebase configuration
import { firebaseConfig as config, validateFirebaseConfig } from '../config/firebase.config';

// Validate config on import (only in development)
if (import.meta.env.DEV) {
  validateFirebaseConfig();
}

const firebaseConfig = config;

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Initialize messaging (only in browser, check support)
let messaging: Messaging | null = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}

// ==================== AUTHENTICATION ====================

/**
 * Sign in with email and password
 */
export const signInEmailPassword = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

/**
 * Sign in with Phone Number (OTP)
 */
export const signInWithPhone = async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) => {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return { confirmationResult, error: null };
  } catch (error: any) {
    return { confirmationResult: null, error: error.message };
  }
};

/**
 * Verify OTP code
 */
export const verifyOTP = async (confirmationResult: ConfirmationResult, code: string) => {
  try {
    const userCredential = await confirmationResult.confirm(code);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

/**
 * Create new user account
 */
export const createUser = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: any) {
    return { user: null, error: error.message };
  }
};

/**
 * Sign out current user
 */
export const signOutUser = async () => {
  try {
    await signOut(auth);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Get current user
 */
export const getCurrentUser = (): FirebaseUser | null => {
  return auth.currentUser;
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Send password reset email
 */
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

/**
 * Update user password
 */
export const updateUserPassword = async (newPassword: string) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    await updatePassword(user, newPassword);
    return { error: null };
  } catch (error: any) {
    return { error: error.message };
  }
};

// ==================== FIRESTORE DATABASE ====================

/**
 * Generic function to get a document by ID
 */
export const getDocument = async <T = DocumentData>(
  collectionName: string, 
  docId: string
): Promise<T | null> => {
  try {
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error(`Invalid document ID: ${docId}. Collection: ${collectionName}`);
    }
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error: any) {
    console.error(`Error getting document ${docId} from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Generic function to get all documents from a collection
 */
export const getDocuments = async <T = DocumentData>(
  collectionName: string,
  filters?: { field: string; operator: any; value: any }[],
  orderByField?: string,
  orderDirection?: 'asc' | 'desc',
  limitCount?: number
): Promise<T[]> => {
  try {
    let q = query(collection(db, collectionName));
    
    // Apply filters
    if (filters && filters.length > 0) {
      filters.forEach(filter => {
        // Handle both array format [field, operator, value] and object format {field, operator, value}
        let field: string;
        let operator: any;
        let value: any;
        
        if (Array.isArray(filter)) {
          // Array format: [field, operator, value]
          [field, operator, value] = filter;
        } else if (filter && typeof filter === 'object') {
          // Object format: {field, operator, value}
          field = filter.field;
          operator = filter.operator;
          value = filter.value;
        } else {
          // Invalid format, skip this filter
          console.warn('Invalid filter format, skipping:', filter);
          return;
        }
        
        // Only apply filter if all values are defined
        if (field && operator !== undefined && value !== undefined) {
          q = query(q, where(field, operator, value));
        }
      });
    }
    
    // Apply ordering
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection || 'asc'));
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
  } catch (error: any) {
    console.error(`Error getting documents from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Create or update a document
 */
export const setDocument = async <T = DocumentData>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> => {
  try {
    // Remove undefined values from data
    const cleanData: any = {};
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    const docRef = doc(db, collectionName, docId);
    await setDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp(),
      createdAt: cleanData.createdAt || serverTimestamp()
    } as any, { merge: true });
  } catch (error: any) {
    console.error(`Error setting document ${docId}:`, error);
    throw error;
  }
};

/**
 * Create a new document with auto-generated ID
 */
export const createDocument = async <T = DocumentData>(
  collectionName: string,
  data: Partial<T>
): Promise<string> => {
  try {
    // Remove undefined values from data
    const cleanData: any = {};
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    const docRef = await addDoc(collection(db, collectionName), {
      ...cleanData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as any);
    return docRef.id;
  } catch (error: any) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Update a document
 */
export const updateDocument = async <T = DocumentData>(
  collectionName: string,
  docId: string,
  data: Partial<T>
): Promise<void> => {
  try {
    if (!docId || typeof docId !== 'string' || docId.trim() === '') {
      throw new Error(`Invalid document ID: ${docId}. Collection: ${collectionName}`);
    }
    // Remove undefined values from data
    const cleanData: any = {};
    Object.keys(data).forEach(key => {
      const value = (data as any)[key];
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp()
    } as any);
  } catch (error: any) {
    console.error(`Error updating document ${docId}:`, error);
    throw error;
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (
  collectionName: string,
  docId: string
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error: any) {
    console.error(`Error deleting document ${docId}:`, error);
    throw error;
  }
};

/**
 * Listen to real-time document changes
 */
export const subscribeToDocument = <T = DocumentData>(
  collectionName: string,
  docId: string,
  callback: (data: T | null) => void
): (() => void) => {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as T);
    } else {
      callback(null);
    }
  });
};

/**
 * Listen to real-time collection changes
 */
export const subscribeToCollection = <T = DocumentData>(
  collectionName: string,
  callback: (data: T[]) => void,
  filters?: { field: string; operator: any; value: any }[] | any[][],
  orderByField?: string,
  orderDirection?: 'asc' | 'desc'
): (() => void) => {
  let q = query(collection(db, collectionName));
  
  if (filters && filters.length > 0) {
    filters.forEach(filter => {
      // Handle both array format [field, operator, value] and object format {field, operator, value}
      let field: string;
      let operator: any;
      let value: any;
      
      if (Array.isArray(filter)) {
        // Array format: [field, operator, value]
        [field, operator, value] = filter;
      } else if (filter && typeof filter === 'object') {
        // Object format: {field, operator, value}
        field = filter.field;
        operator = filter.operator;
        value = filter.value;
      } else {
        // Invalid format, skip this filter
        console.warn('Invalid filter format, skipping:', filter);
        return;
      }
      
      // Only apply filter if all values are defined
      if (field && operator !== undefined && value !== undefined) {
        q = query(q, where(field, operator, value));
      }
    });
  }
  
  if (orderByField) {
    q = query(q, orderBy(orderByField, orderDirection || 'asc'));
  }
  
  return onSnapshot(
    q, 
    (querySnapshot) => {
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
      callback(data);
    },
    (error) => {
      console.error(`Error in subscription to ${collectionName}:`, error);
      // Call callback with empty array on error so loading state can be cleared
      callback([]);
    }
  );
};

/**
 * Batch write operations
 */
export const batchWrite = async (
  operations: Array<{
    type: 'set' | 'update' | 'delete';
    collection: string;
    docId: string;
    data?: any;
  }>
): Promise<void> => {
  const batch = writeBatch(db);
  
  operations.forEach(op => {
    const docRef = doc(db, op.collection, op.docId);
    if (op.type === 'set') {
      batch.set(docRef, op.data);
    } else if (op.type === 'update') {
      batch.update(docRef, op.data);
    } else if (op.type === 'delete') {
      batch.delete(docRef);
    }
  });
  
  await batch.commit();
};

/**
 * Transaction operations
 */
export const runTransactionOperation = async <T = any>(
  callback: (transaction: any) => Promise<T>
): Promise<T> => {
  return await runTransaction(db, callback);
};

// ==================== STORAGE ====================

/**
 * Upload file to Firebase Storage
 */
export const uploadFile = async (
  path: string,
  file: File | Blob,
  metadata?: { contentType?: string; customMetadata?: Record<string, string> }
): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file, metadata);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error: any) {
    console.error(`Error uploading file to ${path}:`, error);
    throw error;
  }
};

/**
 * Upload file with progress tracking
 */
export const uploadFileWithProgress = (
  path: string,
  file: File | Blob,
  onProgress?: (progress: number) => void,
  metadata?: { contentType?: string; customMetadata?: Record<string, string> }
): UploadTask => {
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file, metadata);
  
  uploadTask.on('state_changed', 
    (snapshot: UploadTaskSnapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      if (onProgress) onProgress(progress);
    },
    (error) => {
      console.error('Upload error:', error);
    },
    async () => {
      // Upload completed
    }
  );
  
  return uploadTask;
};

/**
 * Get download URL for a file
 */
export const getFileURL = async (path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error: any) {
    console.error(`Error getting file URL for ${path}:`, error);
    throw error;
  }
};

/**
 * Delete file from Storage
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    console.error(`Error deleting file ${path}:`, error);
    throw error;
  }
};

/**
 * List all files in a directory
 */
export const listFiles = async (path: string): Promise<string[]> => {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items.map(item => item.fullPath);
  } catch (error: any) {
    console.error(`Error listing files in ${path}:`, error);
    throw error;
  }
};

/**
 * Get file metadata
 */
export const getFileMetadata = async (path: string) => {
  try {
    const storageRef = ref(storage, path);
    return await getMetadata(storageRef);
  } catch (error: any) {
    console.error(`Error getting metadata for ${path}:`, error);
    throw error;
  }
};

// ==================== FCM (Firebase Cloud Messaging) ====================

/**
 * Request notification permission and get FCM token
 */
export const getFCMToken = async (): Promise<string | null> => {
  if (!messaging) {
    console.warn('Messaging not supported or not initialized');
    return null;
  }
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || ''
      });
      return token;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Listen for foreground messages
 */
export const onForegroundMessage = (
  callback: (payload: MessagePayload) => void
): (() => void) | null => {
  if (!messaging) {
    console.warn('Messaging not supported or not initialized');
    return null;
  }
  
  return onMessage(messaging, callback);
};

// ==================== COLLECTION-SPECIFIC HELPERS ====================

// Users Collection
export const usersCollection = {
  get: (userId: string) => getDocument('users', userId),
  getAll: (filters?: any[]) => getDocuments('users', filters),
  create: (userId: string, data: any) => setDocument('users', userId, data),
  update: (userId: string, data: any) => updateDocument('users', userId, data),
  delete: (userId: string) => deleteDocument('users', userId),
  subscribe: (userId: string, callback: any) => subscribeToDocument('users', userId, callback)
};

// Roles Collection
export const rolesCollection = {
  get: (roleId: string) => getDocument('roles', roleId),
  getAll: (filters?: any[]) => getDocuments('roles', filters),
  create: (roleId: string, data: any) => setDocument('roles', roleId, data),
  update: (roleId: string, data: any) => updateDocument('roles', roleId, data),
  delete: (roleId: string) => deleteDocument('roles', roleId),
  subscribe: (roleId: string, callback: any) => subscribeToDocument('roles', roleId, callback)
};

// Permissions Collection
export const permissionsCollection = {
  get: (permissionId: string) => getDocument('permissions', permissionId),
  getAll: (filters?: any[]) => getDocuments('permissions', filters),
  create: (permissionId: string, data: any) => setDocument('permissions', permissionId, data),
  update: (permissionId: string, data: any) => updateDocument('permissions', permissionId, data),
  delete: (permissionId: string) => deleteDocument('permissions', permissionId),
  subscribe: (permissionId: string, callback: any) => subscribeToDocument('permissions', permissionId, callback)
};

// Venues Collection
export const venuesCollection = {
  get: (venueId: string) => getDocument('venues', venueId),
  getAll: (filters?: any[]) => getDocuments('venues', filters),
  create: (venueId: string, data: any) => setDocument('venues', venueId, data),
  update: (venueId: string, data: any) => updateDocument('venues', venueId, data),
  delete: (venueId: string) => deleteDocument('venues', venueId),
  subscribe: (venueId: string, callback: any) => subscribeToDocument('venues', venueId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('venues', callback, filters, orderByField, orderDirection)
};

// Bookings Collection
export const bookingsCollection = {
  get: (bookingId: string) => getDocument('bookings', bookingId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('bookings', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('bookings', data),
  update: (bookingId: string, data: any) => updateDocument('bookings', bookingId, data),
  delete: (bookingId: string) => deleteDocument('bookings', bookingId),
  subscribe: (bookingId: string, callback: any) => subscribeToDocument('bookings', bookingId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('bookings', callback, filters, orderByField, orderDirection)
};

// Memberships Collection
export const membershipsCollection = {
  get: (membershipId: string) => getDocument('memberships', membershipId),
  getAll: (filters?: any[]) => getDocuments('memberships', filters),
  create: (data: any) => createDocument('memberships', data),
  update: (membershipId: string, data: any) => updateDocument('memberships', membershipId, data),
  delete: (membershipId: string) => deleteDocument('memberships', membershipId),
  subscribe: (membershipId: string, callback: any) => subscribeToDocument('memberships', membershipId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('memberships', callback, filters, orderByField, orderDirection)
};

// Courts Collection
export const courtsCollection = {
  get: (courtId: string) => getDocument('courts', courtId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('courts', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('courts', data),
  update: (courtId: string, data: any) => updateDocument('courts', courtId, data),
  delete: (courtId: string) => deleteDocument('courts', courtId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('courts', callback, filters, orderByField, orderDirection)
};

// Membership Plans Collection
export const membershipPlansCollection = {
  get: (planId: string) => getDocument('membershipPlans', planId),
  getAll: (filters?: any[]) => getDocuments('membershipPlans', filters),
  create: (data: any) => createDocument('membershipPlans', data),
  update: (planId: string, data: any) => updateDocument('membershipPlans', planId, data),
  delete: (planId: string) => deleteDocument('membershipPlans', planId),
  subscribe: (planId: string, callback: any) => subscribeToDocument('membershipPlans', planId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('membershipPlans', callback, filters, orderByField, orderDirection)
};

// Posts Collection (Social Feed)
export const postsCollection = {
  get: (postId: string) => getDocument('posts', postId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('posts', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('posts', data),
  update: (postId: string, data: any) => updateDocument('posts', postId, data),
  delete: (postId: string) => deleteDocument('posts', postId),
  subscribe: (postId: string, callback: any) => subscribeToDocument('posts', postId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('posts', callback, filters, orderByField, orderDirection)
};

// Reports Collection
export const reportsCollection = {
  get: (reportId: string) => getDocument('reports', reportId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('reports', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('reports', data),
  update: (reportId: string, data: any) => updateDocument('reports', reportId, data),
  delete: (reportId: string) => deleteDocument('reports', reportId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('reports', callback, filters, orderByField, orderDirection)
};

// Products Collection (Marketplace)
export const productsCollection = {
  get: (productId: string) => getDocument('products', productId),
  getAll: (filters?: any[]) => getDocuments('products', filters),
  create: (data: any) => createDocument('products', data),
  update: (productId: string, data: any) => updateDocument('products', productId, data),
  delete: (productId: string) => deleteDocument('products', productId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('products', callback, filters, orderByField, orderDirection)
};

// Categories Collection (Product Categories)
export const categoriesCollection = {
  get: (categoryId: string) => getDocument('categories', categoryId),
  getAll: (filters?: any[]) => getDocuments('categories', filters),
  create: (data: any) => createDocument('categories', data),
  update: (categoryId: string, data: any) => updateDocument('categories', categoryId, data),
  delete: (categoryId: string) => deleteDocument('categories', categoryId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('categories', callback, filters, orderByField, orderDirection)
};

// Sports Collection (Sport Types)
export const sportsCollection = {
  get: (sportId: string) => getDocument('sports', sportId),
  getAll: (filters?: any[]) => getDocuments('sports', filters),
  create: (data: any) => createDocument('sports', data),
  update: (sportId: string, data: any) => updateDocument('sports', sportId, data),
  delete: (sportId: string) => deleteDocument('sports', sportId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('sports', callback, filters, orderByField, orderDirection)
};

// Orders Collection
export const ordersCollection = {
  get: (orderId: string) => getDocument('orders', orderId),
  getAll: (filters?: any[]) => getDocuments('orders', filters),
  create: (data: any) => createDocument('orders', data),
  update: (orderId: string, data: any) => updateDocument('orders', orderId, data),
  delete: (orderId: string) => deleteDocument('orders', orderId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('orders', callback, filters, orderByField, orderDirection)
};

// Quick Matches Collection
export const quickMatchesCollection = {
  get: (matchId: string) => getDocument('quickMatches', matchId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('quickMatches', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('quickMatches', data),
  update: (matchId: string, data: any) => updateDocument('quickMatches', matchId, data),
  delete: (matchId: string) => deleteDocument('quickMatches', matchId),
  subscribe: (matchId: string, callback: any) => subscribeToDocument('quickMatches', matchId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('quickMatches', callback, filters, orderByField, orderDirection)
};

// Leaderboards Collection
export const leaderboardsCollection = {
  get: (leaderboardId: string) => getDocument('leaderboards', leaderboardId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('leaderboards', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('leaderboards', data),
  update: (leaderboardId: string, data: any) => updateDocument('leaderboards', leaderboardId, data),
  delete: (leaderboardId: string) => deleteDocument('leaderboards', leaderboardId),
  subscribe: (leaderboardId: string, callback: any) => subscribeToDocument('leaderboards', leaderboardId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('leaderboards', callback, filters, orderByField, orderDirection)
};

// Polls Collection
export const pollsCollection = {
  get: (pollId: string) => getDocument('polls', pollId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('polls', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('polls', data),
  update: (pollId: string, data: any) => updateDocument('polls', pollId, data),
  delete: (pollId: string) => deleteDocument('polls', pollId),
  subscribe: (pollId: string, callback: any) => subscribeToDocument('polls', pollId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('polls', callback, filters, orderByField, orderDirection)
};

// Flash Deals Collection
export const flashDealsCollection = {
  get: (dealId: string) => getDocument('flashDeals', dealId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('flashDeals', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('flashDeals', data),
  update: (dealId: string, data: any) => updateDocument('flashDeals', dealId, data),
  delete: (dealId: string) => deleteDocument('flashDeals', dealId),
  subscribe: (dealId: string, callback: any) => subscribeToDocument('flashDeals', dealId, callback),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('flashDeals', callback, filters, orderByField, orderDirection)
};

// Staff Collection
export const staffCollection = {
  get: (staffId: string) => getDocument('staff', staffId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('staff', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('staff', data),
  update: (staffId: string, data: any) => updateDocument('staff', staffId, data),
  delete: (staffId: string) => deleteDocument('staff', staffId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('staff', callback, filters, orderByField, orderDirection)
};

// Expenses Collection
export const expensesCollection = {
  get: (expenseId: string) => getDocument('expenses', expenseId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('expenses', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('expenses', data),
  update: (expenseId: string, data: any) => updateDocument('expenses', expenseId, data),
  delete: (expenseId: string) => deleteDocument('expenses', expenseId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('expenses', callback, filters, orderByField, orderDirection)
};

// Salary Records Collection
export const salaryRecordsCollection = {
  get: (recordId: string) => getDocument('salaryRecords', recordId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('salaryRecords', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('salaryRecords', data),
  update: (recordId: string, data: any) => updateDocument('salaryRecords', recordId, data),
  delete: (recordId: string) => deleteDocument('salaryRecords', recordId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('salaryRecords', callback, filters, orderByField, orderDirection)
};

// Tournaments Collection
export const tournamentsCollection = {
  get: (tournamentId: string) => getDocument('tournaments', tournamentId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('tournaments', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('tournaments', data),
  update: (tournamentId: string, data: any) => updateDocument('tournaments', tournamentId, data),
  delete: (tournamentId: string) => deleteDocument('tournaments', tournamentId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('tournaments', callback, filters, orderByField, orderDirection)
};

// Marketing Campaigns Collection
export const marketingCampaignsCollection = {
  get: (campaignId: string) => getDocument('marketingCampaigns', campaignId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('marketingCampaigns', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('marketingCampaigns', data),
  update: (campaignId: string, data: any) => updateDocument('marketingCampaigns', campaignId, data),
  delete: (campaignId: string) => deleteDocument('marketingCampaigns', campaignId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('marketingCampaigns', callback, filters, orderByField, orderDirection)
};

// Support Tickets Collection
export const supportTicketsCollection = {
  get: (ticketId: string) => getDocument('supportTickets', ticketId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('supportTickets', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('supportTickets', data),
  update: (ticketId: string, data: any) => updateDocument('supportTickets', ticketId, data),
  delete: (ticketId: string) => deleteDocument('supportTickets', ticketId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('supportTickets', callback, filters, orderByField, orderDirection)
};

// Teams Collection
export const teamsCollection = {
  get: (teamId: string) => getDocument('teams', teamId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('teams', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('teams', data),
  update: (teamId: string, data: any) => updateDocument('teams', teamId, data),
  delete: (teamId: string) => deleteDocument('teams', teamId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('teams', callback, filters, orderByField, orderDirection)
};

// Wallet Transactions Collection
export const walletTransactionsCollection = {
  get: (transactionId: string) => getDocument('walletTransactions', transactionId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('walletTransactions', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('walletTransactions', data),
  update: (transactionId: string, data: any) => updateDocument('walletTransactions', transactionId, data),
  delete: (transactionId: string) => deleteDocument('walletTransactions', transactionId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('walletTransactions', callback, filters, orderByField, orderDirection)
};

// App Settings Collection (Single document: 'platform')
export const appSettingsCollection = {
  get: () => getDocument('appSettings', 'platform'),
  update: (data: any) => updateDocument('appSettings', 'platform', data),
  subscribe: (callback: any) => subscribeToDocument('appSettings', 'platform', callback),
  create: (data: any) => setDocument('appSettings', 'platform', data)
};

// Landing Page Content Collection (Single document: 'landing')
export const landingPageCollection = {
  get: () => getDocument('landingPage', 'landing'),
  update: (data: any) => updateDocument('landingPage', 'landing', data),
  subscribe: (callback: any) => subscribeToDocument('landingPage', 'landing', callback),
  create: (data: any) => setDocument('landingPage', 'landing', data)
};

// CMS Pages Collection (frontend CMS – multiple documents)
export const cmsPagesCollection = {
  get: (pageId: string) => getDocument('cmsPages', pageId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) =>
    getDocuments('cmsPages', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('cmsPages', data),
  update: (pageId: string, data: any) => updateDocument('cmsPages', pageId, data),
  delete: (pageId: string) => deleteDocument('cmsPages', pageId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') =>
    subscribeToCollection('cmsPages', callback, filters, orderByField, orderDirection)
};

// Notifications Collection
export const notificationsCollection = {
  get: (notificationId: string) => getDocument('notifications', notificationId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('notifications', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('notifications', data),
  update: (notificationId: string, data: any) => updateDocument('notifications', notificationId, data),
  delete: (notificationId: string) => deleteDocument('notifications', notificationId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('notifications', callback, filters, orderByField, orderDirection)
};

// FCM Tokens Collection
export const fcmTokensCollection = {
  get: (tokenId: string) => getDocument('fcmTokens', tokenId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) => 
    getDocuments('fcmTokens', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('fcmTokens', data),
  update: (tokenId: string, data: any) => updateDocument('fcmTokens', tokenId, data),
  delete: (tokenId: string) => deleteDocument('fcmTokens', tokenId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc') => 
    subscribeToCollection('fcmTokens', callback, filters, orderByField, orderDirection)
};

// Invoices Collection
export const invoicesCollection = {
  get: (invoiceId: string) => getDocument('invoices', invoiceId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) =>
    getDocuments('invoices', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('invoices', data),
  update: (invoiceId: string, data: any) => updateDocument('invoices', invoiceId, data),
  delete: (invoiceId: string) => deleteDocument('invoices', invoiceId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', errorCallback?: (error: any) => void) =>
    subscribeToCollection('invoices', callback, filters, orderByField, orderDirection, errorCallback)
};

// Payments Collection
export const paymentsCollection = {
  get: (paymentId: string) => getDocument('payments', paymentId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) =>
    getDocuments('payments', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('payments', data),
  update: (paymentId: string, data: any) => updateDocument('payments', paymentId, data),
  delete: (paymentId: string) => deleteDocument('payments', paymentId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', errorCallback?: (error: any) => void) =>
    subscribeToCollection('payments', callback, filters, orderByField, orderDirection, errorCallback)
};

// Settlements Collection
export const settlementsCollection = {
  get: (settlementId: string) => getDocument('settlements', settlementId),
  getAll: (filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', limitCount?: number) =>
    getDocuments('settlements', filters, orderByField, orderDirection, limitCount),
  create: (data: any) => createDocument('settlements', data),
  update: (settlementId: string, data: any) => updateDocument('settlements', settlementId, data),
  delete: (settlementId: string) => deleteDocument('settlements', settlementId),
  subscribeAll: (callback: any, filters?: any[], orderByField?: string, orderDirection?: 'asc' | 'desc', errorCallback?: (error: any) => void) =>
    subscribeToCollection('settlements', callback, filters, orderByField, orderDirection, errorCallback)
};

export default {
  auth,
  db,
  storage,
  messaging
};

