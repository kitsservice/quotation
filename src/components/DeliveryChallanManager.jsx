import React, { useState, useMemo, useRef } from 'react';
import { 
  Truck, 
  Plus, 
  Trash2, 
  Eye, 
  Edit3, 
  Download, 
  Printer, 
  Search, 
  ArrowLeft, 
  FileText, 
  Building2, 
  MapPin, 
  Copy,
  Receipt,
  Package
} from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { numberToIndianWords } from '../utils/numberToWords';
import { generateNextDeliveryChallanNumber } from '../services/db';
import { exportToPdf, printDocument } from '../services/pdfGenerator';
import { KitsDocumentHeader, KitsDocumentFooter } from './KitsHeaderFooter';

const REMOVAL_PURPOSES = [
  'Installation & Commissioning at Site',
  'Supply on Approval',
  'For Job Work',
  'Demonstration / Exhibition',
  'Supply in Semi Knocked Down (SKD) Condition',
  'Replacement / Warranty Service',
  'Inter-Branch / Warehouse Transfer',
  'Other Transportation without Sale'
];

const TRANSPORT_MODES = ['Road', 'Courier', 'Hand Delivery', 'Rail', 'Air'];

const UNIT_OPTIONS = ['Nos', 'Sets', 'Lot', 'Pcs', 'Kg', 'Meters', 'Boxes', 'Pairs'];

