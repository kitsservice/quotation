import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Mail, 
  Phone, 
  Building2, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  X,
  FileText,
  FileCheck2,
  Receipt,
  Truck,
  Eye,
  ArrowLeft
} from 'lucide-react';
import { getStateFromGstin } from '../utils/gstHelper';
import { formatCurrency, formatDate } from '../utils/formatters';

function classifyDocument(doc) {
  if (!doc) {
    return { 
      type: 'quotation', 
      label: 'Quotation', 
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: FileText,
      iconColor: 'text-blue-600'
    };
  }
  if (doc.isDeliveryChallan || doc.documentType === 'Delivery Challan' || doc.challanNo) {
    return { 
      type: 'challan', 
      label: 'Delivery Challan', 
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Truck,
      iconColor: 'text-amber-600'
    };
  }
  if (doc.isTaxInvoice || doc.documentType === 'Tax Invoice' || doc.documentType === 'Invoice' || (typeof doc.invoiceNo === 'string' && (doc.invoiceNo.includes('/INV/') || doc.invoiceNo.startsWith('INV-')))) {
    return { 
      type: 'invoice', 
      label: 'Final Invoice', 
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Receipt,
      iconColor: 'text-emerald-600'
    };
  }
  if (doc.isProforma || doc.documentType === 'Proforma Invoice' || (typeof doc.quotationNumber === 'string' && doc.quotationNumber.startsWith('PI-')) || (typeof doc.invoiceNo === 'string' && doc.invoiceNo.startsWith('PI-'))) {
    return { 
      type: 'proforma', 
      label: 'Proforma Invoice', 
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: FileCheck2,
      iconColor: 'text-purple-600'
    };
  }
  return { 
    type: 'quotation', 
    label: 'Quotation', 
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: FileText,
    iconColor: 'text-blue-600'
  };
}

