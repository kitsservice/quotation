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
  SETTINGS: 'kits_company_settings',
  DELETED_IDS: 'kits_deleted_record_ids',
  SYNCED_IDS: 'kits_synced_record_ids'
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
function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Firebase connection timeout')), ms))
  ]);
}

// ==================== DELETION TOMBSTONES & SYNC STATE TRACKING ====================

export function getDeletedIds() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.DELETED_IDS) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.warn('Error reading deleted IDs:', e);
  }
  return new Set();
}

export function markAsDeleted(id) {
  if (!id) return;
  try {
    const deletedSet = getDeletedIds();
    deletedSet.add(id);
    const arr = Array.from(deletedSet).slice(-2000);
    localStorage.setItem(LOCAL_STORAGE_KEYS.DELETED_IDS, JSON.stringify(arr));
  } catch (e) {
    console.warn('Error saving deleted ID:', e);
  }
}

export function unmarkDeleted(id) {
  if (!id) return;
  try {
    const deletedSet = getDeletedIds();
    if (deletedSet.has(id)) {
      deletedSet.delete(id);
      localStorage.setItem(LOCAL_STORAGE_KEYS.DELETED_IDS, JSON.stringify(Array.from(deletedSet)));
    }
  } catch {
    // ignore
  }
}

export function isDeleted(id) {
  if (!id) return false;
  return getDeletedIds().has(id);
}

export function getSyncedIds() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.SYNCED_IDS) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    console.warn('Error reading synced IDs:', e);
  }
  return new Set();
}

export function markAsSynced(idOrIds) {
  try {
    const syncedSet = getSyncedIds();
    if (Array.isArray(idOrIds)) {
      idOrIds.forEach(id => { if (id) syncedSet.add(id); });
    } else if (idOrIds) {
      syncedSet.add(idOrIds);
    }
    const arr = Array.from(syncedSet).slice(-5000);
    localStorage.setItem(LOCAL_STORAGE_KEYS.SYNCED_IDS, JSON.stringify(arr));
  } catch (e) {
    console.warn('Error saving synced IDs:', e);
  }
}

