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

/**
 * Lazy loads Firebase and Firestore on-demand to achieve instantaneous page loads
 * and avoid bundling 480KB of SDK in the critical path.
 */
export async function initFirebase(customConfig = null) {
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
    return { isConfigured: true, db: firestoreDb, app: firebaseApp, error: null };
  } catch (error) {
    console.warn('Firebase initialization error, fallback to local storage:', error.message);
    isConfigured = false;
    firestoreDb = null;
    return { isConfigured: false, db: null, error: error.message };
  }
}

/**
 * Ensures Firebase is initialized and returns the Firestore instance.
 */
export async function getDbInstance(customConfig = null) {
  if (firestoreDb) return firestoreDb;
  if (!initPromise) {
    initPromise = initFirebase(customConfig);
  }
  const result = await initPromise;
  initPromise = null;
  return result.db;
}

export const isFirebaseActive = () => isConfigured;
export const getDb = () => firestoreDb;
