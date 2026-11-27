import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import ErrorBoundary from './components/ErrorBoundary';
import { 
  getLocalQuotations,
  getLocalClients,
  getLocalProducts,
  getLocalCompanySettings,
  fetchQuotations, 
  saveQuotation, 
  deleteQuotation,
  fetchClients, 
  saveClient, 
  deleteClient,
  fetchProducts,
  saveProduct,
  deleteProduct,
  fetchCompanySettings, 
  saveCompanySettings,
  importDatabaseBackup,
  subscribeToQuotations,
  subscribeToClients
} from './services/db';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  FileText,
  ExternalLink,
  Download,
  Laptop
} from 'lucide-react';
import { parseIncomingSharePayload, clearShareUrlHash } from './utils/shareLink';

// Lazy-loaded views for blazing-fast initial paint & zero bundle bloat
const Dashboard = lazy(() => import('./components/Dashboard'));
const QuotationsList = lazy(() => import('./components/QuotationsList'));
const QuotationEditor = lazy(() => import('./components/QuotationEditor'));
const QuotationPreview = lazy(() => import('./components/QuotationPreview'));
const ProformaManager = lazy(() => import('./components/ProformaManager'));
const DeliveryChallanManager = lazy(() => import('./components/DeliveryChallanManager'));
const ClientsManager = lazy(() => import('./components/ClientsManager'));
const ProductsManager = lazy(() => import('./components/ProductsManager'));
const ReportsAnalytics = lazy(() => import('./components/ReportsAnalytics'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const ShareModal = lazy(() => import('./components/ShareModal'));
const MultiDeviceSyncModal = lazy(() => import('./components/MultiDeviceSyncModal'));

function ModuleLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] w-full space-y-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-500">Loading module...</span>
    </div>
  );
}

const VALID_TABS = ['dashboard', 'quotes', 'editor', 'preview', 'proforma', 'invoices', 'challans', 'demo-challans', 'clients', 'products', 'reports'];

function getInitialTab() {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash.startsWith('share=') || window.location.search.includes('share=')) {
      return 'preview';
    }
    if (VALID_TABS.includes(hash)) return hash;
    try {
      const savedTab = localStorage.getItem('kits_active_tab');
      if (savedTab && VALID_TABS.includes(savedTab)) return savedTab;
    } catch {
      // ignore
    }
  }
  return 'dashboard';
}

function mergeClientsFromDocuments(existingClients = [], documents = []) {
  // First deduplicate existingClients strictly by companyName
  const dedupedExisting = [];
  const existingNames = new Set();
  const safeClients = Array.isArray(existingClients) ? existingClients : [];
  for (let i = 0; i < safeClients.length; i++) {
    const c = safeClients[i];
    if (!c) continue;
    const key = (c.companyName || '').trim().toLowerCase();
    if (!key) continue;
    if (!existingNames.has(key)) {
      existingNames.add(key);
      dedupedExisting.push(c);
    }
  }

  const merged = [...dedupedExisting];

  if (Array.isArray(documents) && documents.length > 0) {
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc) continue;
      const name = (doc.clientName || doc.customerName || doc.companyName || '').trim();
      if (!name) continue;
      const lowerName = name.toLowerCase();

      // Only add if not already present in existingNames
      if (!existingNames.has(lowerName)) {
        existingNames.add(lowerName);
        const newClient = {
          id: doc.clientId || ('client-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
          companyName: name,
          contactPerson: doc.contactPerson || '',
          email: doc.clientEmail || doc.email || '',
          phone: doc.clientPhone || doc.contactPhone || doc.phone || '',
          gstin: doc.clientGstin || doc.customerGstin || doc.gstin || '',
          state: doc.clientState || doc.state || 'Maharashtra',
          stateCode: doc.clientStateCode || '27',
          billingAddress: doc.billingAddress || '',
          shippingAddress: doc.shippingAddress || doc.billingAddress || '',
          status: 'Active',
          createdAt: doc.date || doc.createdAt || new Date().toISOString()
        };
        merged.push(newClient);
      }
    }
  }

  return merged;
}