// Background helper to fetch cloud tombstones from Firestore so deletions sync across all devices
async function syncDeletedRecordsFromCloud(db, getOps) {
  try {
    const { collection, getDocs } = await getOps();
    const snap = await withTimeout(getDocs(collection(db, 'deleted_records')), 6000);
    const cloudDeleted = [];
    snap.forEach(d => cloudDeleted.push(d.id));
    if (cloudDeleted.length > 0) {
      const localDeleted = getDeletedIds();
      let changed = false;
      cloudDeleted.forEach(id => {
        if (!localDeleted.has(id)) {
          localDeleted.add(id);
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.DELETED_IDS, JSON.stringify(Array.from(localDeleted).slice(-2000)));
      }
    }
  } catch {
    // Non-blocking fallback
  }
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
  const deletedIds = getDeletedIds();
  if (cachedQuotations !== null) {
    return cachedQuotations.filter(q => q && q.id && !deletedIds.has(q.id));
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.QUOTATIONS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.sort((a, b) => new Date((b && (b.updatedAt || b.date)) || 0) - new Date((a && (a.updatedAt || a.date)) || 0));
        cachedQuotations = parsed.filter(q => q && q.id && !deletedIds.has(q.id));
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
  const deletedIds = getDeletedIds();
  if (cachedClients !== null) {
    return cachedClients.filter(c => c && c.id && !deletedIds.has(c.id));
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
          if (!c || !c.id || deletedIds.has(c.id)) continue;
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
  const deletedIds = getDeletedIds();
  if (cachedProducts !== null) {
    return cachedProducts.filter(p => p && p.id && !deletedIds.has(p.id));
  }

  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEYS.PRODUCTS) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedProducts = parsed.filter(p => p && p.id && !deletedIds.has(p.id));
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

// Sequential Final Tax Invoice Number Generator starting strictly from 001 (e.g. KITS/INV/001, KITS/INV/002)
export function generateNextTaxInvoiceNumber(existingDocs = [], prefix = 'KITS/INV') {
  const basePrefix = `${prefix}/`;

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
      } else if (numStr.includes('INV/')) {
        const match = numStr.match(/INV\/(?:0\d{2}\/\d{2}\/)?(\d+)/i) || numStr.match(/INV\/.*?(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
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

// Helper to sanitize payload for Firestore (strips undefined fields which cause Firestore errors)
function sanitizeForFirestore(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data;
  }
}

// ==================== QUOTATIONS ====================

export async function fetchQuotations() {
  const localList = getLocalQuotations();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { collection, getDocs, doc, setDoc } = await getFirestoreOps();
        await syncDeletedRecordsFromCloud(db, getFirestoreOps);

        const querySnapshot = await withTimeout(getDocs(collection(db, 'quotations')), 10000);
        const cloudList = [];
        querySnapshot.forEach((docSnap) => {
          cloudList.push({ id: docSnap.id, ...docSnap.data() });
        });

        const deletedIds = getDeletedIds();
        const activeCloudList = cloudList.filter(c => c && c.id && !deletedIds.has(c.id));
        markAsSynced(activeCloudList.map(c => c.id));
        const syncedIds = getSyncedIds();
        const cloudIds = new Set(activeCloudList.map(c => c.id));

        // Purge items from localList if they were deleted or were previously synced to cloud and are now absent
        const validLocalList = (localList || []).filter(item => {
          if (!item || !item.id) return false;
          if (deletedIds.has(item.id)) return false;
          if (syncedIds.has(item.id) && !cloudIds.has(item.id)) return false; // Was deleted from cloud!
          return true;
        });

        // 1. Merge cloud and valid local data
        const mergedMap = new Map();
        validLocalList.forEach(item => {
          mergedMap.set(item.id, item);
        });
        activeCloudList.forEach(item => {
          const local = mergedMap.get(item.id);
          if (!local || new Date(item.updatedAt || 0) >= new Date(local.updatedAt || 0)) {
            mergedMap.set(item.id, item);
          }
        });

        // 2. AUTO-SYNC: ONLY upload local items that are genuinely new (never synced and not deleted)
        const newUnsyncedLocal = validLocalList.filter(l => !cloudIds.has(l.id) && !syncedIds.has(l.id));
        if (newUnsyncedLocal.length > 0) {
          Promise.all(newUnsyncedLocal.map(item => 
            setDoc(doc(db, 'quotations', item.id), sanitizeForFirestore(item), { merge: true })
              .then(() => markAsSynced(item.id))
          )).catch(e => console.warn('Background quotation auto-upload error:', e));
        }

        const mergedList = Array.from(mergedMap.values());
        mergedList.sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
        cachedQuotations = mergedList;
        safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, mergedList);
        return mergedList;
      }
    } catch (err) {
      console.warn('Firestore quotations sync skipped:', err.message);
    }
  }

  const deletedIds = getDeletedIds();
  return (localList || []).filter(q => q && q.id && !deletedIds.has(q.id));
}

export async function saveQuotation(quotation) {
  const id = quotation.id || 'quot-' + Date.now();
  unmarkDeleted(id);
  const now = new Date().toISOString();
  const quoteData = {
    ...quotation,
    id,
    updatedAt: now,
    createdAt: quotation.createdAt || now
  };

  const localQuotes = [...getLocalQuotations().filter(q => q.id !== id)];
  localQuotes.unshift(quoteData);
  cachedQuotations = localQuotes;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, localQuotes);

  // Directly await saving to cloud if online so write is confirmed
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, setDoc } = await getFirestoreOps();
        await withTimeout(setDoc(doc(db, 'quotations', id), sanitizeForFirestore(quoteData), { merge: true }), 8000);
        markAsSynced(id);
      }
    } catch (err) {
      console.warn('Firestore direct save note (cached locally):', err.message);
    }
  }

  return quoteData;
}

