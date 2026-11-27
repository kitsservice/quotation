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

const OLD_COMPANY_NAMES = [
  'KITS ROBOTICS AND AUTOMATION PVT.LTD.',
  'KITS Robotics and Automation Pvt.Ltd.',
  'KITS Robotics & Automation Pvt.Ltd',
  'KITS Robotics & Automation Pvt. Ltd.',
  'KITS Robotics and Automation Pvt.Ltd',
  'KITS ROBOTICS & AUTOMATION PVT. LTD.',
  'KITS ROBOTICS & AUTOMATION PVT.LTD',
  'KITS Robotics & Automation',
  'KITS Robotics & Automation Pvt Ltd'
];

export function normalizeCompanySettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { ...defaultCompanySettings };
  }
  const currentName = (settings.name || '').trim();
  if (!currentName || OLD_COMPANY_NAMES.includes(currentName)) {
    settings.name = 'KITS ROBOTICS & AUTOMATION PVT.LTD.';
  }
  const currentBankName = (settings.bankAccountName || '').trim();
  if (!currentBankName || OLD_COMPANY_NAMES.includes(currentBankName)) {
    settings.bankAccountName = 'KITS ROBOTICS & AUTOMATION PVT.LTD.';
  }
  const OLD_BANKS = ['HDFC Bank Ltd.', 'HDFC Bank', 'HDFC Bank Ltd'];
  const OLD_ACCOUNTS = ['50200012345678'];
  const OLD_IFSC = ['HDFC0000123'];

  if (!settings.bankName || OLD_BANKS.includes(settings.bankName.trim())) {
    settings.bankName = 'CITY UNION BANK';
  }
  if (!settings.accountNumber || OLD_ACCOUNTS.includes(settings.accountNumber.trim())) {
    settings.accountNumber = '510909010369706';
  }
  if (!settings.ifscCode || OLD_IFSC.includes(settings.ifscCode.trim())) {
    settings.ifscCode = 'CIUB0000800';
  }
  if (!settings.branch || settings.branch === 'Akola Branch' || settings.branch === 'Akola') {
    settings.branch = 'Akola Branch';
  }
  if (Array.isArray(settings.defaultTerms)) {
    settings.defaultTerms = settings.defaultTerms.map(t => {
      if (typeof t === 'string' && (t.includes('50% in advance') || t.includes('100% in advance'))) {
        return 'Payment Terms: 75% in advance along with PO, 25% before dispatch.';
      }
      return t;
    });
  }
  return settings;
}

export function getLocalCompanySettings() {
  if (cachedCompanySettings !== null) {
    return cachedCompanySettings;
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        normalizeCompanySettings(parsed);
        safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, parsed);
        cachedCompanySettings = parsed;
        return cachedCompanySettings;
      }
    }
  } catch (e) {
    console.warn('Error reading local settings:', e);
  }
  cachedCompanySettings = { ...defaultCompanySettings };
  return cachedCompanySettings;
}

// ==================== QUOTATION & PROFORMA NUMBER GENERATOR ====================

// Precompiled regular expressions for fast ID generation
const TRAILING_DIGITS_REGEX = /(\d+)$/;
const DC_PREFIX_REGEX = /^DC-/i;
const INV_PREFIX_REGEX = /^INV-/i;

