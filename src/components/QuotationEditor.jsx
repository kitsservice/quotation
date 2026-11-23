import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ShieldAlert,
  Download,
  ChevronRight,
  ChevronUp,
  User,
  MapPin,
  Cpu,
  Package,
  Laptop
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { numberToIndianWords } from '../utils/numberToWords';
import { generateNextQuotationNumber } from '../services/db';
import { 
  getStateFromGstin, 
  isIntraStateSupply,
  HARDWARE_DEFAULT_EXCLUSIONS,
  SOFTWARE_DEFAULT_EXCLUSIONS,
  SOFTWARE_DEFAULT_TERMS,
  HARDWARE_DEFAULT_TERMS
} from '../utils/gstHelper';

const DEFAULT_EXCLUSIONS = HARDWARE_DEFAULT_EXCLUSIONS;

const QUOTATION_CATEGORIES = [
  {
    id: 'Automation Work',
    label: 'Automation Work',
    icon: Cpu,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Turnkey industrial automation, PLC panels, robotics & SPM projects',
    openingNote: 'With reference to our technical discussion, we are pleased to submit our commercial proposal for the supply of Automation Work.',
    sectionTitle: '1. AUTOMATION WORK',
    tableHeaderTitle: 'Sales Quotation For Automation Work',
    categoryName: 'AUTOMATION WORK'
  },
  {
    id: 'Product',
    label: 'Product',
    icon: Package,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Robotic machinery, industrial hardware, automation spares & parts',
    openingNote: 'With reference to your inquiry, we are pleased to submit our commercial proposal for the supply of Products & Industrial Machinery.',
    sectionTitle: '1. PRODUCT / MACHINERY',
    tableHeaderTitle: 'Sales Quotation For Product / Machinery',
    categoryName: 'PRODUCT / MACHINERY'
  },
  {
    id: 'Software',
    label: 'Software',
    icon: Laptop,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Software development, website development, web & mobile applications',
    openingNote: 'With reference to our technical discussion, we are pleased to submit our commercial proposal for the development and deployment of Software, Web & Application Solutions.',
    sectionTitle: '1. SOFTWARE DEVELOPMENT',
    tableHeaderTitle: 'Sales Quotation For Software Solutions',
    categoryName: 'SOFTWARE DEVELOPMENT'
  }
];