export async function deleteQuotation(id) {
  if (!id) return true;
  markAsDeleted(id);

  const localQuotes = getLocalQuotations().filter(q => q.id !== id);
  cachedQuotations = localQuotes;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, localQuotes);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, deleteDoc, setDoc } = await getFirestoreOps();
        await withTimeout(Promise.all([
          deleteDoc(doc(db, 'quotations', id)),
          setDoc(doc(db, 'deleted_records', id), {
            id,
            type: 'quotation',
            deletedAt: new Date().toISOString()
          }, { merge: true })
        ]), 8000);
      }
    } catch (err) {
      console.warn('Firestore direct delete note:', err.message);
    }
  }

  return true;
}

// ==================== CLIENTS ====================

export async function fetchClients() {
  const localList = getLocalClients();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { collection, getDocs, doc, setDoc } = await getFirestoreOps();
        await syncDeletedRecordsFromCloud(db, getFirestoreOps);

        const snap = await withTimeout(getDocs(collection(db, 'clients')), 10000);
        const cloudList = [];
        snap.forEach(d => cloudList.push({ id: d.id, ...d.data() }));

        const deletedIds = getDeletedIds();
        const activeCloudList = cloudList.filter(c => c && c.id && !deletedIds.has(c.id));
        markAsSynced(activeCloudList.map(c => c.id));
        const syncedIds = getSyncedIds();
        const cloudIds = new Set(activeCloudList.map(c => c.id));

        // Purge items from localList if they were deleted or were previously synced to cloud and are now absent
        const validLocalList = (localList || []).filter(c => {
          if (!c || !c.id) return false;
          if (deletedIds.has(c.id)) return false;
          if (syncedIds.has(c.id) && !cloudIds.has(c.id)) return false; // Was deleted from cloud!
          return true;
        });

        const clientMap = new Map();
        validLocalList.forEach(c => {
          const key = (c.companyName || c.name || c.id || '').trim().toLowerCase();
          if (key) clientMap.set(key, c);
        });
        activeCloudList.forEach(c => {
          const key = (c.companyName || c.name || c.id || '').trim().toLowerCase();
          if (key) {
            const local = clientMap.get(key);
            clientMap.set(key, { ...(local || {}), ...c });
          }
        });

        // AUTO-SYNC: Push only genuinely new unsynced local clients to cloud
        const missingInCloud = validLocalList.filter(c => !cloudIds.has(c.id) && !syncedIds.has(c.id));
        if (missingInCloud.length > 0) {
          Promise.all(missingInCloud.map(c => 
            setDoc(doc(db, 'clients', c.id), sanitizeForFirestore(c), { merge: true })
              .then(() => markAsSynced(c.id))
          )).catch(e => console.warn('Background client auto-upload error:', e));
        }

        const merged = Array.from(clientMap.values());
        merged.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
        cachedClients = merged;
        safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, merged);
        return merged;
      }
    } catch (err) {
      console.warn('Firestore clients sync skipped:', err.message);
    }
  }

  const deletedIds = getDeletedIds();
  return (localList || []).filter(c => c && c.id && !deletedIds.has(c.id));
}

export async function saveClient(client) {
  const cleanName = (client.companyName || '').trim().toLowerCase();
  const cleanGstin = (client.gstin || '').trim().toUpperCase();

  const localList = [...getLocalClients()];
  // Find existing by ID, companyName, or GSTIN
  const idx = localList.findIndex(c => 
    (client.id && c.id === client.id) ||
    (cleanName && (c.companyName || '').trim().toLowerCase() === cleanName) ||
    (cleanGstin && cleanGstin.length >= 15 && (c.gstin || '').trim().toUpperCase() === cleanGstin)
  );

  const id = idx >= 0 ? localList[idx].id : (client.id || 'client-' + Date.now());
  unmarkDeleted(id);

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

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, setDoc } = await getFirestoreOps();
        await withTimeout(setDoc(doc(db, 'clients', id), sanitizeForFirestore(clientData), { merge: true }), 8000);
        markAsSynced(id);
      }
    } catch (err) {
      console.warn('Firestore client direct save note (cached locally):', err.message);
    }
  }

  return clientData;
}

