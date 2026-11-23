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
  saveCompanySettings 
} from './services/db';
import { CheckCircle2, AlertTriangle, Info, X, FileText } from 'lucide-react';

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

function ModuleLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[360px] w-full space-y-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-slate-500">Loading module...</span>
    </div>
  );
}

const VALID_TABS = ['dashboard', 'quotes', 'editor', 'preview', 'proforma', 'invoices', 'challans', 'clients', 'products', 'reports'];

function getInitialTab() {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash.replace('#', '').trim();
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
        saveClient(newClient).catch(() => {});
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
  const [shareQuotation, setShareQuotation] = useState(null);
  const [previewReturnTab, setPreviewReturnTab] = useState(null);
  const [proformaInitialMode, setProformaInitialMode] = useState('cards');
  const [invoicesInitialMode, setInvoicesInitialMode] = useState('cards');
  const [challanInitialMode, setChallanInitialMode] = useState('list');
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

  // Persist active tab to localStorage and URL hash
  useEffect(() => {
    try {
      localStorage.setItem('kits_active_tab', activeTab);
      if (typeof window !== 'undefined' && window.location.hash !== `#${activeTab}`) {
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

  // Toast notifications
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

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

  // Single-pass O(N) categorization separating Quotations, Proforma, Tax Invoices, and Delivery Challans
  const { quotationsOnly, proformaOnly, taxInvoicesOnly, challansOnly } = useMemo(() => {
    const quotes = [];
    const proformas = [];
    const taxInvoices = [];
    const challans = [];

    const safeQuotes = Array.isArray(quotations) ? quotations : [];
    const len = safeQuotes.length;
    for (let i = 0; i < len; i++) {
      const q = safeQuotes[i];
      if (!q) continue;
      const isDC = q.isDeliveryChallan || q.documentType === 'Delivery Challan';
      if (isDC) {
        challans.push(q);
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
    return { quotationsOnly: quotes, proformaOnly: proformas, taxInvoicesOnly: taxInvoices, challansOnly: challans };
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
                currentQuotation ? (
                  <QuotationPreview
                    quotation={currentQuotation}
                    companySettings={companySettings}
                    onBack={() => {
                      if (previewReturnTab) {
                        const target = previewReturnTab;
                        setPreviewReturnTab(null);
                        setActiveTab(target);
                      } else if (currentQuotation?.isDeliveryChallan || currentQuotation?.documentType === 'Delivery Challan') {
                        setActiveTab('challans');
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
                        setActiveTab('challans');
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
                )
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