function QuotationEditor({
  quotation,
  existingQuotations = [],
  clients = [],
  products: _products = [],
  companySettings = {},
  onSave,
  onSaveClientQuick: _onSaveClientQuick,
  onCancel,
  onView
}) {
  // Initialize form state
  const [formData, setFormData] = useState(() => {
    if (quotation) {
      const detectedCategory = quotation.category || (
        quotation.categoryName?.includes('SOFTWARE') ? 'Software' :
        quotation.categoryName?.includes('PRODUCT') ? 'Product' : 'Automation Work'
      );
      const isSw = detectedCategory === 'Software';
      const cleanPhone = isSw
        ? ((companySettings?.phone || '9823042432').replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ').replace(/\s+/g, ' ').replace(/^[/\s,-]+|[/\s,-]+$/g, '').trim() || '9823042432')
        : (companySettings?.phone || '9823042432 / 9453536807');

      let initialFrom = quotation.fromText || `${companySettings?.name || 'KITS Robotics & Automation Pvt.Ltd'}, ${companySettings?.city || 'Akola'}\nMobile: ${cleanPhone}`;
      if (isSw && initialFrom.includes('9453536807')) {
        initialFrom = initialFrom
          .replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      return {
        ...quotation,
        fromText: initialFrom,
        subject: quotation.subject || '',
        salutation: quotation.salutation || 'Dear Sir / Madam,',
        openingNote: quotation.openingNote || (isSw 
          ? 'With reference to our technical discussion, we are pleased to submit our commercial proposal for the development and deployment of Software Solutions.'
          : 'With reference to our technical discussion, we are pleased to submit our commercial proposal for the supply of Automation Work.'),
        sectionTitle: quotation.sectionTitle || (isSw ? '1. SOFTWARE DEVELOPMENT' : '1. AUTOMATION WORK'),
        tableHeaderTitle: quotation.tableHeaderTitle || (isSw ? 'Sales Quotation For Software Solutions' : 'Sales Quotation For Automation Work'),
        category: detectedCategory,
        categoryName: quotation.categoryName || (isSw ? 'SOFTWARE DEVELOPMENT' : 'AUTOMATION WORK'),
        validityDays: quotation.validityDays || 30,
        deliveryTerms: quotation.deliveryTerms || (isSw ? 'Within 2–4 weeks from technical sign-off' : 'Within 1–2 weeks'),
        gstTerms: quotation.gstTerms || '18% Extra',
        freightTerms: quotation.freightTerms || (isSw ? 'Not Applicable (Electronic / Remote Delivery)' : 'As Actual'),
        paymentTerms: quotation.paymentTerms || (isSw ? SOFTWARE_DEFAULT_TERMS : HARDWARE_DEFAULT_TERMS),
        warrantyTerms: quotation.warrantyTerms || (isSw ? '3–6 months bug fixes & technical support from launch date.' : '12 months from the date of installation OR 13 months from the date of invoice.'),
        notesExclusions: quotation.notesExclusions || (isSw ? SOFTWARE_DEFAULT_EXCLUSIONS : DEFAULT_EXCLUSIONS),
        notes: quotation.notes || '',
        items: (quotation.items || []).map(it => ({
          ...it,
          hsn: it.hsn || it.hsnCode || '',
          unit: it.unit || ''
        })),
        clientState: quotation.clientState || '',
        status: quotation.status || 'Draft'
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const generatedRef = generateNextQuotationNumber(existingQuotations, companySettings?.quotationPrefix || 'KITS/AKL');

    return {
      id: '',
      quotationNumber: generatedRef,
      revision: 'Rev 0',
      date: todayStr,
      validityDays: 30,
      status: 'Draft',
      fromText: `${companySettings?.name || 'KITS Robotics & Automation Pvt.Ltd'}, ${companySettings?.city || 'Akola'}\nMobile: ${companySettings?.phone || '9823042432 / 9453536807'}`,
      clientId: '',
      clientName: '',
      contactPerson: '',
      clientEmail: '',
      clientPhone: '',
      clientGstin: '',
      clientState: '',
      billingAddress: '',
      shippingAddress: '',
      category: 'Automation Work',
      categoryName: 'AUTOMATION WORK',
      sectionTitle: '1. AUTOMATION WORK',
      tableHeaderTitle: 'Sales Quotation For Automation Work',
      subject: '',
      salutation: 'Dear Sir / Madam,',
      openingNote: 'With reference to our technical discussion, we are pleased to submit our commercial proposal for the supply of Automation Work.',
      items: [],
      deliveryTerms: 'Within 1–2 weeks',
      gstTerms: '18% Extra',
      freightTerms: 'As Actual',
      paymentTerms: HARDWARE_DEFAULT_TERMS,
      warrantyTerms: '12 months from the date of installation OR 13 months from the date of invoice.',
      notes: '',
      notesExclusions: DEFAULT_EXCLUSIONS,
      closingNote: 'We look forward to valued order.'
    };
  });

  const [showExclusions, setShowExclusions] = useState(false);

  // Handle client selection from existing directory (autofills the text boxes)
  const handleClientSelect = (clientId) => {
    if (!clientId) return;
    const selected = clients.find(c => c.id === clientId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        clientId: selected.id,
        clientName: selected.companyName || '',
        contactPerson: selected.contactPerson || '',
        clientEmail: selected.email || '',
        clientPhone: selected.phone || '',
        clientGstin: selected.gstin || '',
        clientState: selected.state || 'Maharashtra',
        billingAddress: selected.billingAddress || ''
      }));
    }
  };

  // Auto-detect state from GSTIN
  const handleGstinChange = (e) => {
    const raw = e.target.value.toUpperCase().trim();
    const detected = getStateFromGstin(raw);
    setFormData(prev => ({
      ...prev,
      clientGstin: raw,
      ...(detected ? { clientState: detected.state } : {})
    }));
  };

  // Switch category (Automation Work / Product / Software)
  const handleCategorySelect = (categoryId) => {
    const catConfig = QUOTATION_CATEGORIES.find(c => c.id === categoryId);
    if (!catConfig) return;

    const isSwitchingToSoftware = categoryId === 'Software';
    const wasSoftware = formData.category === 'Software';

    setFormData(prev => {
      const isDefaultOpening = !prev.openingNote || QUOTATION_CATEGORIES.some(c => c.openingNote === prev.openingNote);

      let updatedExclusions = prev.notesExclusions;
      let updatedDelivery = prev.deliveryTerms;
      let updatedWarranty = prev.warrantyTerms;
      let updatedFreight = prev.freightTerms;
      let updatedPayment = prev.paymentTerms;
      let updatedItems = prev.items;
      let updatedFromText = prev.fromText;

      if (isSwitchingToSoftware && !wasSoftware) {
        // Intelligently adapt to Software standards and clear physical goods HSN
        updatedItems = prev.items.map(it => ({ ...it, hsn: '' }));
        if (updatedFromText && updatedFromText.includes('9453536807')) {
          updatedFromText = updatedFromText
            .replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
        const matchesHardwareDefaults = !prev.notesExclusions?.length || 
          JSON.stringify(prev.notesExclusions) === JSON.stringify(HARDWARE_DEFAULT_EXCLUSIONS);
        if (matchesHardwareDefaults) {
          updatedExclusions = [...SOFTWARE_DEFAULT_EXCLUSIONS];
        }
        if (prev.deliveryTerms === 'Within 1–2 weeks') {
          updatedDelivery = 'Within 3–6 weeks from receipt of advance and content';
        }
        if (!prev.warrantyTerms || prev.warrantyTerms.includes('installation') || prev.warrantyTerms.includes('deployment date')) {
          updatedWarranty = '3–6 months complimentary bug fixes & technical support from go-live.';
        }
        if (!prev.freightTerms || prev.freightTerms === 'As Actual') {
          updatedFreight = 'Not Applicable (Electronic / Remote Delivery & Cloud Setup)';
        }
        if (!prev.paymentTerms || prev.paymentTerms === HARDWARE_DEFAULT_TERMS || prev.paymentTerms.includes('100% in advance') || prev.paymentTerms.includes('Payment within 15 days')) {
          updatedPayment = SOFTWARE_DEFAULT_TERMS;
        }
      } else if (!isSwitchingToSoftware && wasSoftware) {
        // Switching back to Hardware/Automation
        if (updatedFromText && !updatedFromText.includes('9453536807')) {
          updatedFromText = updatedFromText.replace(/9823042432(?!\s*[/,-]\s*9453536807)/g, '9823042432 / 9453536807');
        }
        const matchesSoftwareDefaults = !prev.notesExclusions?.length || 
          JSON.stringify(prev.notesExclusions) === JSON.stringify(SOFTWARE_DEFAULT_EXCLUSIONS);
        if (matchesSoftwareDefaults) {
          updatedExclusions = [...HARDWARE_DEFAULT_EXCLUSIONS];
        }
        if (prev.deliveryTerms?.includes('3–6 weeks') || prev.deliveryTerms?.includes('2–4 weeks')) {
          updatedDelivery = 'Within 1–2 weeks';
        }
        if (prev.warrantyTerms?.includes('bug fixes') || prev.warrantyTerms?.includes('go-live')) {
          updatedWarranty = '12 months from the date of installation OR 13 months from the date of invoice.';
        }
        if (prev.freightTerms?.includes('Electronic') || prev.freightTerms?.includes('Remote')) {
          updatedFreight = 'As Actual';
        }
        if (!prev.paymentTerms || prev.paymentTerms === SOFTWARE_DEFAULT_TERMS || prev.paymentTerms.includes('40% Advance')) {
          updatedPayment = HARDWARE_DEFAULT_TERMS;
        }
      }

      return {
        ...prev,
        fromText: updatedFromText,
        category: catConfig.id,
        categoryName: catConfig.categoryName,
        sectionTitle: catConfig.sectionTitle,
        tableHeaderTitle: catConfig.tableHeaderTitle,
        openingNote: isDefaultOpening ? catConfig.openingNote : prev.openingNote,
        deliveryTerms: updatedDelivery,
        warrantyTerms: updatedWarranty,
        freightTerms: updatedFreight,
        paymentTerms: updatedPayment,
        notesExclusions: updatedExclusions,
        items: updatedItems
      };
    });
  };

  // Add Item Row
  const handleAddItem = (preset = null) => {
    const rawUnitPrice = preset?.unitPrice !== undefined ? preset.unitPrice : '';
    const rawCostPrice = preset?.costPrice !== undefined ? preset.costPrice : '';
    const gstRate = preset?.gstRate !== undefined ? parseFloat(preset.gstRate) : 18;
    const defaultHsn = preset?.hsn || '';

    const newItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title: preset?.name || preset?.title || '',
      description: preset?.description || '',
      hsn: defaultHsn,
      qty: 1,
      unit: preset?.unit || 'Nos',
      unitPrice: (rawUnitPrice === 0 || rawUnitPrice === '0') ? '' : rawUnitPrice,
      costPrice: (rawCostPrice === 0 || rawCostPrice === '0') ? '' : rawCostPrice,
      discountPercent: '',
      taxableAmount: rawUnitPrice ? parseFloat(rawUnitPrice) : 0,
      gstRate
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Update Item Row
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      const item = { ...nextItems[index], [field]: value };

      const qty = parseFloat(item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const discountPercent = parseFloat(item.discountPercent) || 0;

      const baseAmount = qty * unitPrice;
      const discAmt = baseAmount * (discountPercent / 100);
      item.taxableAmount = Math.max(0, Math.round(baseAmount - discAmt));

      nextItems[index] = item;
      return { ...prev, items: nextItems };
    });
  };

  // Delete Item Row
  const handleDeleteItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Exclusion & Scope Points Handlers
  const handleAddExclusion = (text = '') => {
    setFormData(prev => ({
      ...prev,
      notesExclusions: [...(prev.notesExclusions || []), text]
    }));
  };

  const handleUpdateExclusion = (index, value) => {
    setFormData(prev => {
      const next = [...(prev.notesExclusions || [])];
      next[index] = value;
      return { ...prev, notesExclusions: next };
    });
  };

  const handleDeleteExclusion = (index) => {
    setFormData(prev => ({
      ...prev,
      notesExclusions: (prev.notesExclusions || []).filter((_, i) => i !== index)
    }));
  };

  const isSoftware = formData.category === 'Software' || formData.categoryName?.includes('SOFTWARE');

  const handleResetExclusions = () => {
    setFormData(prev => ({
      ...prev,
      notesExclusions: isSoftware ? [...SOFTWARE_DEFAULT_EXCLUSIONS] : [...HARDWARE_DEFAULT_EXCLUSIONS]
    }));
  };

  // Tax and Total Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalCost = 0;
    let totalGst = 0;

    formData.items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.unitPrice) || 0;
      const disc = parseFloat(item.discountPercent) || 0;
      const cost = parseFloat(item.costPrice) || 0;
      const gstRate = item.gstRate !== undefined ? parseFloat(item.gstRate) : 18;

      const base = qty * rate;
      const discAmt = base * (disc / 100);
      const taxableAmount = Math.max(0, base - discAmt);

      subtotal += base;
      totalDiscount += discAmt;
      totalCost += (cost * qty);
      totalGst += (taxableAmount * gstRate) / 100;
    });

    const taxable = Math.round(subtotal - totalDiscount);
    const isIntraState = isIntraStateSupply(
      formData.clientState || formData.clientGstin, 
      companySettings?.state || companySettings?.gstin || 'Maharashtra'
    );

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isIntraState) {
      cgst = Math.round(totalGst / 2);
      sgst = Math.round(totalGst / 2);
    } else {
      igst = Math.round(totalGst);
    }

    const grandTotal = taxable + (isIntraState ? (cgst + sgst) : igst);
    const totalProfit = taxable - totalCost;

    return {
      subtotal,
      totalDiscount,
      taxable,
      isIntraState,
      cgst,
      sgst,
      igst,
      totalGst: Math.round(totalGst),
      grandTotal,
      totalProfit
    };
  }, [formData.items, formData.clientState, formData.clientGstin, companySettings?.state, companySettings?.gstin]);

  // Submit Handler
  const handleSubmit = (andView = false) => {
    if (!formData.clientName.trim()) {
      alert('Please enter the Customer / Client Name in the Customer Details text box.');
      return;
    }

    const finalData = {
      ...formData,
      subtotal: calculations.subtotal,
      totalTaxable: calculations.taxable,
      isIntraState: calculations.isIntraState,
      cgstAmount: calculations.cgst,
      sgstAmount: calculations.sgst,
      igstAmount: calculations.igst,
      totalGst: calculations.totalGst,
      grandTotal: calculations.grandTotal,
      totalProfit: calculations.totalProfit,
      amountInWords: numberToIndianWords(calculations.grandTotal)
    };

    onSave(finalData);
    if (andView) {
      onView(finalData);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Back to Quotations List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {quotation ? 'Edit Quotation' : 'Create Quotation'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Prepare a professional proposal for your customer</p>
          </div>
        </div>
      </div>

      {/* Card 1: Customer Details with Direct Text Boxes */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>Customer Details</span>
          </h2>

          {/* Quick select from directory if clients exist */}
          {clients.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-400">Autofill from saved:</span>
              <select
                value={formData.clientId}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none"
              >
                <option value="">-- Choose Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 1: Quotation Category Dropdown, Customer Name Text Box, Optional Customer GSTIN Text Box, Validity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Quotation Category Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Quotation Category *
            </label>
            <div className="relative">
              <select
                value={formData.category || 'Automation Work'}
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer appearance-none"
              >
                <option value="Automation Work">Automation Work</option>
                <option value="Product">Product</option>
                <option value="Software">Software</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Customer Name Text Box */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Customer / Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              placeholder=""
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:font-normal"
            />
          </div>

          {/* Optional Customer GSTIN Text Box */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Customer GSTIN <span className="text-slate-400 font-normal">(Auto-detects State)</span>
            </label>
            <input
              type="text"
              value={formData.clientGstin}
              onChange={handleGstinChange}
              placeholder=""
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400"
            />
          </div>

          {/* Validity Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Offer Validity</label>
            <div className="relative">
              <select
                value={formData.validityDays}
                onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value, 10) || 30 })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value={15}>15 Days</option>
                <option value={30}>30 Days</option>
                <option value={45}>45 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

        </div>

        {/* Row 2: Customer Address / Plant Location Text Box & State */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center space-x-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Customer Address / Site Location</span>
            </label>
            <input
              type="text"
              value={formData.billingAddress}
              onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
              placeholder=""
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Supply State ({calculations.isIntraState ? 'Intra-State: CGST+SGST' : 'Inter-State: IGST'})
            </label>
            <input
              type="text"
              value={formData.clientState}
              onChange={(e) => setFormData({ ...formData, clientState: e.target.value })}
              placeholder=""
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Row 3: Quotation Reference No & Subject Line */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Quotation Reference No</label>
            <input
              type="text"
              value={formData.quotationNumber}
              onChange={(e) => setFormData({ ...formData, quotationNumber: e.target.value })}
              placeholder=""
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={formData.subject || ''}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder=""
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

      </div>

      {/* Card 2: Quotation Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Quotation Line Items
                </h2>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                  {formData.items.length} {formData.items.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isSoftware 
                  ? 'Configure custom software, website, mobile application & IT service line items' 
                  : 'Configure industrial equipment, automation solutions, robotics & service line items'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleAddItem()}
              className="h-8.5 inline-flex items-center space-x-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10.5px] border-b border-slate-200/80">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[280px]">Product / Service Description</th>
                {!isSoftware && (
                  <th className="py-3 px-2 w-28 text-center">HSN/SAC</th>
                )}
                <th className="py-3 px-2 w-20 text-center">Qty</th>
                <th className="py-3 px-2 w-28 text-right">Rate (₹)</th>
                <th className="py-3 px-2 w-18 text-center">Disc (%)</th>
                <th className="py-3 px-2 w-20 text-center">GST Rate</th>
                <th className="py-3 px-3 w-28 text-right">Taxable (₹)</th>
                <th className="py-3 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formData.items.length === 0 ? (
                <tr>
                  <td colSpan={isSoftware ? 8 : 9} className="py-12 text-center text-slate-400">
                    <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                      <Package className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-xs text-slate-700">No quotation items added yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Add equipment, machine integration, or engineering mandays</p>
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleAddItem()}
                        className="h-8 inline-flex items-center space-x-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Item</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                formData.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Index */}
                    <td className="py-3 px-3 text-center align-top pt-3.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold font-mono text-[11px] flex items-center justify-center mx-auto border border-slate-200/80">
                        {index + 1}
                      </span>
                    </td>
                    
                    {/* Title / Description */}
                    <td className="py-3 px-3 align-top">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                        placeholder="Product or service description *"
                        className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                      />
                    </td>

                    {/* HSN / SAC (only for non-Software quotes) */}
                    {!isSoftware && (
                      <td className="py-3 px-2 align-top">
                        <input
                          type="text"
                          value={item.hsn || ''}
                          onChange={(e) => handleItemChange(index, 'hsn', e.target.value)}
                          placeholder="e.g. 8479"
                          className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                        />
                      </td>
                    )}

                    {/* Qty */}
                    <td className="py-3 px-2 align-top">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.qty ?? ''}
                        onChange={(e) => handleItemChange(index, 'qty', e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-center text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                      />
                    </td>

                    {/* Rate */}
                    <td className="py-3 px-2 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.unitPrice === 0 || item.unitPrice === '0' ? '' : (item.unitPrice ?? '')}
                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0.00"
                        className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right text-slate-900 placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                      />
                    </td>

                    {/* Discount (%) */}
                    <td className="py-3 px-2 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.discountPercent === 0 || item.discountPercent === '0' ? '' : (item.discountPercent ?? '')}
                        onChange={(e) => handleItemChange(index, 'discountPercent', e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder="0"
                        className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                      />
                    </td>

                    {/* GST (%) Selector */}
                    <td className="py-3 px-2 align-top">
                      <select
                        value={item.gstRate !== undefined ? item.gstRate : 18}
                        onChange={(e) => handleItemChange(index, 'gstRate', parseFloat(e.target.value) || 0)}
                        className="w-full h-8 px-1.5 bg-slate-50/70 hover:bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>

                    {/* Taxable Amount (₹) */}
                    <td className="py-3 px-3 text-right align-top pt-3.5 whitespace-nowrap">
                      <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                        {formatCurrency(item.taxableAmount)}
                      </span>
                    </td>

                    {/* Trash Icon */}
                    <td className="py-3 px-2 text-center align-top pt-2.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(index)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove Line Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Card Footer: Add Item + Live Subtotal Preview */}
        {formData.items.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleAddItem()}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Add Another Line</span>
              </button>
            </div>

            <div className="flex items-center space-x-4 text-xs font-medium text-slate-600">
              <div>
                <span>Total Qty: </span>
                <span className="font-mono font-bold text-slate-900">
                  {formData.items.reduce((sum, it) => sum + (parseFloat(it.qty) || 0), 0)}
                </span>
              </div>
              <div className="h-3.5 w-px bg-slate-300" />
              <div>
                <span>Taxable Total: </span>
                <span className="font-mono font-black text-slate-900 text-sm">
                  {formatCurrency(calculations.taxable)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Terms & Notes (Left) + Tax Summary (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Terms & Conditions + Notes + Technical Exclusions */}
        <div className="space-y-4">
          
          {/* Terms & Conditions Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {isSoftware ? 'Software / IT Terms & Conditions' : 'Terms & Conditions'}
              </h2>
              <button
                type="button"
                onClick={() => setFormData(prev => ({
                  ...prev,
                  paymentTerms: isSoftware ? SOFTWARE_DEFAULT_TERMS : HARDWARE_DEFAULT_TERMS
                }))}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold hover:underline cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
            <textarea
              rows={isSoftware ? 9 : 4}
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              placeholder={isSoftware ? SOFTWARE_DEFAULT_TERMS : HARDWARE_DEFAULT_TERMS}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium leading-relaxed focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Notes (Optional) Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Notes (Optional)</h2>
            <textarea
              rows="2"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter any additional notes..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Page 2: Technical Exclusions Accordion */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExclusions(!showExclusions)}
              className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">
                  Page 2: Standard Exclusions & Client Scope ({formData.notesExclusions?.length || 0} points)
                </span>
              </div>
              {showExclusions ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>

            {showExclusions && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <p>
                    These technical clauses will be printed on Page 2 of the official proposal.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetExclusions}
                    className="text-[11px] text-purple-600 hover:text-purple-700 font-semibold hover:underline shrink-0 ml-2"
                  >
                    Reset to Default
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(formData.notesExclusions || []).map((ex, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs group focus-within:border-purple-400 focus-within:ring-1 focus-within:ring-purple-100 transition-all"
                    >
                      <span className="font-bold text-slate-400 text-xs w-5 text-center shrink-0">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={ex}
                        onChange={(e) => handleUpdateExclusion(idx, e.target.value)}
                        placeholder="Enter scope, exclusion, or site readiness clause..."
                        className="flex-1 text-xs text-slate-800 bg-transparent outline-none leading-relaxed font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteExclusion(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors opacity-70 group-hover:opacity-100 shrink-0"
                        title="Remove point"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleAddExclusion('')}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add More</span>
                  </button>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {formData.notesExclusions?.length || 0} total points
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Tax Summary Card */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Tax Summary</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                calculations.isIntraState ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}>
                {calculations.isIntraState ? 'Intra-State Supply (CGST + SGST)' : 'Inter-State Supply (IGST)'}
              </span>
            </div>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(calculations.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Discount</span>
                <span className="font-mono text-emerald-600 font-bold">
                  {calculations.totalDiscount > 0 ? `-${formatCurrency(calculations.totalDiscount)}` : '₹0'}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Taxable Amount</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(calculations.taxable)}</span>
              </div>

              {calculations.isIntraState ? (
                <>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>CGST</span>
                    <span className="font-mono text-slate-800">{formatCurrency(calculations.cgst)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>SGST</span>
                    <span className="font-mono text-slate-800">{formatCurrency(calculations.sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between text-slate-600">
                  <span>IGST (Inter-State)</span>
                  <span className="font-mono text-slate-800">{formatCurrency(calculations.igst)}</span>
                </div>
              )}

              {/* Solid Vibrant Blue Grand Total Banner */}
              <div className="mt-2.5 px-3.5 py-2 bg-blue-600 rounded-xl text-white flex items-center justify-between shadow-xs">
                <span className="font-bold text-xs uppercase tracking-wide">Grand Total</span>
                <span className="font-extrabold text-base sm:text-lg font-mono">{formatCurrency(calculations.grandTotal)}</span>
              </div>

              <div className="text-[10px] text-slate-500 pt-0.5 text-right">
                Amount in words: <span className="font-bold text-slate-700 italic">{numberToIndianWords(calculations.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Directly Under the Grand Total Card */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="w-full flex-1 flex items-center justify-center space-x-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Preview & Download</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

export default React.memo(QuotationEditor);
