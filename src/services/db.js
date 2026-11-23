import { getDbInstance, isFirebaseActive } from './firebase';
import { 
  defaultCompanySettings, 
  sampleClients, 
  sampleProducts, 
  sampleQuotations 
} from './initialData';

export const LOCAL_STORAGE_KEYS = {
  QUOTATIONS: 'kits_quotations_data',
  CLIENTS: 'kits_clients_data',
  PRODUCTS: 'kits_products_data',
  SETTINGS: 'kits_company_settings'
};

// ==================== IN-MEMORY HIGH PERFORMANCE CACHE ====================
// Eliminates repetitive synchronous JSON.parse & disk reads across components
let cachedQuotations = null;
let cachedClients = null;
let cachedProducts = null;
let cachedCompanySettings = null;

// Dynamic Firestore module loader for zero initial bundle bloat
let firestoreOpsPromise = null;
function getFirestoreOps() {
  if (!firestoreOpsPromise) {
    firestoreOpsPromise = import('firebase/firestore');
  }
  return firestoreOpsPromise;
}

function safeSetLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`LocalStorage write warning for ${key}:`, err.message);
  }
}

// Safe timeout wrapper to prevent Firestore hanging on network/auth blocks
function withTimeout(promise, ms = 2000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase connection timeout')), ms))
  ]);
}

// Seed LocalStorage with official KITS Akola settings and clean blank slate
export function initializeLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;

    const currentSettings = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
    if (!currentSettings) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(defaultCompanySettings));
    }

    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.QUOTATIONS)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.QUOTATIONS, JSON.stringify([]));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENTS)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.CLIENTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    }
  } catch (e) {
    console.warn('LocalStorage access issue:', e);
  }
}

export function clearAllData() {
  cachedQuotations = [];
  cachedClients = [];
  cachedProducts = [];
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, []);
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, []);
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, []);
  try {
    localStorage.setItem('kits_blank_slate_initialized', 'v3_clean_blank');
  } catch {
    // ignore
  }
}

initializeLocalStorage();

// ==================== INSTANT SYNCHRONOUS READS WITH IN-MEMORY CACHE ====================

export function getLocalQuotations() {
  if (cachedQuotations !== null) {
    return cachedQuotations;
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.QUOTATIONS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.sort((a, b) => new Date((b && (b.updatedAt || b.date)) || 0) - new Date((a && (a.updatedAt || a.date)) || 0));
        cachedQuotations = parsed.filter(Boolean);
        return cachedQuotations;
      }
    }
  } catch (e) {
    console.warn('Error reading local quotations:', e);
  }
  cachedQuotations = [];
  return cachedQuotations;
}

export function getLocalClients() {
  if (cachedClients !== null) {
    return cachedClients;
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.CLIENTS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Strict deduplication by companyName to prevent multiple cards with same name
        const deduped = [];
        const seen = new Set();
        for (let i = 0; i < parsed.length; i++) {
          const c = parsed[i];
          if (!c) continue;
          const key = (c.companyName || '').trim().toLowerCase();
          if (!key) continue;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(c);
          }
        }
        cachedClients = deduped;
        return cachedClients;
      }
    }
  } catch (e) {
    console.warn('Error reading local clients:', e);
  }
  cachedClients = [];
  return cachedClients;
}

export function getLocalProducts() {
  if (cachedProducts !== null) {
    return cachedProducts;
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedProducts = parsed;
        return cachedProducts;
      }
    }
  } catch (e) {
    console.warn('Error reading local products:', e);
  }
  cachedProducts = [];
  return cachedProducts;
}

export function getLocalCompanySettings() {
  if (cachedCompanySettings !== null) {
    return cachedCompanySettings;
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) {
        if (
          parsed.name === 'KITS ROBOTICS AND AUTOMATION PVT.LTD.' || 
          parsed.name === 'KITS Robotics and Automation Pvt.Ltd.' ||
          parsed.name === 'KITS ROBOTICS & AUTOMATION PVT.LTD.'
        ) {
          parsed.name = 'KITS Robotics & Automation Pvt.Ltd';
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, parsed);
        }
        cachedCompanySettings = parsed;
        return cachedCompanySettings;
      }
    }
  } catch (e) {
    console.warn('Error reading local settings:', e);
  }
  cachedCompanySettings = defaultCompanySettings;
  return cachedCompanySettings;
}