export async function deleteClient(id) {
  if (!id) return true;
  markAsDeleted(id);

  const localList = getLocalClients().filter(c => c.id !== id);
  cachedClients = localList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.CLIENTS, localList);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, deleteDoc, setDoc } = await getFirestoreOps();
        await withTimeout(Promise.all([
          deleteDoc(doc(db, 'clients', id)),
          setDoc(doc(db, 'deleted_records', id), {
            id,
            type: 'client',
            deletedAt: new Date().toISOString()
          }, { merge: true })
        ]), 8000);
      }
    } catch (err) {
      console.warn('Firestore client direct delete note:', err.message);
    }
  }

  return true;
}

// ==================== PRODUCTS ====================

export async function fetchProducts() {
  const localList = getLocalProducts();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { collection, getDocs, doc, setDoc } = await getFirestoreOps();
        await syncDeletedRecordsFromCloud(db, getFirestoreOps);

        const snap = await withTimeout(getDocs(collection(db, 'products')), 10000);
        const cloudList = [];
        snap.forEach(d => cloudList.push({ id: d.id, ...d.data() }));

        const deletedIds = getDeletedIds();
        const activeCloudList = cloudList.filter(p => p && p.id && !deletedIds.has(p.id));
        markAsSynced(activeCloudList.map(p => p.id));
        const syncedIds = getSyncedIds();
        const cloudIds = new Set(activeCloudList.map(p => p.id));

        // Purge items from localList if they were deleted or were previously synced to cloud and are now absent
        const validLocalList = (localList || []).filter(p => {
          if (!p || !p.id) return false;
          if (deletedIds.has(p.id)) return false;
          if (syncedIds.has(p.id) && !cloudIds.has(p.id)) return false; // Was deleted from cloud!
          return true;
        });

        const prodMap = new Map();
        validLocalList.forEach(p => {
          const key = (p.id || p.name || '').trim().toLowerCase();
          if (key) prodMap.set(key, p);
        });
        activeCloudList.forEach(p => {
          const key = (p.id || p.name || '').trim().toLowerCase();
          if (key) {
            const local = prodMap.get(key);
            prodMap.set(key, { ...(local || {}), ...p });
          }
        });

        // AUTO-SYNC: Push only genuinely new unsynced local products to cloud
        const missingInCloud = validLocalList.filter(p => !cloudIds.has(p.id) && !syncedIds.has(p.id));
        if (missingInCloud.length > 0) {
          Promise.all(missingInCloud.map(p => 
            setDoc(doc(db, 'products', p.id), sanitizeForFirestore(p), { merge: true })
              .then(() => markAsSynced(p.id))
          )).catch(e => console.warn('Background product auto-upload error:', e));
        }

        const merged = Array.from(prodMap.values());
        merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        cachedProducts = merged;
        safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, merged);
        return merged;
      }
    } catch (err) {
      console.warn('Firestore products sync skipped:', err.message);
    }
  }

  const deletedIds = getDeletedIds();
  return (localList || []).filter(p => p && p.id && !deletedIds.has(p.id));
}

export async function saveProduct(product) {
  const id = product.id || 'prod-' + Date.now();
  unmarkDeleted(id);
  const prodData = { ...product, id };

  const localList = [...getLocalProducts().filter(p => p.id !== id)];
  localList.push(prodData);
  cachedProducts = localList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, localList);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, setDoc } = await getFirestoreOps();
        await withTimeout(setDoc(doc(db, 'products', id), sanitizeForFirestore(prodData), { merge: true }), 8000);
        markAsSynced(id);
      }
    } catch (err) {
      console.warn('Firestore product direct save note (cached locally):', err.message);
    }
  }

  return prodData;
}