// Sequential Quotation Number Generator starting strictly from 1 (e.g. KITS/AKL/026/11/001)
export function generateNextQuotationNumber(existingQuotes = [], prefix = 'KITS/AKL') {
  const d = new Date();
  const currentYear = d.getFullYear().toString().slice(-2);
  const currentMonth = (d.getMonth() + 1).toString().padStart(2, '0');
  const basePrefix = `${prefix}/0${currentYear}/${currentMonth}/`;

  let maxSeq = 0;
  const list = Array.isArray(existingQuotes) ? existingQuotes : [];
  for (let i = 0; i < list.length; i++) {
    const qNum = list[i]?.quotationNumber;
    if (qNum) {
      if (qNum.startsWith(basePrefix)) {
        const num = parseInt(qNum.slice(basePrefix.length).trim(), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else {
        const match = qNum.match(TRAILING_DIGITS_REGEX);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${basePrefix}${nextSeq}`;
}

// Sequential Delivery Challan Number Generator under Rule 55 (e.g. KITS/DC/026/11/001)
export function generateNextDeliveryChallanNumber(existingDocs = [], prefix = 'KITS/DC') {
  const d = new Date();
  const currentYear = d.getFullYear().toString().slice(-2);
  const currentMonth = (d.getMonth() + 1).toString().padStart(2, '0');
  const basePrefix = `${prefix}/0${currentYear}/${currentMonth}/`;

  let maxSeq = 0;
  const list = Array.isArray(existingDocs) ? existingDocs : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const numStr = item.challanNo || item.invoiceNo || item.quotationNumber;
    if (numStr) {
      if (numStr.startsWith(basePrefix)) {
        const num = parseInt(numStr.slice(basePrefix.length).trim(), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (DC_PREFIX_REGEX.test(numStr)) {
        const num = parseInt(numStr.replace(DC_PREFIX_REGEX, ''), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (item.documentType === 'Delivery Challan' || item.isDeliveryChallan) {
        const match = numStr.match(TRAILING_DIGITS_REGEX);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${basePrefix}${nextSeq}`;
}

// Sequential Demo Delivery Challan Number Generator under Rule 55 (e.g. KITS/DCD/001) starting strictly from 001
export function generateNextDemoChallanNumber(existingDocs = [], prefix = 'KITS/DCD') {
  const basePrefix = `${prefix}/`;
  let maxSeq = 0;
  const list = Array.isArray(existingDocs) ? existingDocs : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const numStr = item.challanNo || item.invoiceNo || item.quotationNumber;
    if (numStr) {
      if (numStr.startsWith(basePrefix)) {
        const num = parseInt(numStr.slice(basePrefix.length).trim(), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (numStr.includes('DCD/')) {
        const match = numStr.match(/DCD\/(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  }
  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${basePrefix}${nextSeq}`;
}

// Sequential Proforma Invoice Number Generator starting strictly from 1 or linked directly to Quotation
export function generateNextProformaNumber(existingDocs = [], linkedQuote = null) {
  if (linkedQuote?.quotationNumber) {
    const match = linkedQuote.quotationNumber.match(TRAILING_DIGITS_REGEX);
    if (match) {
      return `PI-${match[1]}`;
    }
    return `PI-${linkedQuote.quotationNumber}`;
  }

  let maxSeq = 0;
  const list = Array.isArray(existingDocs) ? existingDocs : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const numStr = item?.invoiceNo || item?.quotationNumber;
    if (numStr) {
      const match = numStr.match(TRAILING_DIGITS_REGEX);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `PI-${nextSeq}`;
}

// Sequential Final Tax Invoice Number Generator starting strictly from 1 (e.g. KITS/INV/026/11/001)
export function generateNextTaxInvoiceNumber(existingDocs = [], prefix = 'KITS/INV') {
  const d = new Date();
  const currentYear = d.getFullYear().toString().slice(-2);
  const currentMonth = (d.getMonth() + 1).toString().padStart(2, '0');
  const basePrefix = `${prefix}/0${currentYear}/${currentMonth}/`;

  let maxSeq = 0;
  const list = Array.isArray(existingDocs) ? existingDocs : [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    const numStr = item.invoiceNo || item.quotationNumber;
    if (numStr) {
      if (numStr.startsWith(basePrefix)) {
        const num = parseInt(numStr.slice(basePrefix.length).trim(), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (INV_PREFIX_REGEX.test(numStr)) {
        const num = parseInt(numStr.replace(INV_PREFIX_REGEX, ''), 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      } else if (item.documentType === 'Tax Invoice' || item.isTaxInvoice) {
        const match = numStr.match(TRAILING_DIGITS_REGEX);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      }
    }
  }

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
          // Merge local and cloud documents so no laptop's locally created documents are lost
          const mergedMap = new Map();
          (localList || []).forEach(item => {
            if (item && item.id) mergedMap.set(item.id, item);
          });
          list.forEach(item => {
            if (item && item.id) {
              const local = mergedMap.get(item.id);
              if (!local || new Date(item.updatedAt || 0) >= new Date(local.updatedAt || 0)) {
                mergedMap.set(item.id, item);
              }
            }
          });
          const mergedList = Array.from(mergedMap.values());
          mergedList.sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
          cachedQuotations = mergedList;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, mergedList);
          return mergedList;
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
          // Merge local and cloud clients cleanly
          const clientMap = new Map();
          (localList || []).forEach(c => {
            const key = (c.companyName || c.name || c.id || '').trim().toLowerCase();
            if (key) clientMap.set(key, c);
          });
          list.forEach(c => {
            const key = (c.companyName || c.name || c.id || '').trim().toLowerCase();
            if (key) {
              const local = clientMap.get(key);
              clientMap.set(key, { ...(local || {}), ...c });
            }
          });
          const merged = Array.from(clientMap.values());
          merged.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
          cachedClients = merged;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, merged);
          return merged;
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
          // Merge local and cloud products cleanly
          const prodMap = new Map();
          (localList || []).forEach(p => {
            const key = (p.id || p.name || '').trim().toLowerCase();
            if (key) prodMap.set(key, p);
          });
          list.forEach(p => {
            const key = (p.id || p.name || '').trim().toLowerCase();
            if (key) {
              const local = prodMap.get(key);
              prodMap.set(key, { ...(local || {}), ...p });
            }
          });
          const merged = Array.from(prodMap.values());
          merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          cachedProducts = merged;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, merged);
          return merged;
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
          normalizeCompanySettings(settings);
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
    const existing = getLocalQuotations();
    const merged = [...backupData.quotations];
    const existingMap = new Map();
    for (let i = 0; i < backupData.quotations.length; i++) {
      const q = backupData.quotations[i];
      if (q?.id) existingMap.set(q.id, true);
    }
    for (let i = 0; i < existing.length; i++) {
      const q = existing[i];
      if (q?.id && !existingMap.has(q.id)) {
        merged.push(q);
      }
    }
    merged.sort((a, b) => new Date((b && (b.updatedAt || b.date)) || 0) - new Date((a && (a.updatedAt || a.date)) || 0));
    cachedQuotations = merged;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, merged);
  }

  if (Array.isArray(backupData.clients)) {
    const existing = getLocalClients();
    const combined = [...backupData.clients, ...existing];
    const deduped = [];
    const seen = new Set();
    for (let i = 0; i < combined.length; i++) {
      const c = combined[i];
      if (!c) continue;
      const key = (c.companyName || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(c);
    }
    cachedClients = deduped;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, deduped);
  }

  if (Array.isArray(backupData.products)) {
    const existing = getLocalProducts();
    const combined = [...backupData.products];
    const seenNames = new Set(backupData.products.map(p => (p.name || '').trim().toLowerCase()));
    for (let i = 0; i < existing.length; i++) {
      const p = existing[i];
      const key = (p.name || '').trim().toLowerCase();
      if (key && !seenNames.has(key)) {
        combined.push(p);
      }
    }
    cachedProducts = combined;
    safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, combined);
  }

  if (backupData.settings && typeof backupData.settings === 'object') {
    normalizeCompanySettings(backupData.settings);
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