// ==================== QUOTATION & PROFORMA NUMBER GENERATOR ====================

// Sequential Quotation Number Generator starting strictly from 1 (e.g. KITS/AKL/026/11/001)
export function generateNextQuotationNumber(existingQuotes = [], prefix = 'KITS/AKL') {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const basePrefix = `${prefix}/0${currentYear}/${currentMonth}/`;

  let maxSeq = 0;
  (existingQuotes || []).forEach(q => {
    if (q?.quotationNumber) {
      if (q.quotationNumber.startsWith(basePrefix)) {
        const numPart = q.quotationNumber.replace(basePrefix, '').trim();
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else {
        const match = q.quotationNumber.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${basePrefix}${nextSeq}`;
}

// Sequential Delivery Challan Number Generator under Rule 55 (e.g. KITS/DC/026/11/001)
export function generateNextDeliveryChallanNumber(existingDocs = [], prefix = 'KITS/DC') {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const basePrefix = `${prefix}/0${currentYear}/${currentMonth}/`;

  let maxSeq = 0;
  (existingDocs || []).forEach(d => {
    const numStr = d.challanNo || d.invoiceNo || d.quotationNumber;
    if (numStr) {
      if (numStr.startsWith(basePrefix)) {
        const numPart = numStr.replace(basePrefix, '').trim();
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (numStr.startsWith('DC-')) {
        const num = parseInt(numStr.replace('DC-', ''), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (d.documentType === 'Delivery Challan' || d.isDeliveryChallan) {
        const match = numStr.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${basePrefix}${nextSeq}`;
}

// Sequential Proforma Invoice Number Generator starting strictly from 1 or linked directly to Quotation
export function generateNextProformaNumber(existingDocs = [], linkedQuote = null) {
  if (linkedQuote?.quotationNumber) {
    const match = linkedQuote.quotationNumber.match(/(\d+)$/);
    if (match) {
      return `PI-${match[1]}`;
    }
    return `PI-${linkedQuote.quotationNumber}`;
  }

  let maxSeq = 0;
  (existingDocs || []).forEach(d => {
    const numStr = d.invoiceNo || d.quotationNumber;
    if (numStr) {
      const match = numStr.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `PI-${nextSeq}`;
}

// Sequential Final Tax Invoice Number Generator starting strictly from 1 (e.g. KITS/INV/026/11/001)
export function generateNextTaxInvoiceNumber(existingDocs = [], prefix = 'KITS/INV') {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  const basePrefix = `${prefix}/0${currentYear}/${currentMonth}/`;

  let maxSeq = 0;
  (existingDocs || []).forEach(d => {
    const numStr = d.invoiceNo || d.quotationNumber;
    if (numStr) {
      if (numStr.startsWith(basePrefix)) {
        const numPart = numStr.replace(basePrefix, '').trim();
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (numStr.startsWith('INV-')) {
        const num = parseInt(numStr.replace('INV-', ''), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (d.documentType === 'Tax Invoice' || d.isTaxInvoice) {
        const match = numStr.match(/(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  });

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${basePrefix}${nextSeq}`;
}

// ==================== QUOTATIONS ====================

export async function fetchQuotations() {
  const localList = getLocalQuotations();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { collection, getDocs } = await getFirestoreOps();
        const querySnapshot = await withTimeout(getDocs(collection(db, 'quotations')), 2500);
        const list = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (list.length > 0) {
          list.sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
          cachedQuotations = list;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, list);
          return list;
        }
      }
    } catch (err) {
      console.warn('Firestore quotations sync skipped:', err.message);
    }
  }

  return localList;
}

export async function saveQuotation(quotation) {
  const id = quotation.id || 'quot-' + Date.now();
  const now = new Date().toISOString();
  const quoteData = {
    ...quotation,
    id,
    updatedAt: now,
    createdAt: quotation.createdAt || now
  };

  const localQuotes = [...getLocalQuotations()];
  const existingIdx = localQuotes.findIndex(q => q.id === id);
  if (existingIdx >= 0) {
    localQuotes[existingIdx] = quoteData;
  } else {
    localQuotes.unshift(quoteData);
  }
  
  cachedQuotations = localQuotes;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, localQuotes);

  // Background non-blocking cloud persistence
  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, setDoc } = await getFirestoreOps();
      withTimeout(setDoc(doc(db, 'quotations', id), quoteData, { merge: true }), 3000)
        .catch(err => console.warn('Background Firestore save skipped:', err.message));
    }
  }).catch(() => {});

  return quoteData;
}

export async function deleteQuotation(id) {
  const localQuotes = getLocalQuotations().filter(q => q.id !== id);
  cachedQuotations = localQuotes;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, localQuotes);

  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, deleteDoc } = await getFirestoreOps();
      withTimeout(deleteDoc(doc(db, 'quotations', id)), 3000)
        .catch(err => console.warn('Background Firestore delete skipped:', err.message));
    }
  }).catch(() => {});

  return true;
}

// ==================== CLIENTS ====================

export async function fetchClients() {
  const localList = getLocalClients();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { collection, getDocs } = await getFirestoreOps();
        const snap = await withTimeout(getDocs(collection(db, 'clients')), 2500);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          list.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
          cachedClients = list;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, list);
          return list;
        }
      }
    } catch (err) {
      console.warn('Firestore clients sync skipped:', err.message);
    }
  }

  return localList;
}

export async function saveClient(client) {
  const localList = [...getLocalClients()];
  const cleanName = (client.companyName || '').trim().toLowerCase();
  const cleanGstin = (client.gstin || '').trim().toUpperCase();

  // Find existing by ID, companyName, or GSTIN
  const idx = localList.findIndex(c => 
    (client.id && c.id === client.id) ||
    (cleanName && (c.companyName || '').trim().toLowerCase() === cleanName) ||
    (cleanGstin && cleanGstin.length >= 15 && (c.gstin || '').trim().toUpperCase() === cleanGstin)
  );

  const id = idx >= 0 ? localList[idx].id : (client.id || 'client-' + Date.now());
  const clientData = {
    ...(idx >= 0 ? localList[idx] : {}),
    ...client,
    id
  };

  if (idx >= 0) {
    localList[idx] = clientData;
  } else {
    localList.push(clientData);
  }

  // Deduplicate list strictly by companyName
  const dedupedList = [];
  const seenNames = new Set();
  for (let i = 0; i < localList.length; i++) {
    const c = localList[i];
    const key = (c.companyName || '').trim().toLowerCase();
    if (!key) continue;
    if (!seenNames.has(key)) {
      seenNames.add(key);
      dedupedList.push(c);
    }
  }

  cachedClients = dedupedList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, dedupedList);

  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, setDoc } = await getFirestoreOps();
      withTimeout(setDoc(doc(db, 'clients', id), clientData, { merge: true }), 3000)
        .catch(err => console.warn('Background Firestore client save skipped:', err.message));
    }
  }).catch(() => {});

  return clientData;
}

export async function deleteClient(id) {
  const localList = getLocalClients().filter(c => c.id !== id);
  cachedClients = localList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, localList);

  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, deleteDoc } = await getFirestoreOps();
      withTimeout(deleteDoc(doc(db, 'clients', id)), 3000)
        .catch(err => console.warn('Background Firestore client delete skipped:', err.message));
    }
  }).catch(() => {});

  return true;
}

// ==================== PRODUCTS ====================

export async function fetchProducts() {
  const localList = getLocalProducts();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { collection, getDocs } = await getFirestoreOps();
        const snap = await withTimeout(getDocs(collection(db, 'products')), 2500);
        const list = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        if (list.length > 0) {
          list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          cachedProducts = list;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, list);
          return list;
        }
      }
    } catch (err) {
      console.warn('Firestore products sync skipped:', err.message);
    }
  }

  return localList;
}

export async function saveProduct(product) {
  const id = product.id || 'prod-' + Date.now();
  const prodData = { ...product, id };

  const localList = [...getLocalProducts()];
  const idx = localList.findIndex(p => p.id === id);
  if (idx >= 0) {
    localList[idx] = prodData;
  } else {
    localList.push(prodData);
  }
  cachedProducts = localList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, localList);

  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, setDoc } = await getFirestoreOps();
      withTimeout(setDoc(doc(db, 'products', id), prodData, { merge: true }), 3000)
        .catch(err => console.warn('Background Firestore product save skipped:', err.message));
    }
  }).catch(() => {});

  return prodData;
}

export async function deleteProduct(id) {
  const localList = getLocalProducts().filter(p => p.id !== id);
  cachedProducts = localList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, localList);

  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, deleteDoc } = await getFirestoreOps();
      withTimeout(deleteDoc(doc(db, 'products', id)), 3000)
        .catch(err => console.warn('Background Firestore product delete skipped:', err.message));
    }
  }).catch(() => {});

  return true;
}

// ==================== COMPANY SETTINGS ====================

export async function fetchCompanySettings() {
  const localSettings = getLocalCompanySettings();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, getDoc } = await getFirestoreOps();
        const docSnap = await withTimeout(getDoc(doc(db, 'settings', 'company')), 2500);
        if (docSnap.exists()) {
          const settings = docSnap.data();
          cachedCompanySettings = settings;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, settings);
          return settings;
        }
      }
    } catch (err) {
      console.warn('Firestore settings sync skipped:', err.message);
    }
  }

  return localSettings;
}

export async function saveCompanySettings(settings) {
  cachedCompanySettings = settings;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, settings);

  getDbInstance().then(async (db) => {
    if (db) {
      const { doc, setDoc } = await getFirestoreOps();
      withTimeout(setDoc(doc(db, 'settings', 'company'), settings, { merge: true }), 3000)
        .catch(err => console.warn('Background Firestore settings save skipped:', err.message));
    }
  }).catch(() => {});

  return settings;
}

// ==================== BACKUP & RESTORE ====================

export function exportDatabaseBackup() {
  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    quotations: getLocalQuotations(),
    clients: getLocalClients(),
    products: getLocalProducts(),
    settings: getLocalCompanySettings()
  };
}

export async function importDatabaseBackup(backupData) {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Invalid backup file format');
  }

  if (Array.isArray(backupData.quotations)) {
    cachedQuotations = backupData.quotations;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, backupData.quotations);
  }
  if (Array.isArray(backupData.clients)) {
    cachedClients = backupData.clients;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, backupData.clients);
  }
  if (Array.isArray(backupData.products)) {
    cachedProducts = backupData.products;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, backupData.products);
  }
  if (backupData.settings && typeof backupData.settings === 'object') {
    cachedCompanySettings = backupData.settings;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, backupData.settings);
  }

  if (isFirebaseActive()) {
    try {
      await syncAllToFirebase();
    } catch (e) {
      console.warn('Cloud sync after import skipped:', e);
    }
  }

  return true;
}

export function resetToFactoryDefaultData() {
  cachedCompanySettings = defaultCompanySettings;
  cachedClients = sampleClients;
  cachedProducts = sampleProducts;
  cachedQuotations = sampleQuotations;

  safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, defaultCompanySettings);
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, sampleClients);
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, sampleProducts);
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, sampleQuotations);
  return true;
}

export async function syncAllToFirebase() {
  const db = await getDbInstance();
  if (!db) {
    throw new Error('Firebase is not connected. Please verify your configuration in Settings.');
  }

  const { doc, writeBatch } = await getFirestoreOps();
  const quotes = getLocalQuotations();
  const clients = getLocalClients();
  const products = getLocalProducts();
  const settings = getLocalCompanySettings();

  const batch = writeBatch(db);

  if (settings && settings.name) {
    batch.set(doc(db, 'settings', 'company'), settings, { merge: true });
  }

  clients.forEach(client => {
    if (client.id) {
      batch.set(doc(db, 'clients', client.id), client, { merge: true });
    }
  });

  products.forEach(product => {
    if (product.id) {
      batch.set(doc(db, 'products', product.id), product, { merge: true });
    }
  });

  quotes.forEach(quote => {
    if (quote.id) {
      batch.set(doc(db, 'quotations', quote.id), quote, { merge: true });
    }
  });

  await withTimeout(batch.commit(), 10000);

  return {
    quotationsSynced: quotes.length,
    clientsSynced: clients.length,
    productsSynced: products.length
  };
}