function getFormattedTime() {
  const d = new Date();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function createDefaultFormData(quotations) {
  const todayStr = new Date().toISOString().split('T')[0];
  return {
    id: '',
    challanNo: generateNextDeliveryChallanNumber(quotations),
    date: todayStr,
    dispatchTime: getFormattedTime(),
    purpose: 'Installation & Commissioning at Site',
    linkedDocType: '',
    linkedDocId: '',
    linkedDocNumber: '',
    customerPoNo: '',
    customerPoDate: '',
    clientId: '',
    clientName: '',
    billingAddress: '',
    clientGstin: '',
    clientState: 'Maharashtra',
    placeOfSupply: 'Akola Maharashtra',
    shipToSameAsBillTo: true,
    shippingAddress: '',
    contactPerson: '',
    contactPhone: '',
    transportMode: 'Road',
    vehicleNo: '',
    transporterName: '',
    lrNumber: '',
    lrDate: todayStr,
    ewayBillNo: '',
    status: 'Dispatched',
    remarks: '1. Goods dispatched strictly for the purpose mentioned above under Rule 55 of CGST Rules, 2017.\n2. This is NOT A SALE INVOICE. No financial sale is affected through this delivery challan.\n3. Consignment to be verified and acknowledged by the receiver upon delivery.',
    items: [
      {
        id: 'item-1',
        name: '',
        description: '',
        hsn: '',
        qty: 1,
        unit: 'Nos',
        rate: 0,
        amount: 0
      }
    ]
  };
}

function isProperTaxInvoice(doc) {
  if (!doc) return false;

  // 1. Explicitly exclude Delivery Challans
  if (doc.isDeliveryChallan || doc.documentType === 'Delivery Challan') {
    return false;
  }

  // 2. Explicitly exclude Proforma Invoices (not a proper tax invoice)
  if (doc.isProforma || doc.documentType === 'Proforma Invoice') {
    return false;
  }
  const qNum = String(doc.quotationNumber || '');
  const invNum = String(doc.invoiceNo || '');
  if (qNum.startsWith('PI-') || invNum.startsWith('PI-')) {
    return false;
  }

  // 3. Explicitly exclude regular Quotations (not an invoice)
  if (doc.documentType === 'Quotation' && !doc.isTaxInvoice) {
    return false;
  }
  if (!doc.isTaxInvoice && doc.documentType !== 'Tax Invoice' && doc.documentType !== 'Invoice') {
    if (qNum.startsWith('QT-') || qNum.startsWith('KITS/AKL')) {
      return false;
    }
  }

  // 4. Must be a genuine Tax Invoice / Invoice
  return Boolean(
    doc.isTaxInvoice === true ||
    doc.documentType === 'Tax Invoice' ||
    doc.documentType === 'Invoice' ||
    (invNum && (invNum.includes('/INV/') || invNum.startsWith('INV-')))
  );
}

function DeliveryChallanManager({
  clients = [],
  quotations = [],
  companySettings = {},
  initialMode = 'list',
  onSaveChallan,
  onDeleteChallan,
  onNavigateTab,
  onViewQuotation
}) {
  const [viewMode, setViewMode] = useState(initialMode || 'list'); // 'list' | 'create' | 'preview'
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPurpose, setFilterPurpose] = useState('all');
  const [copyType, setCopyType] = useState('ORIGINAL FOR CONSIGNEE');
  const [isExporting, setIsExporting] = useState(false);
  const printAreaRef = useRef(null);

  // Direct navigation to referenced document (Invoice / Quotation)
  const handleOpenLinkedDocument = (docNumber, docId) => {
    if (!docNumber && !docId) return;

    const target = (docNumber || '').trim().toLowerCase();
    const targetId = docId || '';

    const found = quotations.find(q => {
      if (targetId && q.id === targetId) return true;
      if (!target) return false;
      const qNum = (q.quotationNumber || '').trim().toLowerCase();
      const invNum = (q.invoiceNo || '').trim().toLowerCase();
      const challanNum = (q.challanNo || '').trim().toLowerCase();
      return qNum === target || invNum === target || challanNum === target;
    });

    if (found) {
      if (onViewQuotation) {
        onViewQuotation(found, 'challans');
      }
    } else {
      alert(`Referenced document "${docNumber}" not found in current records.`);
    }
  };

  // Single-pass partitioning: Delivery Challans vs Proper Tax Invoices (strictly excluding Quotations & Proformas)
  const { deliveryChallans, taxInvoices } = useMemo(() => {
    const challans = [];
    const invoices = [];
    for (let i = 0; i < quotations.length; i++) {
      const q = quotations[i];
      if (q.isDeliveryChallan || q.documentType === 'Delivery Challan') {
        challans.push(q);
      } else if (isProperTaxInvoice(q)) {
        invoices.push(q);
      }
    }
    return { deliveryChallans: challans, taxInvoices: invoices };
  }, [quotations]);

  // Filtered Delivery Challans for the listing view
  const filteredChallans = useMemo(() => {
    return deliveryChallans.filter(ch => {
      const matchPurpose = filterPurpose === 'all' || ch.purpose === filterPurpose;
      if (!matchPurpose) return false;
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return (
        (ch.challanNo || ch.quotationNumber || '').toLowerCase().includes(term) ||
        (ch.clientName || '').toLowerCase().includes(term) ||
        (ch.vehicleNo || '').toLowerCase().includes(term) ||
        (ch.ewayBillNo || '').toLowerCase().includes(term) ||
        (ch.lrNumber || '').toLowerCase().includes(term) ||
        (ch.purpose || '').toLowerCase().includes(term)
      );
    });
  }, [deliveryChallans, filterPurpose, searchQuery]);

  // Form State
  const [formData, setFormData] = useState(() => createDefaultFormData(quotations));

  // Quick statistics
  const stats = useMemo(() => {
    const total = deliveryChallans.length;
    const dispatched = deliveryChallans.filter(c => (c.status || 'Dispatched') === 'Dispatched').length;
    const onApproval = deliveryChallans.filter(c => c.purpose === 'Supply on Approval').length;
    const totalValue = deliveryChallans.reduce((sum, c) => sum + (Number(c.totalAssessableValue || c.total || 0)), 0);
    return { total, dispatched, onApproval, totalValue };
  }, [deliveryChallans]);

  // Initiate New Challan
  const handleStartCreate = () => {
    setFormData(createDefaultFormData(quotations));
    setSelectedChallan(null);
    setViewMode('create');
  };

  // Edit Existing Challan
  const handleStartEdit = (ch) => {
    setFormData({
      id: ch.id || '',
      challanNo: ch.challanNo || ch.quotationNumber || generateNextDeliveryChallanNumber(quotations),
      date: ch.date || ch.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      dispatchTime: ch.dispatchTime || '11:00 AM',
      purpose: ch.purpose || 'Installation & Commissioning at Site',
      linkedDocType: ch.linkedDocType || '',
      linkedDocId: ch.linkedDocId || '',
      linkedDocNumber: ch.linkedDocNumber || '',
      customerPoNo: ch.customerPoNo || '',
      customerPoDate: ch.customerPoDate || '',
      clientId: ch.clientId || '',
      clientName: ch.clientName || '',
      billingAddress: ch.billingAddress || '',
      clientGstin: ch.clientGstin || '',
      clientState: ch.clientState || 'Maharashtra',
      placeOfSupply: ch.placeOfSupply || 'Akola Maharashtra',
      shipToSameAsBillTo: ch.shipToSameAsBillTo !== undefined ? ch.shipToSameAsBillTo : true,
      shippingAddress: ch.shippingAddress || '',
      contactPerson: ch.contactPerson || '',
      contactPhone: ch.contactPhone || '',
      transportMode: ch.transportMode || 'Road',
      vehicleNo: ch.vehicleNo || '',
      transporterName: ch.transporterName || '',
      lrNumber: ch.lrNumber || '',
      lrDate: ch.lrDate || '',
      ewayBillNo: ch.ewayBillNo || '',
      status: ch.status || 'Dispatched',
      remarks: ch.remarks || '',
      items: Array.isArray(ch.items) && ch.items.length > 0 
        ? ch.items.map(it => ({
            id: it.id || 'it-' + Math.random(),
            name: it.name || it.title || '',
            description: it.description || '',
            hsn: it.hsn || it.hsnCode || '',
            qty: Number(it.qty) || 1,
            unit: it.unit || 'Nos',
            rate: Number(it.rate || it.unitPrice || 0),
            amount: Number(it.amount || it.taxableAmount || (Number(it.qty || 1) * Number(it.rate || it.unitPrice || 0)))
          }))
        : createDefaultFormData(quotations).items
    });
    setSelectedChallan(ch);
    setViewMode('create');
  };

  // View / Print Preview
  const handleViewPreview = (ch) => {
    setSelectedChallan(ch);
    setViewMode('preview');
  };

  // Duplicate Challan
  const handleDuplicate = (ch) => {
    const nextNo = generateNextDeliveryChallanNumber(quotations);
    const duplicated = {
      ...ch,
      id: '',
      challanNo: nextNo,
      quotationNumber: nextNo,
      date: new Date().toISOString().split('T')[0],
      dispatchTime: getFormattedTime(),
      createdAt: new Date().toISOString()
    };
    handleStartEdit(duplicated);
  };

  // 1-Click Import from existing Tax Invoice (strictly Tax Invoices only)
  const handleImportInvoice = (docId) => {
    if (!docId) {
      setFormData(prev => ({
        ...prev,
        linkedDocType: '',
        linkedDocId: '',
        linkedDocNumber: ''
      }));
      return;
    }
    const doc = taxInvoices.find(d => d.id === docId);
    if (!doc) return;

    const docNumber = doc.invoiceNo || doc.quotationNumber || '';

    setFormData(prev => ({
      ...prev,
      linkedDocType: 'Tax Invoice',
      linkedDocId: doc.id,
      linkedDocNumber: docNumber,
      clientId: doc.clientId || doc.customerId || prev.clientId,
      clientName: doc.clientName || doc.customerName || prev.clientName,
      billingAddress: doc.billingAddress || prev.billingAddress,
      clientGstin: doc.clientGstin || doc.customerGstin || prev.clientGstin,
      clientState: doc.clientState || prev.clientState || 'Maharashtra',
      placeOfSupply: doc.placeOfSupply || prev.placeOfSupply,
      customerPoNo: doc.customerPoNo || prev.customerPoNo,
      customerPoDate: doc.customerPoDate || prev.customerPoDate,
      shippingAddress: doc.shippingAddress || doc.billingAddress || prev.shippingAddress,
      shipToSameAsBillTo: doc.shipToSameAsBillTo !== undefined ? doc.shipToSameAsBillTo : true,
      vehicleNo: doc.vehicleNo || prev.vehicleNo,
      ewayBillNo: doc.ewayBillNo || prev.ewayBillNo,
      transporterName: doc.transporterName || prev.transporterName,
      transportMode: doc.modeOfTransport || doc.transportMode || prev.transportMode,
      lrNumber: doc.lrNo || doc.lrNumber || prev.lrNumber,
      lrDate: doc.lrDate || prev.lrDate,
      items: Array.isArray(doc.items) && doc.items.length > 0
        ? doc.items.map((it, idx) => ({
            id: 'item-imp-' + idx,
            name: it.title || it.name || '',
            description: it.description || '',
            hsn: it.hsn || it.hsnCode || '',
            qty: Number(it.qty) || 1,
            unit: it.unit || 'Nos',
            rate: Number(it.unitPrice || it.rate || 0),
            amount: (Number(it.qty) || 1) * (Number(it.unitPrice || it.rate || 0))
          }))
        : prev.items
    }));
  };

  // Client Selection Helper
  const handleSelectClient = (clientId) => {
    if (!clientId) return;
    const cl = clients.find(c => c.id === clientId);
    if (!cl) return;

    setFormData(prev => ({
      ...prev,
      clientId: cl.id,
      clientName: cl.companyName || cl.name || '',
      billingAddress: cl.address || '',
      shippingAddress: cl.shippingAddress || cl.address || '',
      clientGstin: cl.gstin || '',
      clientState: cl.state || 'Maharashtra',
      placeOfSupply: cl.city ? `${cl.city} ${cl.state || 'Maharashtra'}` : (cl.state || 'Maharashtra')
    }));
  };

  // Line Item Handlers
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      const item = { ...nextItems[index], [field]: value };
      
      if (field === 'qty' || field === 'rate') {
        const q = field === 'qty' ? Number(value) || 0 : Number(item.qty) || 0;
        const r = field === 'rate' ? Number(value) || 0 : Number(item.rate) || 0;
        item.amount = q * r;
      }
      
      nextItems[index] = item;
      return { ...prev, items: nextItems };
    });
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: 'item-' + Date.now(),
          name: '',
          description: '',
          hsn: '',
          qty: 1,
          unit: 'Nos',
          rate: 0,
          amount: 0
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Form Calculations
  const calculatedTotalQuantity = useMemo(() => {
    return formData.items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  }, [formData.items]);

  const calculatedAssessableValue = useMemo(() => {
    return formData.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }, [formData.items]);

  // Submit Handler
  const handleSave = (andView = false) => {
    const challanDoc = {
      ...formData,
      id: formData.id || 'dc_' + Date.now(),
      documentType: 'Delivery Challan',
      isDeliveryChallan: true,
      quotationNumber: formData.challanNo, // Unified identifier
      totalQuantity: calculatedTotalQuantity,
      totalAssessableValue: calculatedAssessableValue,
      total: calculatedAssessableValue,
      subtotal: calculatedAssessableValue,
      updatedAt: new Date().toISOString()
    };

    if (!challanDoc.createdAt) {
      challanDoc.createdAt = new Date().toISOString();
    }

    if (onSaveChallan) {
      onSaveChallan(challanDoc);
    }

    if (andView) {
      setSelectedChallan(challanDoc);
      setViewMode('preview');
    } else {
      setViewMode('list');
    }
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const sanitizedNumber = (selectedChallan?.challanNo || 'Delivery_Challan').replace(/[/\\]/g, '_');
      await exportToPdf('printable-delivery-challan', `KITS_Delivery_Challan_${sanitizedNumber}.pdf`);
    } catch (err) {
      console.error('Failed to export Delivery Challan PDF:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ========================================================================= */}
      {/* 1. VIEW MODE: CARDS / LIST VIEW                                           */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          
          {/* Header & Metrics Strip */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-3.5">
              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('dashboard')}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Back to Dashboard"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Delivery Challans</h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Rule 55 CGST
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate statutory goods transport challans without sales invoices for installations, job work, and trials.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleStartCreate}
                className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Delivery Challan</span>
              </button>
            </div>
          </div>

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Challans</span>
              <span className="text-lg font-black text-slate-900 font-mono mt-0.5 block">{stats.total}</span>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dispatched</span>
              <span className="text-lg font-black text-emerald-600 font-mono mt-0.5 block">{stats.dispatched}</span>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">On Approval</span>
              <span className="text-lg font-black text-amber-600 font-mono mt-0.5 block">{stats.onApproval}</span>
            </div>

            <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessable Cargo Value</span>
              <span className="text-lg font-black text-blue-700 font-mono mt-0.5 block">{formatCurrency(stats.totalValue, false)}</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Challan No, Customer, Vehicle No, E-Way Bill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Purpose:</span>
              <select
                value={filterPurpose}
                onChange={(e) => setFilterPurpose(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 px-3 py-2 focus:outline-hidden focus:border-blue-500"
              >
                <option value="all">All Removal Purposes</option>
                {REMOVAL_PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Challans List / Cards */}
          {filteredChallans.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <Truck className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-800">No Delivery Challans Found</h3>
                <p className="text-xs text-slate-500">
                  {searchQuery 
                    ? 'No challans matched your search query. Try clearing the filters.' 
                    : 'Create your first Delivery Challan under Rule 55 to transport goods, machines, automation panels, and demo units safely.'}
                </p>
              </div>
              <button
                onClick={handleStartCreate}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Delivery Challan</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredChallans.map((ch) => {
                const itemCount = Array.isArray(ch.items) ? ch.items.length : 0;
                const totalQty = ch.totalQuantity || (Array.isArray(ch.items) ? ch.items.reduce((s, i) => s + (Number(i.qty) || 0), 0) : 0);
                const assessableVal = Number(ch.totalAssessableValue || ch.total || 0);

                return (
                  <div 
                    key={ch.id || ch.challanNo}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 p-3 sm:p-3.5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                      
                      {/* Left Column (32%): Challan No, Consignee Name, Place of Supply, Date */}
                      <div className="flex items-center space-x-3 min-w-0 lg:w-[32%]">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs bg-amber-50 text-amber-700 border border-amber-200/80">
                          <Truck className="w-4 h-4 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleViewPreview(ch)}
                              className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-200/80 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-all cursor-pointer hover:underline"
                              title={`View Delivery Challan ${ch.challanNo || ch.quotationNumber}`}
                            >
                              {ch.challanNo || ch.quotationNumber}
                            </button>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                              {ch.status || 'Dispatched'}
                            </span>
                          </div>
                          <h4 
                            onClick={() => handleViewPreview(ch)}
                            className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5 hover:text-blue-600 transition-colors cursor-pointer"
                            title={ch.clientName}
                          >
                            {ch.clientName || 'Consignee Name Not Set'}
                          </h4>
                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="truncate max-w-[160px]">{ch.placeOfSupply || ch.billingAddress || 'Akola, Maharashtra'}</span>
                            <span>•</span>
                            <span className="font-medium shrink-0">{formatDate(ch.date)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Center Column (26%): Removal Purpose & Transport Details */}
                      <div className="flex flex-col justify-center space-y-1 lg:w-[26%] border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0 text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Removal Purpose</span>
                          <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-[10.5px] font-semibold text-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            <span className="truncate max-w-[220px]">{ch.purpose || 'Installation & Commissioning'}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-slate-600">
                          <span>Vehicle: <strong className="font-mono font-bold text-slate-800">{ch.vehicleNo || ch.transporterName || 'Self / Road'}</strong></span>
                          {ch.lrNumber && (
                            <span className="text-slate-500">LR: <strong className="font-mono">{ch.lrNumber}</strong></span>
                          )}
                        </div>
                      </div>

                      {/* Center-Right Column (22%): Quantity, Items & Linked Reference */}
                      <div className="flex flex-col justify-center space-y-1 lg:w-[22%] border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0 text-xs">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Consignment Cargo</span>
                        <div className="font-bold text-slate-900 text-xs flex items-center space-x-1.5">
                          <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-200/70 rounded-md font-mono text-[10px]">
                            {totalQty} {totalQty === 1 ? 'Unit' : 'Units'}
                          </span>
                          <span className="text-slate-500 text-[10.5px]">
                            ({itemCount} {itemCount === 1 ? 'Item' : 'Items'})
                          </span>
                        </div>
                        {ch.linkedDocNumber ? (
                          <button
                            type="button"
                            onClick={() => handleOpenLinkedDocument(ch.linkedDocNumber, ch.linkedDocId)}
                            className="text-[10.5px] text-emerald-700 font-mono font-semibold flex items-center space-x-1 hover:underline cursor-pointer text-left"
                            title={`Open Referenced Document ${ch.linkedDocNumber}`}
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate">Ref Inv: {ch.linkedDocNumber}</span>
                          </button>
                        ) : ch.customerPoNo ? (
                          <div className="text-[10.5px] text-slate-500 truncate">
                            PO: <strong className="font-mono text-slate-700">{ch.customerPoNo}</strong>
                          </div>
                        ) : Array.isArray(ch.items) && ch.items[0]?.name ? (
                          <div className="text-[10.5px] text-slate-400 truncate max-w-[180px]">
                            {ch.items[0].name}
                          </div>
                        ) : null}
                      </div>

                      {/* Far Right Column (20%): Assessable Value & Action Buttons */}
                      <div className="flex items-center justify-between lg:flex-col lg:items-end lg:justify-center gap-1.5 border-t lg:border-t-0 border-slate-100 pt-2.5 lg:pt-0 lg:w-[20%] shrink-0">
                        <div className="lg:text-right">
                          <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Assessable Cargo Value</span>
                          <span className="font-extrabold text-xs sm:text-sm font-mono text-blue-700">
                            {formatCurrency(assessableVal)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 mt-1 sm:mt-1.5">
                          <button
                            onClick={() => handleViewPreview(ch)}
                            className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="View / Print Delivery Challan"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleStartEdit(ch)}
                            title="Edit Challan"
                            className="p-1 sm:p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(ch)}
                            title="Duplicate Challan"
                            className="p-1 sm:p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteChallan && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete delivery challan ${ch.challanNo || ch.quotationNumber}?`)) {
                                  onDeleteChallan(ch.id);
                                }
                              }}
                              title="Delete Challan"
                              className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. VIEW MODE: CREATE / EDIT FORM                                          */}
      {/* ========================================================================= */}
      {viewMode === 'create' && (
        <div className="space-y-6">
          
          {/* Top Bar with Back & Save */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  {formData.id ? `Edit Delivery Challan (${formData.challanNo})` : 'Create Delivery Challan (Rule 55)'}
                </h1>
                <p className="text-xs text-slate-500">
                  Statutory CGST Rule 55 Delivery Challan for movement of goods without tax invoice.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Save Challan
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer flex items-center space-x-1.5"
              >
                <Eye className="w-4 h-4" />
                <span>Save &amp; View Document</span>
              </button>
            </div>
          </div>

          {/* Quick Import from Tax Invoices (Proper Invoices only) */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50/60 p-4 rounded-2xl border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">1-Click Auto-Fill from Final Invoice</div>
                <div className="text-[11px] text-slate-600">Select an existing final invoice to populate customer info, transport logistics, and line items.</div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={formData.linkedDocId || ''}
                onChange={(e) => handleImportInvoice(e.target.value)}
                className="bg-white border border-blue-300 rounded-xl text-xs font-semibold text-slate-800 px-3 py-2 shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="">-- Select Final Invoice to Import --</option>
                {taxInvoices.length === 0 ? (
                  <option value="" disabled>No Final Invoices Found</option>
                ) : (
                  taxInvoices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.invoiceNo || d.quotationNumber} — {d.clientName || d.customerName || 'Untitled'} ({formatCurrency(d.grandTotal || d.total || 0, false)})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* SECTION 1: Challan Identification & Nature of Removal */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Challan Identification &amp; Statutory Purpose</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Challan No. <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.challanNo}
                  onChange={(e) => setFormData({ ...formData, challanNo: e.target.value })}
                  placeholder="KITS/DC/026/11/001"
                  className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-xs text-blue-700 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Challan Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Time of Removal / Dispatch
                </label>
                <input
                  type="text"
                  value={formData.dispatchTime}
                  onChange={(e) => setFormData({ ...formData, dispatchTime: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                >
                  <option value="Dispatched">Dispatched</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered &amp; Acknowledged</option>
                  <option value="Returned">Returned / Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Nature / Purpose (Rule 55) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                >
                  {REMOVAL_PURPOSES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Ref Final Invoice No.
                </label>
                <input
                  type="text"
                  value={formData.linkedDocNumber}
                  onChange={(e) => setFormData({ ...formData, linkedDocNumber: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-blue-700 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Ref PO / Work Order No.
                </label>
                <input
                  type="text"
                  value={formData.customerPoNo}
                  onChange={(e) => setFormData({ ...formData, customerPoNo: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Ref PO Date
                </label>
                <input
                  type="date"
                  value={formData.customerPoDate}
                  onChange={(e) => setFormData({ ...formData, customerPoDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Consignee & Shipping Destination */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Consignee (Billed To) &amp; Delivery Destination (Shipped To)</span>
              </div>

              {clients.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] text-slate-500 font-medium">Pick Customer:</span>
                  <select
                    onChange={(e) => handleSelectClient(e.target.value)}
                    defaultValue=""
                    className="bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 px-2.5 py-1"
                  >
                    <option value="" disabled>-- Select Customer --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName || c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Consignee (Bill To) */}
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Consignee Details (Buyer / Party)
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Company / Consignee Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="Enter customer name"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Consignee Address
                  </label>
                  <textarea
                    rows={2}
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    placeholder="Plant / Office Address, City, PIN"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={formData.clientGstin}
                      onChange={(e) => setFormData({ ...formData, clientGstin: e.target.value.toUpperCase() })}
                      placeholder=""
                      className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Place of Supply / State
                    </label>
                    <input
                      type="text"
                      value={formData.placeOfSupply}
                      onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
                      placeholder=""
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Site (Ship To) */}
              <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/70">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Consignment Destination (Shipped To)
                  </div>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-xs font-semibold text-blue-600">
                    <input
                      type="checkbox"
                      checked={formData.shipToSameAsBillTo}
                      onChange={(e) => setFormData({ ...formData, shipToSameAsBillTo: e.target.checked })}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Same as Consignee Address</span>
                  </label>
                </div>

                {!formData.shipToSameAsBillTo ? (
                  <>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Site / Delivery Address
                      </label>
                      <textarea
                        rows={2}
                        value={formData.shippingAddress}
                        onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                        placeholder=""
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Site Contact Person
                        </label>
                        <input
                          type="text"
                          value={formData.contactPerson}
                          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                          placeholder=""
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Site Contact Phone
                        </label>
                        <input
                          type="text"
                          value={formData.contactPhone}
                          onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                          placeholder="Mobile / Phone"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs text-center border border-dashed border-slate-200 rounded-xl">
                    <MapPin className="w-5 h-5 mb-1 text-slate-300" />
                    <span>Consignment will be delivered directly to the Consignee billing address.</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* SECTION 3: Transport & Dispatch Particulars */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-3">
              <Truck className="w-4 h-4 text-blue-600" />
              <span>Transportation &amp; Dispatch Particulars</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Mode of Transport
                </label>
                <select
                  value={formData.transportMode}
                  onChange={(e) => setFormData({ ...formData, transportMode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                >
                  {TRANSPORT_MODES.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Vehicle No. <span className="text-slate-400 font-normal">(if by road)</span>
                </label>
                <input
                  type="text"
                  value={formData.vehicleNo}
                  onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value.toUpperCase() })}
                  placeholder=""
                  className="w-full px-3 py-2 font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Transporter Name
                </label>
                <input
                  type="text"
                  value={formData.transporterName}
                  onChange={(e) => setFormData({ ...formData, transporterName: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  LR / GR / Docket No.
                </label>
                <input
                  type="text"
                  value={formData.lrNumber}
                  onChange={(e) => setFormData({ ...formData, lrNumber: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  E-Way Bill No. <span className="text-slate-400 font-normal">(&gt;₹50k)</span>
                </label>
                <input
                  type="text"
                  value={formData.ewayBillNo}
                  onChange={(e) => setFormData({ ...formData, ewayBillNo: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Line Items (Consignment Description & Assessable Values) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Description of Consigned Goods &amp; Assessable Value</span>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Item Row</span>
              </button>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Description of Goods / Machine / Components</th>
                    <th className="py-2.5 px-3 w-28">HSN / SAC</th>
                    <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-24">Unit</th>
                    <th className="py-2.5 px-3 w-32 text-right">Unit Rate (₹)</th>
                    <th className="py-2.5 px-3 w-36 text-right">Assessable Val (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{index + 1}</td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          placeholder=""
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-blue-500"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Optional specifications, model, serial no."
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-500 mt-1 focus:outline-hidden focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => handleItemChange(index, 'hsn', e.target.value)}
                          placeholder=""
                          className="w-full px-2 py-1.5 font-mono text-center bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          className="w-full px-2 py-1.5 text-center font-bold bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={item.unit}
                          onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        >
                          {UNIT_OPTIONS.map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="number"
                          value={item.rate}
                          onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                          className="w-full px-2 py-1.5 text-right font-mono bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={formData.items.length <= 1}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 text-right">Total Consignment:</td>
                    <td className="py-2.5 px-3 text-center text-blue-700">{calculatedTotalQuantity} Units</td>
                    <td colSpan={2} className="py-2.5 px-3 text-right">Total Assessable Value:</td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-blue-700">
                      {formatCurrency(calculatedAssessableValue)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Assessable Value in Indian Words */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-center space-x-2">
              <span className="font-bold text-slate-700 shrink-0">Amount in Words:</span>
              <span className="text-slate-800 font-serif italic font-medium">
                {numberToIndianWords(calculatedAssessableValue)}
              </span>
            </div>
          </div>

          {/* SECTION 5: Remarks & Statutory Declaration */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              Statutory Notes, Purpose Details &amp; Special Instructions
            </label>
            <textarea
              rows={3}
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed focus:bg-white focus:outline-hidden focus:border-blue-500"
            />
            <div className="text-[11px] text-slate-500 italic">
              Note: Under Rule 55 of CGST Rules, this document serves strictly as proof of transportation without financial sale.
            </div>
          </div>

          {/* Bottom Save Action Bar */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              Save Challan
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 cursor-pointer flex items-center space-x-1.5"
            >
              <Eye className="w-4 h-4" />
              <span>Save &amp; View Document</span>
            </button>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VIEW MODE: OFFICIAL A4 PRINTABLE DOCUMENT PREVIEW                      */}
      {/* ========================================================================= */}
      {viewMode === 'preview' && selectedChallan && (
        <div className="space-y-6">

          {/* Action Toolbar */}
          <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Delivery Challan: {selectedChallan.challanNo || selectedChallan.quotationNumber}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Rule 55
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Consignee: {selectedChallan.clientName} • {formatDate(selectedChallan.date)}
                </div>
              </div>
            </div>

            {/* Copy Type Selector */}
            <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
              {['ORIGINAL FOR CONSIGNEE', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR CONSIGNOR'].map(copy => (
                <button
                  key={copy}
                  onClick={() => setCopyType(copy)}
                  className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    copyType === copy
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {copy.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleStartEdit(selectedChallan)}
                className="px-3.5 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => printDocument()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>
            </div>
          </div>

          {/* Printable Container */}
          <div 
            id="printable-delivery-challan"
            ref={printAreaRef}
            className="flex flex-col items-center justify-center w-full"
          >
            {/* A4 Sheet Container */}
            <div className="a4-sheet bg-white text-slate-900 shadow-xl border border-slate-300 w-[210mm] min-h-[297mm] p-6 sm:p-8 flex flex-col justify-between mx-auto box-border relative font-sans text-xs">
              
              <div className="space-y-3.5">
                
                {/* Official KITS Header */}
                <KitsDocumentHeader companySettings={companySettings} />

                {/* Document Title & Copy Type Banner */}
                <div className="relative text-center border-b-2 border-slate-900 pb-2.5 pt-1">
                  
                  {/* Top Copy Indicator Badge */}
                  <div className="absolute right-0 top-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-800 bg-slate-100 text-slate-900">
                    {copyType}
                  </div>

                  <h2 className="text-xl font-black tracking-wider text-slate-950 uppercase font-serif">
                    DELIVERY CHALLAN
                  </h2>
                  <div className="text-[9.5px] font-bold text-slate-700 tracking-wide mt-0.5 uppercase">
                    (ISSUED UNDER RULE 55 OF CGST RULES, 2017 FOR TRANSPORTATION OF GOODS WITHOUT INVOICE)
                  </div>
                </div>

                {/* Details Top Grid */}
                <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-300 pb-3">
                  
                  {/* Left Column: Challan Metadata */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">Delivery Challan No.:</span>
                      <span className="font-mono font-black text-slate-950">{selectedChallan.challanNo || selectedChallan.quotationNumber}</span>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">Challan Date:</span>
                      <span className="font-semibold text-slate-950">{formatDate(selectedChallan.date)}</span>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">Time of Removal:</span>
                      <span className="text-slate-800">{selectedChallan.dispatchTime || '11:00 AM'}</span>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">Nature of Removal:</span>
                      <span className="font-bold text-blue-900">{selectedChallan.purpose || 'Installation & Commissioning'}</span>
                    </div>
                  </div>

                  {/* Right Column: Transport & Ref Metadata */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">Mode of Transport:</span>
                      <span className="font-semibold text-slate-950">{selectedChallan.transportMode || 'Road'}</span>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">Vehicle No.:</span>
                      <span className="font-mono font-bold text-slate-950">{selectedChallan.vehicleNo || 'Self / Road'}</span>
                    </div>
                    <div className="grid grid-cols-[130px_1fr]">
                      <span className="font-bold text-slate-900">LR / GR No. &amp; Date:</span>
                      <span className="text-slate-800">
                        {selectedChallan.lrNumber ? `${selectedChallan.lrNumber} (${formatDate(selectedChallan.lrDate || selectedChallan.date)})` : 'Hand Delivery'}
                      </span>
                    </div>
                    {selectedChallan.ewayBillNo && (
                      <div className="grid grid-cols-[130px_1fr]">
                        <span className="font-bold text-slate-900">E-Way Bill No.:</span>
                        <span className="font-mono font-bold text-slate-950">{selectedChallan.ewayBillNo}</span>
                      </div>
                    )}
                    {selectedChallan.linkedDocNumber && (
                      <div className="grid grid-cols-[130px_1fr]">
                        <span className="font-bold text-slate-900">Ref Final Invoice:</span>
                        <span className="font-mono font-bold text-slate-950">{selectedChallan.linkedDocNumber}</span>
                      </div>
                    )}
                    {selectedChallan.customerPoNo && (
                      <div className="grid grid-cols-[130px_1fr]">
                        <span className="font-bold text-slate-900">Ref PO / Order No.:</span>
                        <span className="text-slate-800">{selectedChallan.customerPoNo}</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Consignor (From) & Consignee (To) Boxes */}
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  
                  {/* Left Box: Consignor (Supplier / KITS) */}
                  <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                      Details of Consignor (From):
                    </div>
                    <div className="font-bold text-slate-950">
                      {companySettings?.name || 'KITS Robotics & Automation Pvt.Ltd'}
                    </div>
                    <div className="text-slate-700 leading-tight">
                      {companySettings?.address || 'Mukta Plaza, KITS Square, Income Tax Chowk, Gaurakshan Road, Akola-444001, Maharashtra'}
                    </div>
                    <div className="text-slate-900 pt-0.5">
                      <span className="font-bold">GSTIN: </span>
                      <span className="font-mono font-bold">{companySettings?.gstin || '27AAMCK1536C1ZP'}</span>
                    </div>
                    <div className="text-slate-900">
                      <span className="font-bold">State: </span>Maharashtra
                    </div>
                  </div>

                  {/* Right Box: Consignee (Receiver / Buyer) */}
                  <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
                      Details of Consignee (Billed &amp; Shipped To):
                    </div>
                    <div className="font-bold text-slate-950">
                      {selectedChallan.clientName || 'Customer Name'}
                    </div>
                    <div className="text-slate-700 leading-tight">
                      {selectedChallan.shipToSameAsBillTo || !selectedChallan.shippingAddress
                        ? (selectedChallan.billingAddress || 'Customer Site / Plant Address')
                        : selectedChallan.shippingAddress}
                    </div>
                    {selectedChallan.clientGstin && (
                      <div className="text-slate-900 pt-0.5">
                        <span className="font-bold">GSTIN / UIN: </span>
                        <span className="font-mono font-bold">{selectedChallan.clientGstin}</span>
                      </div>
                    )}
                    <div className="text-slate-900">
                      <span className="font-bold">Place of Supply: </span>
                      <span>{selectedChallan.placeOfSupply || 'Maharashtra'}</span>
                    </div>
                  </div>

                </div>

                {/* Table of Goods / Consignment Particulars */}
                <div className="pt-1">
                  <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                        <th className="py-2 px-2 border-r border-slate-800 w-8 text-center">Sr.</th>
                        <th className="py-2 px-3 border-r border-slate-800">Description of Goods / Machine / Equipment</th>
                        <th className="py-2 px-2 border-r border-slate-800 w-24 text-center">HSN / SAC</th>
                        <th className="py-2 px-2 border-r border-slate-800 w-16 text-center">Quantity</th>
                        <th className="py-2 px-2 border-r border-slate-800 w-16 text-center">Unit</th>
                        <th className="py-2 px-3 border-r border-slate-800 w-24 text-right">Rate (₹)</th>
                        <th className="py-2 px-3 w-28 text-right">Assessable Val (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.isArray(selectedChallan.items) && selectedChallan.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-300">
                          <td className="py-2 px-2 border-r border-slate-800 text-center font-bold text-slate-800">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-800">
                            <div className="font-bold text-slate-950">{item.name || item.title}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-600 mt-0.5 leading-tight">{item.description}</div>
                            )}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-800 text-center font-mono text-[10px]">
                            {item.hsn || item.hsnCode || '-'}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-800 text-center font-bold text-slate-950">
                            {item.qty || 1}
                          </td>
                          <td className="py-2 px-2 border-r border-slate-800 text-center text-slate-700">
                            {item.unit || 'Nos'}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-800 text-right font-mono text-slate-800">
                            {formatNumber(item.rate || 0)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                            {formatNumber(item.amount || (Number(item.qty || 1) * Number(item.rate || 0)))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="font-bold border-t-2 border-slate-800 bg-slate-50 text-slate-950">
                      <tr>
                        <td colSpan={3} className="py-2 px-3 border-r border-slate-800 text-right uppercase">
                          Total Consignment:
                        </td>
                        <td className="py-2 px-2 border-r border-slate-800 text-center font-black">
                          {selectedChallan.totalQuantity || (Array.isArray(selectedChallan.items) ? selectedChallan.items.reduce((s, i) => s + (Number(i.qty) || 0), 0) : 0)}
                        </td>
                        <td colSpan={2} className="py-2 px-3 border-r border-slate-800 text-right uppercase">
                          Total Assessable Value:
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-slate-950">
                          {formatCurrency(Number(selectedChallan.totalAssessableValue || selectedChallan.total || 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="border border-slate-300 rounded px-3 py-2 bg-slate-50 text-[11px]">
                  <span className="font-bold text-slate-900">Assessable Value in Words: </span>
                  <span className="italic font-serif font-medium text-slate-900">
                    {numberToIndianWords(Number(selectedChallan.totalAssessableValue || selectedChallan.total || 0))}
                  </span>
                </div>

                {/* Remarks & Notes */}
                {selectedChallan.remarks && (
                  <div className="border border-slate-300 rounded p-2.5 text-[10.5px] space-y-1">
                    <div className="font-bold text-slate-900 uppercase text-[9.5px]">Terms &amp; Purpose Notes:</div>
                    <div className="text-slate-700 whitespace-pre-line leading-relaxed">
                      {selectedChallan.remarks}
                    </div>
                  </div>
                )}

                {/* Rule 55 Statutory Declaration */}
                <div className="text-[10px] text-slate-700 leading-snug border-l-2 border-blue-600 pl-2 py-0.5">
                  <span className="font-bold text-slate-900">Statutory Declaration: </span>
                  We hereby certify that the goods described above are being transported strictly for the purpose stated herein under Rule 55 of the CGST Rules, 2017. <strong className="text-slate-950">THIS IS NOT A SALES INVOICE.</strong> No sale is effected through this Delivery Challan.
                </div>

                {/* Dual Signatures & Receiver Acknowledgment Box */}
                <div className="grid grid-cols-2 gap-4 pt-3">
                  
                  {/* Left: Receiver's Acknowledgment Box */}
                  <div className="border-2 border-dashed border-slate-400 rounded-lg p-3 space-y-3 bg-slate-50/30">
                    <div className="text-[10.5px] font-black uppercase text-slate-900 tracking-wider">
                      CONSIGNEE / RECEIVER'S ACKNOWLEDGMENT
                    </div>
                    <p className="text-[9.5px] text-slate-600 leading-tight">
                      Received the above mentioned goods &amp; machinery in sound condition and verified full quantity as described.
                    </p>
                    <div className="space-y-1 text-[10px] text-slate-800">
                      <div>Receiver's Name: ____________________________</div>
                      <div>Date &amp; Time: _________________________________</div>
                    </div>
                    <div className="h-10 flex items-end">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Signature &amp; Receiver's Rubber Stamp
                      </span>
                    </div>
                  </div>

                  {/* Right: For KITS Robotics & Automation Pvt. Ltd. */}
                  <div className="border border-slate-300 rounded-lg p-3 flex flex-col justify-between text-right">
                    <div>
                      <div className="text-[10px] font-bold text-slate-600 uppercase">For Consignor</div>
                      <div className="text-xs font-black text-slate-950">
                        {companySettings?.name || 'KITS Robotics & Automation Pvt.Ltd'}
                      </div>
                    </div>

                    <div className="space-y-1 pt-8">
                      <div className="text-[10px] font-bold text-slate-900 uppercase">
                        Authorized Signatory / Dispatch Officer
                      </div>
                      <div className="text-[9px] text-slate-500">Subject to Akola Jurisdiction</div>
                    </div>
                  </div>

                </div>

              </div>

              {/* Official KITS Footer */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={false} />

            </div>
          </div>

        </div>
      )}

    </div>
  );
}

export default React.memo(DeliveryChallanManager);