export async function deleteProduct(id) {
  if (!id) return true;
  markAsDeleted(id);

  const localList = getLocalProducts().filter(p => p.id !== id);
  cachedProducts = localList;
  safeSetLocalStorage(LOCAL_STORAGE_KEYS.PRODUCTS, localList);

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, deleteDoc, setDoc } = await getFirestoreOps();
        await withTimeout(Promise.all([
          deleteDoc(doc(db, 'products', id)),
          setDoc(doc(db, 'deleted_records', id), {
            id,
            type: 'product',
            deletedAt: new Date().toISOString()
          }, { merge: true })
        ]), 8000);
      }
    } catch (err) {
      console.warn('Firestore product direct delete note:', err.message);
    }
  }

  return true;
}

// ==================== COMPANY SETTINGS ====================

export async function fetchCompanySettings() {
  const localSettings = getLocalCompanySettings();

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, getDoc, setDoc } = await getFirestoreOps();
        const docSnap = await withTimeout(getDoc(doc(db, 'settings', 'company')), 10000);
        if (docSnap.exists()) {
          const settings = docSnap.data();
          normalizeCompanySettings(settings);
          cachedCompanySettings = settings;
          safeSetLocalStorage(LOCAL_STORAGE_KEYS.SETTINGS, settings);
          return settings;
        } else if (localSettings && localSettings.name) {
          // If cloud has no settings yet, seed with local settings
          setDoc(doc(db, 'settings', 'company'), sanitizeForFirestore(localSettings), { merge: true })
            .catch(e => console.warn('Company settings auto-upload error:', e));
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

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const db = await getDbInstance();
      if (db) {
        const { doc, setDoc } = await getFirestoreOps();
        await withTimeout(setDoc(doc(db, 'settings', 'company'), sanitizeForFirestore(settings), { merge: true }), 8000);
      }
    } catch (err) {
      console.warn('Firestore settings direct save note (cached locally):', err.message);
    }
  }

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

  let opCount = 0;
  if (settings && settings.name) {
    batch.set(doc(db, 'settings', 'company'), sanitizeForFirestore(settings), { merge: true });
    opCount++;
  }

  clients.forEach(client => {
    if (client.id) {
      batch.set(doc(db, 'clients', client.id), sanitizeForFirestore(client), { merge: true });
      opCount++;
    }
  });

  products.forEach(product => {
    if (product.id) {
      batch.set(doc(db, 'products', product.id), sanitizeForFirestore(product), { merge: true });
      opCount++;
    }
  });

  quotes.forEach(quote => {
    if (quote.id) {
      batch.set(doc(db, 'quotations', quote.id), sanitizeForFirestore(quote), { merge: true });
      opCount++;
    }
  });

  if (opCount > 0) {
    await withTimeout(batch.commit(), 15000);
  }

  return {
    quotationsSynced: quotes.length,
    clientsSynced: clients.length,
    productsSynced: products.length
  };
}

// ==================== REAL-TIME FIRESTORE LISTENERS ====================

/**
 * Attaches real-time Firestore listener for quotations.
 * Any save/edit/delete made on any laptop fires callback on all other laptops in <200ms.
 */
