export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCvg4Uh0D6rfblWkJvEJX2PHHqEaGJsAMQ",
  authDomain: "quotation-maker-1ac73.firebaseapp.com",
  projectId: "quotation-maker-1ac73",
  storageBucket: "quotation-maker-1ac73.firebasestorage.app",
  messagingSenderId: "131348630748",
  appId: "1:131348630748:web:189a8c0c03cb0355473819",
  measurementId: "G-QNGHZC4Q7B"
};

// Check if user has entered custom Firebase config in localStorage
export function getStoredFirebaseConfig() {
  try {
    const customConfig = localStorage.getItem('kits_firebase_config');
    if (customConfig) {
      const parsed = JSON.parse(customConfig);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading stored Firebase config', e);
  }
  
  // Return embedded config or env variables
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || DEFAULT_FIREBASE_CONFIG.measurementId
  };
}

let firebaseApp = null;
let firestoreDb = null;
let isConfigured = false;
let initPromise = null;
let lastFailureTime = 0;
const FAILURE_COOLDOWN_MS = 25000; // 25s cooldown after failure to prevent cascading timeouts

export function resetFirebaseCooldown() {
  lastFailureTime = 0;
  initPromise = null;
}

/**
 * Lazy loads Firebase and Firestore on-demand to achieve instantaneous page loads
 * and avoid bundling 480KB of SDK in the critical path.
 */
export async function initFirebase(customConfig = null) {
  if (!customConfig && lastFailureTime > 0 && (Date.now() - lastFailureTime < FAILURE_COOLDOWN_MS)) {
    return { isConfigured: false, db: null, error: 'Firebase cooldown active. Using fast local cache.' };
  }

  const config = customConfig || getStoredFirebaseConfig();

  // Validate if minimum required fields are present
  if (!config.apiKey || !config.projectId) {
    isConfigured = false;
    firestoreDb = null;
    return { isConfigured: false, db: null, error: 'Firebase config missing or incomplete' };
  }

  try {
    const [{ initializeApp, getApps, getApp }, { getFirestore }] = await Promise.all([
      import('firebase/app'),
      import('firebase/firestore')
    ]);

    if (getApps().length > 0) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp(config);
    }
    
    firestoreDb = getFirestore(firebaseApp);
    isConfigured = true;
    lastFailureTime = 0;
    return { isConfigured: true, db: firestoreDb, app: firebaseApp, error: null };
  } catch (error) {
    console.warn('Firebase initialization note (offline/fallback mode active):', error.message);
    isConfigured = false;
    firestoreDb = null;
    lastFailureTime = Date.now();
    return { isConfigured: false, db: null, error: error.message };
  }
}

/**
 * Ensures Firebase is initialized and returns the Firestore instance.
 */
export async function getDbInstance(customConfig = null) {
  if (firestoreDb) return firestoreDb;
  if (!customConfig && lastFailureTime > 0 && (Date.now() - lastFailureTime < FAILURE_COOLDOWN_MS)) {
    return null;
  }
  if (!initPromise) {
    initPromise = initFirebase(customConfig).finally(() => {
      initPromise = null;
    });
  }
  const result = await initPromise;
  return result?.db || null;
}

export const isFirebaseActive = () => isConfigured;
export const getDb = () => firestoreDb;

/**
 * Verifies live connectivity with Google Cloud Firestore.
 * Performs an actual read check so the user knows if the Cloud database is live or not created yet.
 */
export async function testFirestoreConnection(customConfig = null) {
  try {
    const res = await initFirebase(customConfig);
    if (!res.isConfigured || !res.db) {
      return { ok: false, error: res.error || 'Configuration incomplete' };
    }

    const { doc, getDoc } = await import('firebase/firestore');
    const testPromise = getDoc(doc(res.db, 'settings', 'ping'));
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out. Check internet or Firebase setup.')), 4500)
    );

    await Promise.race([testPromise, timeoutPromise]);
    return { ok: true, error: null };
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('not-found') || msg.includes('NOT_FOUND') || msg.includes('does not exist')) {
      return { 
        ok: false, 
        notFound: true,
        error: 'Database not initialized. Please click "Create Database" in Firebase Console (Firestore Database) to enable real-time cloud sync.' 
      };
    }
    return { ok: false, error: msg };
  }
}