export default function App() {
  // Navigation: persisted across page refreshes via URL hash + localStorage
  const [activeTab, setActiveTab] = useState(() => getInitialTab());
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  
  // Instant synchronous initialization from cached local storage - ZERO WAIT
  const [quotations, setQuotations] = useState(() => getLocalQuotations());
  const [clients, setClients] = useState(() => mergeClientsFromDocuments(getLocalClients(), getLocalQuotations()));
  const [products, setProducts] = useState(() => getLocalProducts());
  const [companySettings, setCompanySettings] = useState(() => getLocalCompanySettings());
  
  const [currentQuotation, setCurrentQuotation] = useState(() => {
    const list = getLocalQuotations();
    if (typeof window !== 'undefined') {
      try {
        const savedId = localStorage.getItem('kits_active_quotation_id');
        if (savedId && Array.isArray(list)) {
          const found = list.find(q => q.id === savedId);
          if (found) return found;
        }
      } catch {
        // ignore
      }
    }
    return list && list.length > 0 ? list[0] : null;
  });

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [sharedBanner, setSharedBanner] = useState(null);
  const [incomingSyncData, setIncomingSyncData] = useState(null);
  const [shareQuotation, setShareQuotation] = useState(null);
  const [previewReturnTab, setPreviewReturnTab] = useState(null);
  const [proformaInitialMode, setProformaInitialMode] = useState('cards');
  const [invoicesInitialMode, setInvoicesInitialMode] = useState('cards');
  const [challanInitialMode, setChallanInitialMode] = useState('list');
  const [demoChallanInitialMode, setDemoChallanInitialMode] = useState('list');
  const [proformaSourceQuote, setProformaSourceQuote] = useState(() => {
    const list = getLocalQuotations();
    if (typeof window !== 'undefined') {
      try {
        const savedId = localStorage.getItem('kits_active_proforma_source_id');
        if (savedId && Array.isArray(list)) {
          const found = list.find(q => q.id === savedId);
          if (found) return found;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Check incoming shared documents (#share=...) or database transfers (#sync=...)
  useEffect(() => {
    let mounted = true;
    const processIncoming = async () => {
      const res = await parseIncomingSharePayload();
      if (!res || !mounted) return;

      if (res.type === 'quote' && res.data) {
        const incomingDoc = res.data;
        setCurrentQuotation(incomingDoc);
        setActiveTab('preview');
        // Automatically save incoming shared document into local database so it is permanently visible in all views
        try {
          const saved = await saveQuotation(incomingDoc);
          setQuotations(prev => {
            const list = Array.isArray(prev) ? [...prev] : [];
            const idx = list.findIndex(q => q && (q.id === saved.id || (q.quotationNumber && q.quotationNumber === saved.quotationNumber)));
            if (idx >= 0) {
              list[idx] = saved;
            } else {
              list.unshift(saved);
            }
            return list;
          });
          // Also automatically sync customer details
          if (incomingDoc.clientName || incomingDoc.customerName) {
            const clientPayload = {
              companyName: incomingDoc.clientName || incomingDoc.customerName,
              phone: incomingDoc.clientPhone || '',
              email: incomingDoc.clientEmail || '',
              contactPerson: incomingDoc.contactPerson || '',
              address: incomingDoc.billingAddress || incomingDoc.shippingAddress || '',
              gstin: incomingDoc.clientGstin || incomingDoc.customerGstin || '',
              state: incomingDoc.clientState || 'Maharashtra',
              stateCode: incomingDoc.clientStateCode || '27'
            };
            saveClient(clientPayload).catch(e => console.warn('Background client sync error:', e));
          }
          setSharedBanner({ doc: saved, saved: true });
          showToast(`Document "${saved.quotationNumber || saved.challanNo}" auto-saved to your software!`);
        } catch (err) {
          console.warn('Auto-save error for shared doc:', err);
          setSharedBanner({ doc: incomingDoc, saved: false });
        }
      } else if (res.type === 'sync' && res.data) {
        setIncomingSyncData(res.data);
      }
    };

    processIncoming();
    window.addEventListener('hashchange', processIncoming);
    return () => {
      mounted = false;
      window.removeEventListener('hashchange', processIncoming);
    };
  }, [showToast]);

  // Persist active tab to localStorage and URL hash (without overriding active share payloads)
  useEffect(() => {
    try {
      localStorage.setItem('kits_active_tab', activeTab);
      if (typeof window !== 'undefined' && 
          !window.location.hash.includes('share=') && 
          !window.location.hash.includes('sync=') &&
          window.location.hash !== `#${activeTab}`) {
        window.history.replaceState(null, '', `#${activeTab}`);
      }
    } catch {
      // ignore
    }
  }, [activeTab]);

  // Handle browser back / forward buttons
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace('#', '').trim();
        if (VALID_TABS.includes(hash)) {
          setActiveTab(hash);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Persist active quotation ID
  useEffect(() => {
    try {
      if (currentQuotation?.id) {
        localStorage.setItem('kits_active_quotation_id', currentQuotation.id);
      }
    } catch {
      // ignore
    }
  }, [currentQuotation]);

  // Persist active proforma source quote ID
  useEffect(() => {
    try {
      if (proformaSourceQuote?.id) {
        localStorage.setItem('kits_active_proforma_source_id', proformaSourceQuote.id);
      } else {
        localStorage.removeItem('kits_active_proforma_source_id');
      }
    } catch {
      // ignore
    }
  }, [proformaSourceQuote]);

  // Background Reload / Cloud Sync Handler
  const loadData = useCallback(async () => {
    try {
      const [quotesList, clientsList, prodsList, settingsData] = await Promise.all([
        fetchQuotations(),
        fetchClients(),
        fetchProducts(),
        fetchCompanySettings()
      ]);
      if (quotesList && quotesList.length > 0) setQuotations(quotesList);
      const mergedClients = mergeClientsFromDocuments(clientsList || [], quotesList || []);
      if (mergedClients && mergedClients.length > 0) setClients(mergedClients);
      if (prodsList && prodsList.length > 0) setProducts(prodsList);
      if (settingsData) setCompanySettings(settingsData);
    } catch (err) {
      console.warn('Background sync note:', err.message);
    }
  }, []);

  // Non-blocking background sync on initial startup
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [quotesList, clientsList, prodsList, settingsData] = await Promise.all([
          fetchQuotations(),
          fetchClients(),
          fetchProducts(),
          fetchCompanySettings()
        ]);
        if (!active) return;
        if (quotesList && quotesList.length > 0) setQuotations(quotesList);
        const mergedClients = mergeClientsFromDocuments(clientsList || [], quotesList || []);
        if (mergedClients && mergedClients.length > 0) setClients(mergedClients);
        if (prodsList && prodsList.length > 0) setProducts(prodsList);
        if (settingsData) setCompanySettings(settingsData);
      } catch (err) {
        console.warn('Background sync note:', err.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Multi-laptop continuous synchronization: real-time Firestore listeners + focus re-sync
  useEffect(() => {
    const unsubQuotes = subscribeToQuotations((newQuotes) => {
      if (Array.isArray(newQuotes) && newQuotes.length > 0) {
        setQuotations(newQuotes);
      }
    });

    const unsubClients = subscribeToClients((newClients) => {
      if (Array.isArray(newClients) && newClients.length > 0) {
        setClients(newClients);
      }
    });

    const handleSyncTrigger = () => {
      loadData();
    };
    window.addEventListener('focus', handleSyncTrigger);
    window.addEventListener('online', handleSyncTrigger);
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData();
      }
    }, 20000);

    return () => {
      unsubQuotes();
      unsubClients();
      window.removeEventListener('focus', handleSyncTrigger);
      window.removeEventListener('online', handleSyncTrigger);
      clearInterval(timer);
    };
  }, [loadData]);

  // Single-pass O(N) categorization separating Quotations, Proforma, Tax Invoices, Delivery Challans, and Demo Challans
  const { quotationsOnly, proformaOnly, taxInvoicesOnly, challansOnly, demoChallansOnly } = useMemo(() => {
    const quotes = [];
    const proformas = [];
    const taxInvoices = [];
    const challans = [];
    const demoChallans = [];

    const safeQuotes = Array.isArray(quotations) ? quotations : [];
    const len = safeQuotes.length;
    for (let i = 0; i < len; i++) {
      const q = safeQuotes[i];
      if (!q) continue;
      const isDC = q.isDeliveryChallan || q.documentType === 'Delivery Challan';
      if (isDC) {
        const isDemo = Boolean(q.isDemoChallan || q.purpose === 'Demonstration / Exhibition' || (q.challanNo && (q.challanNo.includes('DEMO') || q.challanNo.includes('DCD'))));
        if (isDemo) {
          demoChallans.push(q);
        } else {
          challans.push(q);
        }
        continue;
      }
      const isTI = q.isTaxInvoice || q.documentType === 'Tax Invoice' || q.documentType === 'Invoice';
      const isPI = q.isProforma || q.documentType === 'Proforma Invoice';

      if (isTI) {
        taxInvoices.push(q);
      } else if (isPI) {
        proformas.push(q);
      } else {
        quotes.push(q);
      }
    }
    return { 
      quotationsOnly: quotes, 
      proformaOnly: proformas, 
      taxInvoicesOnly: taxInvoices, 
      challansOnly: challans, 
      demoChallansOnly: demoChallans 
    };
  }, [quotations]);

  // Deferred search query for smooth 60fps typing across heavy lists
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Memoized layout callbacks to prevent re-rendering TopHeader and Sidebar
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);
  const handleToggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const [_navHistory, setNavHistory] = useState(['dashboard']);

  const handleSelectTab = useCallback((tab) => {
    if (tab === 'proforma') {
      setProformaSourceQuote(null);
      setProformaInitialMode('cards');
    }
    if (tab === 'invoices') {
      setInvoicesInitialMode('cards');
    }
    if (tab === 'challans') {
      setChallanInitialMode('list');
    }
    if (tab === 'demo-challans') {
      setDemoChallanInitialMode('list');
    }
    setActiveTab(prev => {
      if (prev !== tab) {
        setNavHistory(h => [...h.filter(t => t !== tab), prev]);
      }
      return tab;
    });
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const handleGoBack = useCallback(() => {
    if (activeTab === 'preview' && previewReturnTab) {
      const target = previewReturnTab;
      setPreviewReturnTab(null);
      setActiveTab(target);
      return;
    }
    if (activeTab === 'editor') {
      setActiveTab('quotes');
      return;
    }
    setNavHistory(prev => {
      if (prev.length > 0) {
        const next = [...prev];
        const target = next.pop() || 'dashboard';
        setActiveTab(target);
        return next;
      }
      setActiveTab('dashboard');
      return [];
    });
  }, [activeTab, previewReturnTab]);

  // Handlers for Quotations & Documents
  const handleNewQuotation = useCallback(() => {
    setCurrentQuotation(null);
    setActiveTab('editor');
  }, []);

  const handleCreateProforma = useCallback(() => {
    setProformaSourceQuote(null);
    setProformaInitialMode('create');
    setActiveTab('proforma');
  }, []);

  const handleCreateFinalInvoice = useCallback(() => {
    setInvoicesInitialMode('tax-invoice');
    setActiveTab('invoices');
  }, []);

  const handleCreateChallan = useCallback(() => {
    setChallanInitialMode('create');
    setActiveTab('challans');
  }, []);

  const handleCreateDemoChallan = useCallback(() => {
    setDemoChallanInitialMode('create');
    setActiveTab('demo-challans');
  }, []);

  const handleEditQuotation = useCallback((quote) => {
    setCurrentQuotation(quote);
    setActiveTab('editor');
  }, []);

  const handleViewQuotation = useCallback((quote, returnTab) => {
    setCurrentQuotation(quote);
    if (returnTab) {
      setPreviewReturnTab(returnTab);
    } else {
      setPreviewReturnTab(prev => activeTab !== 'preview' ? activeTab : prev);
    }
    setActiveTab('preview');
  }, [activeTab]);

  const handleDeleteQuotation = useCallback(async (id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteQuotation(id);
      setQuotations(prev => prev.filter(q => q.id !== id));
      setCurrentQuotation(curr => {
        if (curr?.id === id) {
          setActiveTab('quotes');
          return null;
        }
        return curr;
      });
      showToast('Document deleted.');
    }
  }, [showToast]);

  const handleConvertToProforma = useCallback((quote) => {
    setProformaSourceQuote(quote);
    setActiveTab('proforma');
    showToast(`Quotation ${quote.quotationNumber} linked to Proforma Invoice.`);
  }, [showToast]);

  const handleSaveQuotation = useCallback(async (quoteData) => {
    const saved = await saveQuotation(quoteData);
    setQuotations(prev => {
      const idx = prev.findIndex(q => q.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
    setCurrentQuotation(saved);

    // Automatically sync customer data from the created quotation / proforma / invoice / challan
    const clientName = (saved.clientName || saved.customerName || saved.companyName || '').trim();
    if (clientName) {
      setClients(prevClients => {
        const lowerName = clientName.toLowerCase();
        const existingIdx = prevClients.findIndex(c => 
          c.companyName?.trim().toLowerCase() === lowerName ||
          (saved.clientId && c.id === saved.clientId) ||
          (saved.clientGstin && c.gstin && c.gstin.trim().toUpperCase() === saved.clientGstin.trim().toUpperCase())
        );

        const clientId = existingIdx >= 0 
          ? prevClients[existingIdx].id 
          : (saved.clientId || ('client-' + Date.now()));

        const clientPayload = {
          id: clientId,
          companyName: clientName,
          contactPerson: saved.contactPerson || (existingIdx >= 0 ? prevClients[existingIdx].contactPerson : '') || '',
          email: saved.clientEmail || saved.email || (existingIdx >= 0 ? prevClients[existingIdx].email : '') || '',
          phone: saved.clientPhone || saved.contactPhone || saved.phone || (existingIdx >= 0 ? prevClients[existingIdx].phone : '') || '',
          gstin: saved.clientGstin || saved.customerGstin || saved.gstin || (existingIdx >= 0 ? prevClients[existingIdx].gstin : '') || '',
          state: saved.clientState || saved.state || (existingIdx >= 0 ? prevClients[existingIdx].state : '') || 'Maharashtra',
          stateCode: saved.clientStateCode || (existingIdx >= 0 ? prevClients[existingIdx].stateCode : '') || '27',
          billingAddress: saved.billingAddress || (existingIdx >= 0 ? prevClients[existingIdx].billingAddress : '') || '',
          shippingAddress: saved.shippingAddress || saved.billingAddress || (existingIdx >= 0 ? prevClients[existingIdx].shippingAddress : '') || '',
          status: existingIdx >= 0 ? (prevClients[existingIdx].status || 'Active') : 'Active',
          updatedAt: new Date().toISOString()
        };

        saveClient(clientPayload).catch(e => console.warn('Background client sync error:', e));

        const baseList = existingIdx >= 0 
          ? prevClients.map((c, i) => i === existingIdx ? { ...c, ...clientPayload } : c)
          : [clientPayload, ...prevClients];

        const deduped = [];
        const seen = new Set();
        for (let i = 0; i < baseList.length; i++) {
          const c = baseList[i];
          const key = (c.companyName || '').trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          deduped.push(c);
        }
        return deduped;
      });
    }

    showToast('Document saved successfully!');
  }, [showToast]);

  // Handle saving an incoming shared quotation directly into this laptop's permanent local database
  const handleSaveSharedDocToLocal = useCallback(async () => {
    if (!sharedBanner?.doc) return;
    const doc = sharedBanner.doc;
    await handleSaveQuotation(doc);
    setSharedBanner(prev => prev ? { ...prev, saved: true } : null);
    clearShareUrlHash();
    showToast(`Quotation ${doc.quotationNumber} saved to this laptop's database!`);
  }, [sharedBanner, handleSaveQuotation, showToast]);

  // Handle incoming full-database sync package from another laptop
  const handleConfirmIncomingSync = useCallback(async () => {
    if (!incomingSyncData) return;
    try {
      await importDatabaseBackup(incomingSyncData);
      await loadData();
      const count = incomingSyncData.quotations?.length || 0;
      setIncomingSyncData(null);
      clearShareUrlHash();
      showToast(`Successfully imported ${count} documents and clients from other laptop!`);
    } catch (err) {
      showToast('Import error: ' + err.message, 'error');
    }
  }, [incomingSyncData, loadData, showToast]);

  // Handlers for Clients
  const handleSaveClient = useCallback(async (clientData) => {
    const saved = await saveClient(clientData);
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast(`Client "${saved.companyName}" saved.`);
  }, [showToast]);

  const handleDeleteClient = useCallback(async (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      await deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
      showToast('Client removed from directory.');
    }
  }, [showToast]);

  // Handlers for Products / Catalog
  const handleSaveProduct = useCallback(async (productData) => {
    const saved = await saveProduct(productData);
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast(`Item "${saved.name}" saved to catalog.`);
  }, [showToast]);

  const handleDeleteProduct = useCallback(async (id) => {
    if (window.confirm('Are you sure you want to delete this catalog item?')) {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast('Catalog item removed.');
    }
  }, [showToast]);

  // Company Settings
  const handleSaveCompanySettings = useCallback(async (newSettings) => {
    const saved = await saveCompanySettings(newSettings);
    setCompanySettings(saved);
    showToast('Company profile and letterhead updated.');
  }, [showToast]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f4f7fc] text-slate-800 flex font-sans antialiased">
      
      {/* Responsive Dark Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleSelectTab}
        onOpenSettings={handleOpenSettings}
        companySettings={companySettings}
        quotationsCount={quotationsOnly.length}
        proformaCount={proformaOnly.length}
        invoicesCount={taxInvoicesOnly.length}
        challansCount={challansOnly.length}
        demoChallansCount={demoChallansOnly.length}
        customersCount={clients.length}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
      />

      {/* Main Content Area - Locked Height with Smoothly Scrollable Body */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Top Header */}
        <TopHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenSettings={handleOpenSettings}
          onOpenSync={() => setShowSyncModal(true)}
          companySettings={companySettings}
          onQuickAction={handleNewQuotation}
          onToggleSidebar={handleToggleSidebar}
          onBack={activeTab !== 'dashboard' ? handleGoBack : null}
        />

        {/* Viewport Router - Screen-fit Scroll Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 lg:p-7 w-full">
          <div className="max-w-[1600px] mx-auto w-full space-y-6">
            <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
              <Suspense fallback={<ModuleLoader />}>
              {/* SCREEN 1: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <Dashboard
                  quotations={quotationsOnly}
                  searchQuery={deferredSearchQuery}
                  onNewQuotation={handleNewQuotation}
                  onCreateProforma={handleCreateProforma}
                  onCreateFinalInvoice={handleCreateFinalInvoice}
                  onCreateChallan={handleCreateChallan}
                  onCreateDemoChallan={handleCreateDemoChallan}
                  onViewQuotation={handleViewQuotation}
                  onEditQuotation={handleEditQuotation}
                  onDeleteQuotation={handleDeleteQuotation}
                  onShareQuotation={(q) => setShareQuotation(q)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onConvertToProforma={handleConvertToProforma}
                />
              )}

              {/* QUOTATIONS LIST */}
              {activeTab === 'quotes' && (
                <QuotationsList
                  quotations={quotationsOnly}
                  searchQuery={deferredSearchQuery}
                  onNewQuotation={handleNewQuotation}
                  onViewQuotation={handleViewQuotation}
                  onEditQuotation={handleEditQuotation}
                  onDeleteQuotation={handleDeleteQuotation}
                  onShareQuotation={(q) => setShareQuotation(q)}
                  onConvertToProforma={handleConvertToProforma}
                  onNavigateTab={handleSelectTab}
                />
              )}

              {/* SCREEN 2: CREATE QUOTATION */}
              {activeTab === 'editor' && (
                <QuotationEditor
                  quotation={currentQuotation}
                  existingQuotations={quotations}
                  clients={clients}
                  products={products}
                  companySettings={companySettings}
                  onSave={handleSaveQuotation}
                  onSaveClientQuick={handleSaveClient}
                  onCancel={() => setActiveTab('quotes')}
                  onView={(saved) => {
                    setCurrentQuotation(saved);
                    setActiveTab('preview');
                  }}
                />
              )}

              {/* SCREEN 3: QUOTATION PREVIEW (Official KITS 2-Page Format) */}
              {activeTab === 'preview' && (
                <>
                  {sharedBanner && (
                    <div className="no-print bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl border border-blue-700/60 flex flex-col sm:flex-row items-center justify-between gap-3 mb-5 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-400/30 text-blue-300 shrink-0">
                          <ExternalLink className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white flex items-center space-x-2 flex-wrap">
                            <span>Viewing Shared Document: {sharedBanner.doc?.quotationNumber}</span>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                              Direct Device Link
                            </span>
                          </div>
                          <p className="text-xs text-blue-200 mt-0.5">
                            Sent by {sharedBanner.doc?.companyName || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'} • Client: {sharedBanner.doc?.clientName || 'Valued Customer'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {!sharedBanner.saved ? (
                          <button
                            type="button"
                            onClick={handleSaveSharedDocToLocal}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                          >
                            <Download className="w-4 h-4" />
                            <span>Save to this Laptop</span>
                          </button>
                        ) : (
                          <span className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Saved to this Laptop!</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSharedBanner(null)}
                          className="p-2 text-blue-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                          title="Dismiss banner"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {currentQuotation ? (
                    <QuotationPreview
                    quotation={currentQuotation}
                    companySettings={companySettings}
                    onBack={() => {
                      if (previewReturnTab) {
                        const target = previewReturnTab;
                        setPreviewReturnTab(null);
                        setActiveTab(target);
                      } else if (currentQuotation?.isDeliveryChallan || currentQuotation?.documentType === 'Delivery Challan') {
                        const isDemo = currentQuotation?.isDemoChallan || currentQuotation?.purpose === 'Demonstration / Exhibition' || (currentQuotation?.challanNo && (currentQuotation.challanNo.includes('DEMO') || currentQuotation.challanNo.includes('DCD')));
                        setActiveTab(isDemo ? 'demo-challans' : 'challans');
                      } else if (currentQuotation?.isTaxInvoice || currentQuotation?.documentType === 'Tax Invoice') {
                        setActiveTab('invoices');
                      } else if (currentQuotation?.isProforma || currentQuotation?.documentType === 'Proforma Invoice') {
                        setActiveTab('proforma');
                      } else {
                        setActiveTab('quotes');
                      }
                    }}
                    onEdit={() => {
                      if (currentQuotation?.isDeliveryChallan || currentQuotation?.documentType === 'Delivery Challan') {
                        const isDemo = currentQuotation?.isDemoChallan || currentQuotation?.purpose === 'Demonstration / Exhibition' || (currentQuotation?.challanNo && (currentQuotation.challanNo.includes('DEMO') || currentQuotation.challanNo.includes('DCD')));
                        setActiveTab(isDemo ? 'demo-challans' : 'challans');
                      } else if (currentQuotation?.isTaxInvoice || currentQuotation?.documentType === 'Tax Invoice') {
                        setActiveTab('invoices');
                      } else if (currentQuotation?.isProforma || currentQuotation?.documentType === 'Proforma Invoice') {
                        setProformaSourceQuote(currentQuotation);
                        setActiveTab('proforma');
                      } else {
                        setActiveTab('editor');
                      }
                    }}
                    onShare={() => setShareQuotation(currentQuotation)}
                    onConvertToProforma={handleConvertToProforma}
                  />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-4 max-w-lg mx-auto shadow-xs">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">No quotation selected for preview</h3>
                    <p className="text-xs text-slate-500">
                      Select an existing quotation from your list or create a new quotation to generate the official KITS 2-page PDF.
                    </p>
                    <div className="flex justify-center space-x-3 pt-2">
                      <button
                        onClick={() => setActiveTab('quotes')}
                        className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        View All Quotations
                      </button>
                      <button
                        onClick={handleNewQuotation}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        + Create Quotation
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}

              {/* SCREEN 4: PROFORMA INVOICES */}
              {activeTab === 'proforma' && (
                <ProformaManager
                  key={proformaSourceQuote?.id ? `pi-source-${proformaSourceQuote.id}` : `proforma-view-${proformaInitialMode}`}
                  initialMode={proformaSourceQuote ? 'create' : proformaInitialMode}
                  defaultFilter="proforma"
                  clients={clients}
                  quotations={quotations}
                  companySettings={companySettings}
                  initialQuotation={proformaSourceQuote}
                  onClearInitialQuotation={() => {
                    setProformaSourceQuote(null);
                    setProformaInitialMode('cards');
                  }}
                  onSaveQuotation={(saved, andView) => {
                    handleSaveQuotation(saved);
                    setProformaInitialMode('cards');
                    if (andView) {
                      handleViewQuotation(saved);
                    } else {
                      setActiveTab('proforma');
                    }
                  }}
                  onViewQuotation={handleViewQuotation}
                  onShareQuotation={(q) => setShareQuotation(q)}
                  onDeleteQuotation={handleDeleteQuotation}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {/* SCREEN 4B: INVOICES (Cards of the Invoices) */}
              {activeTab === 'invoices' && (
                <ProformaManager
                  key={`invoices-view-${invoicesInitialMode}`}
                  initialMode={invoicesInitialMode}
                  defaultFilter="tax"
                  clients={clients}
                  quotations={quotations}
                  companySettings={companySettings}
                  initialQuotation={null}
                  onClearInitialQuotation={() => {
                    setProformaSourceQuote(null);
                    setInvoicesInitialMode('cards');
                  }}
                  onSaveQuotation={(saved, andView) => {
                    handleSaveQuotation(saved);
                    setInvoicesInitialMode('cards');
                    if (andView) {
                      handleViewQuotation(saved);
                    }
                  }}
                  onViewQuotation={handleViewQuotation}
                  onShareQuotation={(q) => setShareQuotation(q)}
                  onDeleteQuotation={handleDeleteQuotation}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {/* SCREEN 4C: DELIVERY CHALLANS (Rule 55 CGST) */}
              {activeTab === 'challans' && (
                <DeliveryChallanManager
                  key={`challans-view-${challanInitialMode}`}
                  initialMode={challanInitialMode}
                  clients={clients}
                  quotations={quotations}
                  companySettings={companySettings}
                  onSaveChallan={(saved) => {
                    handleSaveQuotation(saved);
                    setChallanInitialMode('list');
                    showToast('Delivery Challan saved successfully.');
                  }}
                  onDeleteChallan={(id) => {
                    handleDeleteQuotation(id);
                    showToast('Delivery Challan removed.');
                  }}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onViewQuotation={handleViewQuotation}
                />
              )}

              {/* SCREEN 4D: DEMO DELIVERY CHALLAN (Rule 55 CGST) */}
              {activeTab === 'demo-challans' && (
                <DeliveryChallanManager
                  key={`demo-challans-view-${demoChallanInitialMode}`}
                  initialMode={demoChallanInitialMode}
                  isDemoModule={true}
                  clients={clients}
                  quotations={quotations}
                  companySettings={companySettings}
                  onSaveChallan={(saved) => {
                    handleSaveQuotation(saved);
                    setDemoChallanInitialMode('list');
                    showToast('Demo Delivery Challan saved successfully.');
                  }}
                  onDeleteChallan={(id) => {
                    handleDeleteQuotation(id);
                    showToast('Demo Delivery Challan removed.');
                  }}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onViewQuotation={handleViewQuotation}
                />
              )}

              {/* SCREEN 5: CUSTOMERS MANAGEMENT */}
              {activeTab === 'clients' && (
                <ClientsManager
                  clients={clients}
                  quotations={quotations}
                  searchQuery={deferredSearchQuery}
                  onSaveClient={handleSaveClient}
                  onDeleteClient={handleDeleteClient}
                  onViewQuotation={handleViewQuotation}
                  onNavigateTab={handleSelectTab}
                />
              )}

              {/* SCREEN 5B: ITEM & SERVICE CATALOG */}
              {activeTab === 'products' && (
                <ProductsManager
                  products={products}
                  searchQuery={deferredSearchQuery}
                  onSaveProduct={handleSaveProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onNavigateTab={handleSelectTab}
                />
              )}

              {/* SCREEN 6: REPORTS & ANALYTICS */}
              {activeTab === 'reports' && (
                <ReportsAnalytics
                  quotations={quotations}
                  clients={clients}
                  onNavigateTab={handleSelectTab}
                />
              )}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Settings Modal (Company Profile, GSTN, Logo, Bank, Firebase, Backups) */}
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={showSettings}
          onClose={handleCloseSettings}
          companySettings={companySettings}
          onSaveCompanySettings={handleSaveCompanySettings}
          onReloadData={loadData}
        />
      </Suspense>

      {/* Share Modal (WhatsApp, Email) */}
      <Suspense fallback={null}>
        <ShareModal
          isOpen={Boolean(shareQuotation)}
          onClose={() => setShareQuotation(null)}
          quotation={shareQuotation}
          companySettings={companySettings}
        />
      </Suspense>

      {/* Multi-Device Sync Modal (Transfer data between laptops) */}
      <Suspense fallback={null}>
        <MultiDeviceSyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onReloadData={loadData}
          showToast={showToast}
        />
      </Suspense>

      {/* Incoming Full-Data Transfer Confirmation Dialog */}
      {incomingSyncData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">Import Data from Another Laptop?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You opened a transfer link sent from another laptop. It contains:
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-left space-y-1 font-medium text-slate-700">
                <div className="flex justify-between"><span>Quotations & Documents:</span> <span className="font-bold text-blue-600">{incomingSyncData.quotations?.length || 0}</span></div>
                <div className="flex justify-between"><span>Clients Directory:</span> <span className="font-bold text-blue-600">{incomingSyncData.clients?.length || 0}</span></div>
                <div className="flex justify-between"><span>Catalog Products:</span> <span className="font-bold text-blue-600">{incomingSyncData.products?.length || 0}</span></div>
              </div>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIncomingSyncData(null);
                  clearShareUrlHash();
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmIncomingSync}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
              >
                Import All Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sleek Bottom-Right Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2.5 px-4 py-3 rounded-2xl shadow-xl border bg-slate-900 text-white text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toast.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