function ClientsManager({
  clients = [],
  quotations = [],
  searchQuery = '',
  onSaveClient,
  onDeleteClient,
  onViewQuotation,
  onNavigateTab
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('All Customers');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [openDocDropdownId, setOpenDocDropdownId] = useState(null);
  const pageSize = 6;

  // Auto-close documents dropdown on outside click or Escape
  useEffect(() => {
    if (!openDocDropdownId) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('[data-doc-dropdown]')) {
        setOpenDocDropdownId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpenDocDropdownId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDocDropdownId]);

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const initialFormState = {
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstin: '',
    status: 'Active',
    state: 'Maharashtra',
    stateCode: '27',
    billingAddress: '',
    shippingAddress: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // Auto detect state from GSTIN
  const handleGstinChange = (e) => {
    const raw = e.target.value.toUpperCase();
    const detected = getStateFromGstin(raw);
    setFormData(prev => ({
      ...prev,
      gstin: raw,
      ...(detected ? { state: detected.state, stateCode: detected.code } : {})
    }));
  };

  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setEditingClient(null);
    setShowModal(true);
  };

  const handleOpenEdit = (client) => {
    setFormData({
      companyName: client.companyName || '',
      contactPerson: client.contactPerson || '',
      email: client.email || '',
      phone: client.phone || '',
      gstin: client.gstin || '',
      status: client.status || 'Active',
      state: client.state || 'Maharashtra',
      stateCode: client.stateCode || '27',
      billingAddress: client.billingAddress || '',
      shippingAddress: client.shippingAddress || client.billingAddress || ''
    });
    setEditingClient(client);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      alert('Please enter company name');
      return;
    }

    const saved = {
      ...formData,
      id: editingClient?.id || 'client-' + Date.now(),
      status: formData.status || 'Active',
      updatedAt: new Date().toISOString()
    };

    onSaveClient(saved);
    setShowModal(false);
  };

  // Deduplicate clients strictly by companyName so NEVER can two cards with the same name appear
  const uniqueClients = useMemo(() => {
    const deduped = [];
    const seen = new Set();
    for (let i = 0; i < clients.length; i++) {
      const c = clients[i];
      const key = (c.companyName || '').trim().toLowerCase();
      if (!key) continue;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(c);
      }
    }
    return deduped;
  }, [clients]);

  // Compute document associations for every customer in high-speed O(M + N) using indexed lookup maps
  const clientDocumentStats = useMemo(() => {
    const map = new Map();
    const byNameMap = new Map();
    const byGstinMap = new Map();

    for (let i = 0; i < uniqueClients.length; i++) {
      const c = uniqueClients[i];
      if (!c || !c.id) continue;
      const statsObj = {
        all: [],
        quotes: [],
        proformas: [],
        invoices: [],
        challans: [],
        totalBilled: 0,
        totalQuoted: 0,
        totalItemsDispatched: 0
      };
      map.set(c.id, statsObj);
      const nameKey = (c.companyName || '').trim().toLowerCase();
      if (nameKey) byNameMap.set(nameKey, statsObj);
      const gstinKey = (c.gstin || '').trim().toUpperCase();
      if (gstinKey && gstinKey.length >= 15) byGstinMap.set(gstinKey, statsObj);
    }

    const safeDocs = Array.isArray(quotations) ? quotations : [];
    for (let j = 0; j < safeDocs.length; j++) {
      const doc = safeDocs[j];
      if (!doc) continue;
      let matchedClient = null;
      if (doc.clientId && map.has(doc.clientId)) {
        matchedClient = map.get(doc.clientId);
      } else if (doc.customerId && map.has(doc.customerId)) {
        matchedClient = map.get(doc.customerId);
      } else {
        const docName = (doc.clientName || doc.customerName || doc.companyName || '').trim().toLowerCase();
        if (docName && byNameMap.has(docName)) {
          matchedClient = byNameMap.get(docName);
        } else {
          const docGstin = (doc.clientGstin || doc.customerGstin || doc.gstin || '').trim().toUpperCase();
          if (docGstin && docGstin.length >= 15 && byGstinMap.has(docGstin)) {
            matchedClient = byGstinMap.get(docGstin);
          }
        }
      }

      if (!matchedClient) continue;

      matchedClient.all.push(doc);
      const meta = classifyDocument(doc);
      const amt = Number(doc.grandTotal || doc.total || doc.totalAssessableValue || 0);

      if (meta.type === 'challan') {
        matchedClient.challans.push(doc);
        const qty = Array.isArray(doc.items)
          ? doc.items.reduce((s, it) => s + (Number(it.qty) || 0), 0)
          : (Number(doc.totalQuantity) || 0);
        matchedClient.totalItemsDispatched += qty;
      } else if (meta.type === 'invoice') {
        matchedClient.invoices.push(doc);
        matchedClient.totalBilled += amt;
      } else if (meta.type === 'proforma') {
        matchedClient.proformas.push(doc);
      } else {
        matchedClient.quotes.push(doc);
        matchedClient.totalQuoted += amt;
      }
    }

    // Sort newest documents first
    map.forEach((val) => {
      const sortByDate = (a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      val.all.sort(sortByDate);
      val.quotes.sort(sortByDate);
      val.proformas.sort(sortByDate);
      val.invoices.sort(sortByDate);
      val.challans.sort(sortByDate);
    });

    return map;
  }, [uniqueClients, quotations]);

  // Global summary statistics
  const globalStats = useMemo(() => {
    let totalBilled = 0;
    let totalQuoted = 0;
    let customersWithInvoices = 0;
    let customersWithChallans = 0;

    clientDocumentStats.forEach(stat => {
      totalBilled += stat.totalBilled;
      totalQuoted += stat.totalQuoted;
      if (stat.invoices.length > 0) customersWithInvoices++;
      if (stat.challans.length > 0) customersWithChallans++;
    });

    return {
      totalCustomers: uniqueClients.length,
      customersWithInvoices,
      customersWithChallans,
      totalBilled,
      totalQuoted
    };
  }, [uniqueClients, clientDocumentStats]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    const q = (searchTerm || searchQuery || '').trim().toLowerCase();

    return uniqueClients.filter(c => {
      const stats = clientDocumentStats.get(c.id) || { all: [], quotes: [], proformas: [], invoices: [], challans: [] };

      const matchesSearch = !q ||
        (c.companyName || '').toLowerCase().includes(q) ||
        (c.contactPerson || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.gstin || '').toLowerCase().includes(q) ||
        (c.state || '').toLowerCase().includes(q) ||
        (c.billingAddress || '').toLowerCase().includes(q) ||
        stats.all.some(doc => 
          (doc.quotationNumber || '').toLowerCase().includes(q) ||
          (doc.invoiceNo || '').toLowerCase().includes(q) ||
          (doc.challanNo || '').toLowerCase().includes(q)
        );

      const matchesStatus = statusFilter === 'All Status' || (c.status || 'Active') === statusFilter;

      let matchesActivity = true;
      if (activityFilter === 'With Invoices') {
        matchesActivity = stats.invoices.length > 0;
      } else if (activityFilter === 'With Proformas') {
        matchesActivity = stats.proformas.length > 0;
      } else if (activityFilter === 'With Quotations') {
        matchesActivity = stats.quotes.length > 0;
      } else if (activityFilter === 'With Challans') {
        matchesActivity = stats.challans.length > 0;
      } else if (activityFilter === 'No Documents Yet') {
        matchesActivity = stats.all.length === 0;
      }

      return matchesSearch && matchesStatus && matchesActivity;
    });
  }, [uniqueClients, searchTerm, searchQuery, statusFilter, activityFilter, clientDocumentStats]);

  // Paginated clients
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('dashboard')}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Customers Management</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Directory of clients auto-synced with Commercial Quotations, Proforma, Final Invoices, and Delivery Challans.
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Top Global Statistics Strip - Slim & Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Customers</span>
            <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{globalStats.totalCustomers}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed Revenue</span>
            <span className="text-lg font-black text-emerald-700 font-mono mt-0.5 block">{formatCurrency(globalStats.totalBilled, false)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quotation Pipeline</span>
            <span className="text-lg font-black text-blue-700 font-mono mt-0.5 block">{formatCurrency(globalStats.totalQuoted, false)}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Consignments</span>
            <span className="text-lg font-black text-amber-700 font-mono mt-0.5 block">{globalStats.customersWithChallans} Clients</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Truck className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar with View Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
        
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search company, contact, GSTIN, city, or doc #..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden transition-all"
          />
        </div>

        {/* Dropdowns & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
          >
            <option value="All Customers">All Customer Activity</option>
            <option value="With Invoices">With Final Invoices</option>
            <option value="With Proformas">With Proformas</option>
            <option value="With Quotations">With Quotations</option>
            <option value="With Challans">With Delivery Challans</option>
            <option value="No Documents Yet">No Documents Yet</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

      </div>

      {/* PRIMARY SECTION: CUSTOMER CARDS (SHOWN FIRST) OR TABLE */}
      {paginatedClients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 px-4 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">No Customers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Customers are auto-populated whenever you create Quotations, Proformas, Invoices, or Delivery Challans.
          </p>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Add First Customer
          </button>
        </div>
      ) : (
        /* PROPER RECTANGULAR CUSTOMER CARDS (ONLY VIEW) */
        <div className="space-y-4">
          <div className="space-y-3">
            {paginatedClients.map((client) => {
              const stats = clientDocumentStats.get(client.id) || {
                all: [],
                quotes: [],
                proformas: [],
                invoices: [],
                challans: [],
                totalBilled: 0,
                totalQuoted: 0
              };

              return (
                <div 
                  key={client.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 p-3 sm:p-3.5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                    
                    {/* Left Column (34%): Company Avatar, Status, GSTIN, Company Name, Contact Person, Location */}
                    <div className="flex items-center space-x-3 min-w-0 lg:w-[34%]">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold font-mono text-xs sm:text-sm shrink-0 shadow-2xs bg-blue-50 text-blue-700 border border-blue-200/70">
                        {(client.companyName || 'C').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                            (client.status || 'Active') === 'Active' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {client.status || 'Active'}
                          </span>
                          {client.gstin ? (
                            <span className="font-mono text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              GSTIN: {client.gstin}
                            </span>
                          ) : (
                            <span className="text-[9.5px] text-slate-400 font-mono bg-slate-50 px-1.5 py-0.2 rounded border border-slate-100 shrink-0">
                              Unregistered
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            {client.state || 'Maharashtra'}
                          </span>
                        </div>
                        <h4 
                          onClick={() => handleOpenEdit(client)}
                          className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5 hover:text-blue-600 transition-colors cursor-pointer"
                          title={client.companyName}
                        >
                          {client.companyName}
                        </h4>
                        <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                          {client.contactPerson && (
                            <span className="truncate max-w-[140px]"><strong>Attn:</strong> {client.contactPerson}</span>
                          )}
                          {client.contactPerson && <span>•</span>}
                          <span className="truncate max-w-[160px]">{client.billingAddress || client.city || 'Akola, Maharashtra'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Center Column (26%): Contact Info (Phone, Email, Plant) */}
                    <div className="flex flex-col justify-center space-y-1 lg:w-[26%] border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0 text-xs">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Contact Coordinates</span>
                      <div className="space-y-0.5 min-w-0">
                        {client.phone ? (
                          <a 
                            href={`tel:${client.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center space-x-1.5 text-slate-700 hover:text-blue-600 font-mono text-[11px]"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{client.phone}</span>
                          </a>
                        ) : (
                          <span className="text-[10.5px] text-slate-400 flex items-center space-x-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span>Phone not specified</span>
                          </span>
                        )}
                        {client.email ? (
                          <a 
                            href={`mailto:${client.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center space-x-1.5 text-slate-500 hover:text-blue-600 font-mono text-[11px]"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{client.email}</span>
                          </a>
                        ) : (
                          <span className="text-[10.5px] text-slate-400 flex items-center space-x-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                            <span>Email not specified</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Center-Right Column (24%): Commercial Documents & Flyout Menu */}
                    <div 
                      className="relative flex flex-col justify-center gap-1.5 lg:w-[24%] border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0"
                      data-doc-dropdown
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Commercial Documents
                        </span>
                        {stats.all.length > 0 && (
                          <span className="text-[9.5px] font-bold text-blue-700 font-mono bg-blue-50 px-1.5 py-0.2 rounded-md border border-blue-200/60">
                            {stats.all.length} Total
                          </span>
                        )}
                      </div>

                      {stats.all.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic py-1">
                          No documents created yet
                        </div>
                      ) : (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDocDropdownId(openDocDropdownId === client.id ? null : client.id);
                            }}
                            className={`w-full inline-flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                              openDocDropdownId === client.id
                                ? 'bg-blue-50/80 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            <span className="flex items-center space-x-1.5 truncate">
                              <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-bold text-slate-800">Select Document ({stats.all.length})</span>
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
                              openDocDropdownId === client.id ? 'rotate-180 text-blue-600' : ''
                            }`} />
                          </button>

                          {/* Floating Dropdown Menu */}
                          {openDocDropdownId === client.id && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-0 top-full mt-1.5 z-50 w-76 sm:w-84 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-2 text-left animate-in fade-in zoom-in-95 duration-150"
                            >
                              {/* Header Summary Badges */}
                              <div className="px-2 py-1.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-wrap items-center gap-1.5 mb-2">
                                {stats.quotes.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {stats.quotes.length} Quotes
                                  </span>
                                )}
                                {stats.proformas.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    {stats.proformas.length} PI
                                  </span>
                                )}
                                {stats.invoices.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    {stats.invoices.length} Invoices
                                  </span>
                                )}
                                {stats.challans.length > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    {stats.challans.length} Challans
                                  </span>
                                )}
                              </div>

                              {/* List of Documents */}
                              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 pr-0.5">
                                {stats.all.map((doc) => {
                                  const meta = classifyDocument(doc);
                                  const IconComp = meta.icon;
                                  const docNum = doc.challanNo || doc.invoiceNo || doc.quotationNumber || 'Untitled';
                                  const amt = Number(doc.grandTotal || doc.total || doc.totalAssessableValue || 0);

                                  return (
                                    <div
                                      key={doc.id || docNum}
                                      onClick={() => {
                                        setOpenDocDropdownId(null);
                                        if (onViewQuotation) onViewQuotation(doc);
                                      }}
                                      className="p-2 hover:bg-blue-50/60 rounded-xl transition-colors cursor-pointer group flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0 flex items-start space-x-2">
                                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${meta.badgeClass}`}>
                                          <IconComp className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center space-x-1.5">
                                            <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-blue-700 truncate">
                                              {docNum}
                                            </span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${meta.badgeClass}`}>
                                              {meta.label}
                                            </span>
                                          </div>
                                          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-2">
                                            <span>{formatDate(doc.date || doc.createdAt)}</span>
                                            {doc.status && (
                                              <span>• {doc.status}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="text-right shrink-0">
                                        <div className="font-mono font-black text-xs text-slate-900">
                                          {meta.type === 'challan' ? (
                                            <span className="text-amber-800">{doc.totalQuantity || (Array.isArray(doc.items) ? doc.items.reduce((s, i) => s + (Number(i.qty) || 0), 0) : 1)} Units</span>
                                          ) : (
                                            <span className="text-emerald-700">{formatCurrency(amt, false)}</span>
                                          )}
                                        </div>
                                        <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold text-blue-600 group-hover:underline">
                                          <Eye className="w-2.5 h-2.5" />
                                          <span>View</span>
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Far Right Column (16%): Total Billed & Quick Actions */}
                    <div className="flex items-center justify-between lg:flex-col lg:items-end lg:justify-center gap-1.5 border-t lg:border-t-0 border-slate-100 pt-2.5 lg:pt-0 lg:w-[16%] shrink-0">
                      <div className="lg:text-right">
                        <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Total Billed Revenue</span>
                        <span className="font-extrabold text-xs sm:text-sm font-mono text-emerald-700">
                          {stats.totalBilled > 0 
                            ? formatCurrency(stats.totalBilled, false) 
                            : (stats.totalQuoted > 0 ? formatCurrency(stats.totalQuoted, false) : '₹0')}
                        </span>
                        {stats.totalBilled > 0 && stats.totalQuoted > 0 && (
                          <span className="text-[9.5px] text-slate-400 block font-mono">
                            Pipeline: {formatCurrency(stats.totalQuoted, false)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 mt-1 sm:mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenEdit(client)}
                          title="Edit Customer"
                          className="p-1 sm:p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete customer "${client.companyName}"?`)) {
                              onDeleteClient(client.id);
                            }
                          }}
                          title="Delete Customer"
                          className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          {/* Cards Pagination */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {filteredClients.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, filteredClients.length)} of {filteredClients.length} Customers
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    currentPage === i + 1
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">
                {editingClient ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Company / Client Name *</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={handleGstinChange}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Billing / Plant Address</label>
                <textarea
                  rows="2"
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shipping Destination Address</label>
                <textarea
                  rows="2"
                  value={formData.shippingAddress}
                  onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(ClientsManager);