export function subscribeToQuotations(callback) {
  if (typeof window === 'undefined') return () => {};
  let unsubscribe = null;
  let active = true;

  getDbInstance().then(async (db) => {
    if (!db || !active) return;
    try {
      const { collection, onSnapshot } = await getFirestoreOps();
      unsubscribe = onSnapshot(collection(db, 'quotations'), (snapshot) => {
        const deletedIds = getDeletedIds();
        const cloudList = [];
        snapshot.forEach(docSnap => {
          if (!deletedIds.has(docSnap.id)) {
            cloudList.push({ id: docSnap.id, ...docSnap.data() });
          }
        });

        markAsSynced(cloudList.map(c => c.id));
        const syncedIds = getSyncedIds();
        const cloudIds = new Set(cloudList.map(c => c.id));

        const localList = getLocalQuotations();
        const validLocal = (localList || []).filter(item => {
          if (!item || !item.id || deletedIds.has(item.id)) return false;
          if (syncedIds.has(item.id) && !cloudIds.has(item.id)) return false; // Deleted from cloud!
          return true;
        });

        const mergedMap = new Map();
        validLocal.forEach(item => {
          mergedMap.set(item.id, item);
        });
        cloudList.forEach(item => {
          const local = mergedMap.get(item.id);
          if (!local || new Date(item.updatedAt || 0) >= new Date(local.updatedAt || 0)) {
            mergedMap.set(item.id, item);
          }
        });

        const mergedList = Array.from(mergedMap.values());
        mergedList.sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
        cachedQuotations = mergedList;
        safeSetLocalStorage(LOCAL_STORAGE_KEYS.QUOTATIONS, mergedList);
        callback(mergedList);
      }, (err) => {
        console.warn('Real-time quotation sync listener note:', err.message);
      });
    } catch (e) {
      console.warn('Failed to attach quotation sync listener:', e);
    }
  }).catch(() => {});

  return () => {
    active = false;
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}

/**
 * Attaches real-time Firestore listener for client directory.
 */
export function subscribeToClients(callback) {
  if (typeof window === 'undefined') return () => {};
  let unsubscribe = null;
  let active = true;

  getDbInstance().then(async (db) => {
    if (!db || !active) return;
    try {
      const { collection, onSnapshot } = await getFirestoreOps();
      unsubscribe = onSnapshot(collection(db, 'clients'), (snapshot) => {
        const deletedIds = getDeletedIds();
        const cloudList = [];
        snapshot.forEach(d => {
          if (!deletedIds.has(d.id)) {
            cloudList.push({ id: d.id, ...d.data() });
          }
        });

        markAsSynced(cloudList.map(c => c.id));
        const syncedIds = getSyncedIds();
        const cloudIds = new Set(cloudList.map(c => c.id));

        const localList = getLocalClients();
        const validLocal = (localList || []).filter(c => {
          if (!c || !c.id || deletedIds.has(c.id)) return false;
          if (syncedIds.has(c.id) && !cloudIds.has(c.id)) return false; // Deleted from cloud!
          return true;
        });

        const clientMap = new Map();
        validLocal.forEach(c => {
          const key = (c.companyName || c.name || c.id || '').trim().toLowerCase();
          if (key) clientMap.set(key, c);
        });
        cloudList.forEach(c => {
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
        callback(merged);
      }, (err) => {
        console.warn('Real-time client sync listener note:', err.message);
      });
    } catch (e) {
      console.warn('Failed to attach client sync listener:', e);
    }
  }).catch(() => {});

  return () => {
    active = false;
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}

/**
 * Attaches real-time Firestore listener for product catalog.
 */
export function subscribeToProducts(callback) {
  if (typeof window === 'undefined') return () => {};
  let unsubscribe = null;
  let active = true;

  getDbInstance().then(async (db) => {
    if (!db || !active) return;
    try {
      const { collection, onSnapshot } = await getFirestoreOps();
      unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
        const deletedIds = getDeletedIds();
        const cloudList = [];
        snapshot.forEach(d => {
          if (!deletedIds.has(d.id)) {
            cloudList.push({ id: d.id, ...d.data() });
          }
        });

        markAsSynced(cloudList.map(p => p.id));
        const syncedIds = getSyncedIds();
        const cloudIds = new Set(cloudList.map(p => p.id));

        const localList = getLocalProducts();
        const validLocal = (localList || []).filter(p => {
          if (!p || !p.id || deletedIds.has(p.id)) return false;
          if (syncedIds.has(p.id) && !cloudIds.has(p.id)) return false; // Deleted from cloud!
          return true;
        });

        const prodMap = new Map();
        validLocal.forEach(p => {
          const key = (p.id || p.name || '').trim().toLowerCase();
          if (key) prodMap.set(key, p);
        });
        cloudList.forEach(p => {
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
        callback(merged);
      }, (err) => {
        console.warn('Real-time product sync listener note:', err.message);
      });
    } catch (e) {
      console.warn('Failed to attach product sync listener:', e);
    }
  }).catch(() => {});

  return () => {
    active = false;
    if (typeof unsubscribe === 'function') unsubscribe();
  };
}
