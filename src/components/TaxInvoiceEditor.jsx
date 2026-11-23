import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Download, 
  Building2, 
  Receipt, 
  FileText, 
  ShieldCheck,
  ChevronDown,
  Eye
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { numberToIndianWords } from '../utils/numberToWords';
import { generateNextTaxInvoiceNumber } from '../services/db';
import { 
  getStateFromGstin, 
  isIntraStateSupply 
} from '../utils/gstHelper';

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function TaxInvoiceEditor({
  clients = [],
  quotations = [],
  companySettings = {},
  initialSource = null,
  onSave,
  onCancel,
  onView,
  onViewQuotation
}) {
  const handleViewDoc = onViewQuotation || onView;

  // Single pass derivation of proforma options and tax invoices
  const { proformaOptions, taxInvoices } = useMemo(() => {
    const po = [];
    const ti = [];
    const list = quotations || [];
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (q.isTaxInvoice || q.documentType === 'Tax Invoice') {
        ti.push(q);
      } else if (q.isProforma || q.documentType === 'Proforma Invoice' || (q.quotationNumber && q.quotationNumber.startsWith('PI-'))) {
        po.push(q);
      }
    }
    return { proformaOptions: po, taxInvoices: ti };
  }, [quotations]);

  // Initial State derived from source (proforma / existing tax invoice) or blank
  const [formData, setFormData] = useState(() => {
    const todayStr = getTodayString();
    if (initialSource) {
      const isExistingTaxInvoice = initialSource.isTaxInvoice || initialSource.documentType === 'Tax Invoice';
      const defaultTaxInvNo = isExistingTaxInvoice 
        ? (initialSource.quotationNumber || initialSource.invoiceNo)
        : generateNextTaxInvoiceNumber(taxInvoices);

      const detectedCategory = initialSource.category || (
        initialSource.categoryName?.includes('SOFTWARE') ? 'Software' :
        initialSource.categoryName?.includes('PRODUCT') ? 'Product' :
        (Array.isArray(initialSource.items) && initialSource.items.some(it => {
          const code = String(it.hsnCode || it.hsn || '');
          return code.startsWith('9983') || code.startsWith('9973');
        }) ? 'Software' : 'Automation Work')
      );
      const isSw = detectedCategory === 'Software';

      const items = Array.isArray(initialSource.items) && initialSource.items.length > 0
        ? initialSource.items.map(it => ({
            id: it.id || 'item-' + Math.random(),
            name: it.title || it.name || '',
            description: it.description || '',
            hsnCode: isSw ? '' : (it.hsnCode || it.hsn || ''),
            unit: isSw ? '' : (it.unit || 'Nos'),
            qty: it.qty || 1,
            rate: it.unitPrice || it.rate || 0,
            discount: it.discountPercent || it.discount || 0,
            gst: it.gstRate !== undefined ? it.gstRate : 18,
            amount: it.taxableAmount || (it.qty * (it.unitPrice || it.rate || 0)) || 0
          }))
        : [];

      return {
        id: isExistingTaxInvoice ? initialSource.id : '',
        category: detectedCategory,
        applyTax: initialSource.applyTax !== undefined ? initialSource.applyTax : (initialSource.hasTax !== undefined ? initialSource.hasTax : !isSw),
        invoiceNo: defaultTaxInvNo,
        linkedProformaId: isExistingTaxInvoice ? (initialSource.linkedProformaId || '') : initialSource.id,
        linkedProformaNumber: isExistingTaxInvoice ? (initialSource.linkedProformaNumber || '') : (initialSource.quotationNumber || initialSource.invoiceNo || ''),
        linkedQuotationId: initialSource.linkedQuotationId || '',
        linkedQuotationNumber: initialSource.linkedQuotationNumber || '',
        date: initialSource.invoiceDate || initialSource.date || todayStr,
        dispatchDate: initialSource.dispatchDate || todayStr,
        customerPoNo: initialSource.customerPoNo || '',
        customerPoDate: initialSource.customerPoDate || '',
        customerId: initialSource.clientId || '',
        customerName: initialSource.clientName || '',
        billingAddress: initialSource.billingAddress || '',
        customerGstin: initialSource.clientGstin || '',
        clientState: initialSource.clientState || '',
        placeOfSupply: initialSource.placeOfSupply || '',
        shipToSameAsBillTo: initialSource.shipToSameAsBillTo !== undefined ? initialSource.shipToSameAsBillTo : true,
        shippingAddress: initialSource.shippingAddress || '',
        shippingGstin: initialSource.shippingGstin || '',
        
        // Logistics & E-Way Bill Details
        ewayBillNo: isSw ? '' : (initialSource.ewayBillNo || ''),
        vehicleNo: isSw ? '' : (initialSource.vehicleNo || ''),
        transporterName: isSw ? 'Not Applicable (Electronic / Remote)' : (initialSource.transporterName || ''),
        lrNo: isSw ? '' : (initialSource.lrNo || ''),
        lrDate: initialSource.lrDate || todayStr,
        modeOfTransport: isSw ? 'Electronic / Remote Delivery' : (initialSource.modeOfTransport || 'By Road'),

        // Advance Settlement
        advancePaid: initialSource.advancePaid || initialSource.advancePayable || 0,
        advanceUtr: initialSource.advanceUtr || '',
        advanceDate: initialSource.advanceDate || '',

        // Notes & Terms
        terms: initialSource.terms || (isSw 
          ? '1. Software license, digital deployment and source credentials released upon payment clearance.\n2. 3–6 months bug fixing and technical support included from go-live date.\n3. All disputes subject to Akola (Maharashtra) Jurisdiction only.\n4. Certified that the particulars given above are true and correct.'
          : '1. Goods once sold will not be taken back or exchanged.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond agreed terms.\n3. All disputes subject to Akola (Maharashtra) Jurisdiction only.\n4. Certified that the particulars given above are true and correct.'),
        warrantyTerms: initialSource.warrantyTerms || (isSw ? '3–6 months bug fixes & technical support from go-live.' : '12 months from commissioning or 13 months from date of invoice'),
        items
      };
    }

    return {
      id: '',
      category: 'Automation Work',
      applyTax: true,
      invoiceNo: generateNextTaxInvoiceNumber(taxInvoices),
      linkedProformaId: '',
      linkedProformaNumber: '',
      linkedQuotationId: '',
      linkedQuotationNumber: '',
      date: todayStr,
      dispatchDate: todayStr,
      customerPoNo: '',
      customerPoDate: '',
      customerId: '',
      customerName: '',
      billingAddress: '',
      customerGstin: '',
      clientState: '',
      placeOfSupply: '',
      shipToSameAsBillTo: true,
      shippingAddress: '',
      shippingGstin: '',
      ewayBillNo: '',
      vehicleNo: '',
      transporterName: '',
      lrNo: '',
      lrDate: todayStr,
      modeOfTransport: 'By Road',
      advancePaid: 0,
      advanceUtr: '',
      advanceDate: '',
      terms: '1. Goods once sold will not be taken back or exchanged.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond agreed terms.\n3. All disputes subject to Akola (Maharashtra) Jurisdiction only.\n4. Certified that the particulars given above are true and correct.',
      warrantyTerms: '12 months from commissioning or 13 months from date of invoice',
      items: []
    };
  });

  const selectedProforma = useMemo(() => {
    return proformaOptions.find(p => p.id === formData.linkedProformaId || (p.quotationNumber || p.invoiceNo) === formData.linkedProformaNumber) || null;
  }, [proformaOptions, formData.linkedProformaId, formData.linkedProformaNumber]);

  // Handle auto-population when selecting an existing Proforma
  const handleSelectProforma = (proformaId) => {
    if (!proformaId) {
      setFormData(prev => ({
        ...prev,
        linkedProformaId: '',
        linkedProformaNumber: '',
        linkedQuotationId: '',
        linkedQuotationNumber: ''
      }));
      return;
    }

    const selected = proformaOptions.find(p => p.id === proformaId || (p.quotationNumber || p.invoiceNo) === proformaId);
    if (!selected) return;

    const detectedCategory = selected.category || (
      selected.categoryName?.includes('SOFTWARE') ? 'Software' :
      selected.categoryName?.includes('PRODUCT') ? 'Product' :
      (Array.isArray(selected.items) && selected.items.some(it => {
        const code = String(it.hsnCode || it.hsn || '');
        return code.startsWith('9983') || code.startsWith('9973');
      }) ? 'Software' : 'Automation Work')
    );
    const isSw = detectedCategory === 'Software';

    const items = Array.isArray(selected.items) && selected.items.length > 0
      ? selected.items.map(it => ({
          id: it.id || 'item-' + Math.random(),
          name: it.title || it.name || '',
          description: it.description || '',
          hsnCode: isSw ? '' : (it.hsnCode || it.hsn || ''),
          unit: isSw ? '' : (it.unit || 'Nos'),
          qty: it.qty || 1,
          rate: it.unitPrice || it.rate || 0,
          discount: it.discountPercent || it.discount || 0,
          gst: it.gstRate !== undefined ? it.gstRate : 18,
          amount: it.taxableAmount || (it.qty * (it.unitPrice || it.rate || 0)) || 0
        }))
      : [];

    setFormData(prev => ({
      ...prev,
      category: detectedCategory,
      modeOfTransport: isSw ? 'Electronic / Remote Delivery' : (prev.modeOfTransport?.includes('Electronic') ? 'By Road' : prev.modeOfTransport),
      transporterName: isSw ? 'Not Applicable (Electronic / Remote)' : prev.transporterName,
      linkedProformaId: selected.id,
      linkedProformaNumber: selected.quotationNumber || selected.invoiceNo || '',
      linkedQuotationId: selected.linkedQuotationId || '',
      linkedQuotationNumber: selected.linkedQuotationNumber || '',
      customerPoNo: selected.customerPoNo || prev.customerPoNo,
      customerPoDate: selected.customerPoDate || prev.customerPoDate,
      customerId: selected.clientId || prev.customerId,
      customerName: selected.clientName || prev.customerName,
      billingAddress: selected.billingAddress || prev.billingAddress,
      customerGstin: selected.clientGstin || prev.customerGstin,
      clientState: selected.clientState || prev.clientState,
      placeOfSupply: selected.placeOfSupply || prev.placeOfSupply,
      shipToSameAsBillTo: selected.shipToSameAsBillTo !== undefined ? selected.shipToSameAsBillTo : prev.shipToSameAsBillTo,
      shippingAddress: selected.shippingAddress || prev.shippingAddress,
      shippingGstin: selected.shippingGstin || prev.shippingGstin,
      advancePaid: selected.advancePayable || selected.advancePaid || 0,
      advanceUtr: selected.advanceUtr || prev.advanceUtr || '',
      advanceDate: selected.advanceDate || prev.advanceDate || '',
      items
    }));
  };

  const isSoftware = formData.category === 'Software' || 
    formData.categoryName?.includes('SOFTWARE') ||
    (Array.isArray(formData.items) && formData.items.some(it => {
      const code = String(it.hsnCode || it.hsn || '');
      return code.startsWith('9983') || code.startsWith('9973');
    }));

  const handleCategoryChange = (newCat) => {
    const isSw = newCat === 'Software';
    setFormData(prev => ({
      ...prev,
      category: newCat,
      applyTax: isSw ? false : true,
      modeOfTransport: isSw ? 'Electronic / Remote Delivery' : (prev.modeOfTransport?.includes('Electronic') ? 'By Road' : prev.modeOfTransport),
      transporterName: isSw ? 'Not Applicable (Electronic / Remote)' : (prev.transporterName?.includes('Electronic') ? '' : prev.transporterName),
      terms: isSw && (!prev.terms || prev.terms.includes('Goods once sold'))
        ? '1. Software license, digital deployment and source credentials released upon payment clearance.\n2. 3–6 months bug fixing and technical support included from go-live date.\n3. All disputes subject to Akola (Maharashtra) Jurisdiction only.\n4. Certified that the particulars given above are true and correct.'
        : (!isSw && prev.terms?.includes('Software license') 
            ? '1. Goods once sold will not be taken back or exchanged.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond agreed terms.\n3. All disputes subject to Akola (Maharashtra) Jurisdiction only.\n4. Certified that the particulars given above are true and correct.'
            : prev.terms),
      warrantyTerms: isSw && (!prev.warrantyTerms || prev.warrantyTerms.includes('commissioning'))
        ? '3–6 months bug fixes & technical support from go-live.'
        : (!isSw && prev.warrantyTerms?.includes('bug fixes') ? '12 months from commissioning or 13 months from date of invoice' : prev.warrantyTerms),
      items: isSw
        ? prev.items.map(it => ({ ...it, hsnCode: '', unit: '' }))
        : prev.items.map(it => ({ ...it, unit: it.unit || 'Nos' }))
    }));
  };

  // Handle client selection with auto state & place of supply
  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const gstin = client.gstin || '';
      const stateObj = gstin ? getStateFromGstin(gstin) : null;
      setFormData(prev => ({
        ...prev,
        customerId: client.id,
        customerName: client.companyName,
        billingAddress: `${client.address || ''}${client.city ? '\n' + client.city : ''}${client.state ? ', ' + client.state : ''}${client.pincode ? ' - ' + client.pincode : ''}`.trim(),
        customerGstin: gstin,
        clientState: client.state || (stateObj ? stateObj.state : ''),
        placeOfSupply: client.state || (stateObj ? stateObj.state : prev.placeOfSupply)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        customerId: '',
        customerName: '',
        billingAddress: '',
        customerGstin: '',
        clientState: '',
        placeOfSupply: ''
      }));
    }
  };

  // Financial & Tax Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    const applyTax = formData.applyTax !== undefined ? Boolean(formData.applyTax) : !isSoftware;

    const isIntraState = isIntraStateSupply(
      formData.clientState || formData.customerGstin, 
      companySettings?.state || companySettings?.gstin || 'Maharashtra'
    );

    formData.items.forEach(it => {
      const qty = parseFloat(it.qty) || 0;
      const rate = parseFloat(it.rate) || 0;
      const discount = parseFloat(it.discount) || 0;
      const base = qty * rate;
      const discountAmt = (base * discount) / 100;
      const taxable = Math.max(0, base - discountAmt);
      
      subtotal += taxable;

      if (applyTax) {
        const gstRate = parseFloat(it.gst) || 0;
        if (isIntraState) {
          cgstTotal += (taxable * (gstRate / 2)) / 100;
          sgstTotal += (taxable * (gstRate / 2)) / 100;
        } else {
          igstTotal += (taxable * gstRate) / 100;
        }
      }
    });

    const totalTax = applyTax ? (cgstTotal + sgstTotal + igstTotal) : 0;
    const grossTotal = Math.round(subtotal + totalTax);
    const advancePaid = Math.max(0, parseFloat(formData.advancePaid) || 0);
    const balanceDue = Math.max(0, grossTotal - advancePaid);

    return {
      applyTax,
      subtotal: Math.round(subtotal),
      cgstTotal: Math.round(cgstTotal),
      sgstTotal: Math.round(sgstTotal),
      igstTotal: Math.round(igstTotal),
      totalTax: Math.round(totalTax),
      grossTotal,
      advancePaid,
      balanceDue,
      isIntraState
    };
  }, [formData.items, formData.applyTax, isSoftware, formData.customerGstin, formData.clientState, formData.advancePaid, companySettings?.state, companySettings?.gstin]);

  // Item Handlers
  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: 'item-' + Date.now(),
          name: '',
          description: '',
          hsnCode: '',
          unit: isSoftware ? '' : 'Nos',
          qty: 1,
          rate: '',
          discount: '',
          gst: 18,
          amount: 0
        }
      ]
    }));
  };

  const handleUpdateItem = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };

      if (field === 'qty' || field === 'rate' || field === 'discount') {
        const qty = field === 'qty' ? parseFloat(value) || 0 : parseFloat(newItems[index].qty) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(newItems[index].rate) || 0;
        const disc = field === 'discount' ? parseFloat(value) || 0 : parseFloat(newItems[index].discount) || 0;
        const base = qty * rate;
        const discAmt = (base * disc) / 100;
        newItems[index].amount = Math.max(0, Math.round(base - discAmt));
      }

      return { ...prev, items: newItems };
    });
  };

  const handleDeleteItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Save / Submit Tax Invoice
  const handleSave = (andView = false) => {
    if (!formData.customerName.trim()) {
      alert('Please enter or select a customer name.');
      return;
    }
    if (formData.items.length === 0) {
      alert('Please add at least one line item to the Final Invoice.');
      return;
    }

    const payload = {
      id: formData.id || 'taxinv-' + Date.now(),
      isTaxInvoice: true,
      isProforma: false,
      category: formData.category || (isSoftware ? 'Software' : 'Automation Work'),
      categoryName: isSoftware ? 'SOFTWARE DEVELOPMENT' : (formData.category === 'Product' ? 'PRODUCT SUPPLY' : 'AUTOMATION WORK'),
      quotationNumber: formData.invoiceNo,
      invoiceNo: formData.invoiceNo,
      date: formData.date,
      dispatchDate: formData.dispatchDate,
      linkedProformaId: formData.linkedProformaId,
      linkedProformaNumber: formData.linkedProformaNumber,
      linkedQuotationId: formData.linkedQuotationId,
      linkedQuotationNumber: formData.linkedQuotationNumber,
      customerPoNo: formData.customerPoNo,
      customerPoDate: formData.customerPoDate,
      clientId: formData.customerId,
      clientName: formData.customerName,
      billingAddress: formData.billingAddress,
      clientGstin: formData.customerGstin,
      clientState: formData.clientState,
      placeOfSupply: formData.placeOfSupply,
      shipToSameAsBillTo: formData.shipToSameAsBillTo,
      shippingAddress: formData.shipToSameAsBillTo ? formData.billingAddress : formData.shippingAddress,
      shippingGstin: formData.shippingGstin,
      
      // Transport Logistics
      ewayBillNo: formData.ewayBillNo,
      vehicleNo: formData.vehicleNo,
      transporterName: formData.transporterName,
      lrNo: formData.lrNo,
      lrDate: formData.lrDate,
      modeOfTransport: formData.modeOfTransport,

      // Advance Settlement
      advancePaid: calculations.advancePaid,
      advanceUtr: formData.advanceUtr,
      advanceDate: formData.advanceDate,
      balanceDue: calculations.balanceDue,

      // Financials
      applyTax: calculations.applyTax,
      hasTax: calculations.applyTax,
      documentType: calculations.applyTax ? 'Tax Invoice' : 'Invoice',
      subtotal: calculations.subtotal,
      cgst: calculations.cgstTotal,
      sgst: calculations.sgstTotal,
      igst: calculations.igstTotal,
      totalTax: calculations.totalTax,
      grandTotal: calculations.grossTotal,
      isIntraState: calculations.isIntraState,
      amountInWords: numberToIndianWords(calculations.grossTotal),
      balanceInWords: numberToIndianWords(calculations.balanceDue),

      // Terms
      terms: formData.terms,
      warrantyTerms: formData.warrantyTerms,
      status: 'Tax Invoice Issued',
      items: formData.items.map(it => ({
        id: it.id,
        title: it.name,
        name: it.name,
        description: it.description,
        hsnCode: isSoftware ? '' : it.hsnCode,
        hsn: isSoftware ? '' : it.hsnCode,
        unit: isSoftware ? '' : (it.unit || 'Nos'),
        qty: parseFloat(it.qty) || 1,
        unitPrice: parseFloat(it.rate) || 0,
        rate: parseFloat(it.rate) || 0,
        discountPercent: parseFloat(it.discount) || 0,
        taxableAmount: it.amount,
        gstRate: parseFloat(it.gst) || 18
      }))
    };

    if (onSave) {
      onSave(payload, andView);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Banner Navigation */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Back to Invoices"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-slate-900 text-base sm:text-lg">
                Final Invoice Process
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold font-mono">
                Final Invoice
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Issue official Final Invoice with E-Way Bill, transport logistics, and advance payment deduction.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Main Form Inputs */}
        <div className="lg:col-span-2 space-y-6">

          {/* Section 1: Final Invoice & Order Coordinates */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                1. Final Invoice & Order Identifiers
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Category *
                </label>
                <div className="relative">
                  <select
                    value={formData.category || 'Automation Work'}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer appearance-none"
                  >
                    <option value="Automation Work">Automation Work</option>
                    <option value="Product">Product</option>
                    <option value="Software">Software</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Final Invoice Number *
                </label>
                <input
                  type="text"
                  value={formData.invoiceNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Invoice Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  {isSoftware ? 'Deployment / Live Date' : 'Dispatch / Removal Date'}
                </label>
                <input
                  type="date"
                  value={formData.dispatchDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dispatchDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Linked Proforma Ref
                  </label>
                  {selectedProforma && handleViewDoc && (
                    <button
                      type="button"
                      onClick={() => handleViewDoc(selectedProforma)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1 cursor-pointer hover:underline"
                      title="Open and check this linked Proforma Invoice"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Check Proforma</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <select
                    value={formData.linkedProformaId || (proformaOptions.find(p => (p.quotationNumber || p.invoiceNo) === formData.linkedProformaNumber)?.id || '')}
                    onChange={(e) => handleSelectProforma(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">-- None (Standalone Final Invoice) --</option>
                    {proformaOptions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.quotationNumber || p.invoiceNo} • {p.clientName || 'Customer'}
                      </option>
                    ))}
                    {formData.linkedProformaNumber && !proformaOptions.some(p => p.id === formData.linkedProformaId || (p.quotationNumber || p.invoiceNo) === formData.linkedProformaNumber) && (
                      <option value={formData.linkedProformaId || 'custom'}>
                        {formData.linkedProformaNumber} (Linked)
                      </option>
                    )}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Customer PO Number
                </label>
                <input
                  type="text"
                  value={formData.customerPoNo}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPoNo: e.target.value }))}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Customer PO Date
                </label>
                <input
                  type="date"
                  value={formData.customerPoDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerPoDate: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Customer (Buyer) & Shipping (Consignee) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                2. Billed To (Buyer) & Place of Supply
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">
                    Customer / Company Name *
                  </label>
                  {clients.length > 0 && (
                    <select
                      value={formData.customerId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-blue-700 font-bold outline-none cursor-pointer"
                    >
                      <option value="">Load Saved Client...</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.companyName}</option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Enter buyer company name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Customer GSTIN
                </label>
                <input
                  type="text"
                  value={formData.customerGstin}
                  onChange={(e) => {
                    const gstin = e.target.value.toUpperCase();
                    const stateObj = gstin ? getStateFromGstin(gstin) : null;
                    setFormData(prev => ({
                      ...prev,
                      customerGstin: gstin,
                      clientState: stateObj ? stateObj.state : prev.clientState,
                      placeOfSupply: stateObj ? stateObj.state : prev.placeOfSupply
                    }));
                  }}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Billing Address
                </label>
                <textarea
                  rows={3}
                  value={formData.billingAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, billingAddress: e.target.value }))}
                  placeholder="Full registered address of the buyer"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                    Place of Supply (State / Code)
                  </label>
                  <input
                    type="text"
                    value={formData.placeOfSupply}
                    onChange={(e) => setFormData(prev => ({ ...prev, placeOfSupply: e.target.value }))}
                    placeholder=""
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.shipToSameAsBillTo}
                      onChange={(e) => setFormData(prev => ({ ...prev, shipToSameAsBillTo: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Shipped To (Consignee) same as Billing Address
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {!formData.shipToSameAsBillTo && (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Consignee / Shipping Address (Plant Site)
                </label>
                <textarea
                  rows={2}
                  value={formData.shippingAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, shippingAddress: e.target.value }))}
                  placeholder="Enter plant delivery site address"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}
          </div>

          {/* Section 3: Line Items Table (Textboxes only, clean inputs) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                  {isSoftware ? '3. Software Solutions & IT Services' : '3. Machinery, Spares & Automation Services'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {formData.items.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-xs text-slate-500 font-semibold mb-2">
                  {isSoftware ? 'No software service items added yet.' : 'No items added to this Final Invoice yet.'}
                </p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  + Add First Line Item
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {formData.items.map((item, idx) => (
                  <div key={item.id || idx} className="p-3.5 bg-slate-50/70 border border-slate-200/90 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        Item #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className={isSoftware ? 'w-full' : 'grid grid-cols-1 sm:grid-cols-4 gap-3'}>
                      <div className={isSoftware ? 'w-full' : 'sm:col-span-3'}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {isSoftware ? 'Software Solution / Service Description *' : 'Machinery / Service Description *'}
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          placeholder={isSoftware ? 'e.g. Custom Web Application / Cloud Portal / Mobile App' : 'e.g. Robotic Welding Cell / Turnkey PLC Panel'}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none hover:border-slate-300 transition-colors"
                        />
                      </div>

                      {!isSoftware && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            HSN / SAC Code
                          </label>
                          <input
                            type="text"
                            value={item.hsnCode}
                            onChange={(e) => handleUpdateItem(idx, 'hsnCode', e.target.value)}
                            placeholder="e.g. 8479"
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-mono font-medium text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none hover:border-slate-300 transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    {/* Numeric textboxes without up/down stepper arrows */}
                    <div className={`grid grid-cols-2 ${isSoftware ? 'sm:grid-cols-5' : 'sm:grid-cols-6'} gap-3`}>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Qty
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.qty}
                          onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none hover:border-slate-300 transition-colors"
                        />
                      </div>

                      {!isSoftware && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={item.unit}
                            onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                            placeholder="Job / Nos / Set / License"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none hover:border-slate-300 transition-colors"
                          />
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Rate (₹)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.rate === 0 || item.rate === '0' ? '' : (item.rate ?? '')}
                          onChange={(e) => handleUpdateItem(idx, 'rate', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-mono font-bold text-slate-900 placeholder:text-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none hover:border-slate-300 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Disc %
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={item.discount === 0 || item.discount === '0' ? '' : (item.discount ?? '')}
                          onChange={(e) => handleUpdateItem(idx, 'discount', e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 placeholder:text-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 outline-none hover:border-slate-300 transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Taxable (₹)
                        </label>
                        <div className="w-full px-2.5 py-1.5 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-900 text-right">
                          {formatCurrency(item.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Financial Summary, Advance Reconciliation & Actions */}
        <div className="space-y-6">

          {/* Financial Summary Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Receipt className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                Financial Summary
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Taxable Subtotal:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(calculations.subtotal)}</span>
              </div>

              {/* Tax Toggle Checkbox */}
              <div className="flex items-center justify-between py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <span className="text-[11px] font-bold text-slate-800 block">Apply 18% GST (Tax)</span>
                  <span className="text-[9.5px] text-slate-500">Uncheck to generate Non-Tax Invoice</span>
                </div>
                <input
                  type="checkbox"
                  checked={calculations.applyTax}
                  onChange={(e) => setFormData(prev => ({ ...prev, applyTax: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded cursor-pointer accent-blue-600"
                />
              </div>

              {calculations.applyTax && (
                calculations.isIntraState ? (
                  <>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>CGST (9%):</span>
                      <span className="font-mono font-medium text-slate-900">{formatCurrency(calculations.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>SGST (9%):</span>
                      <span className="font-mono font-medium text-slate-900">{formatCurrency(calculations.sgstTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>IGST (18% Inter-State):</span>
                    <span className="font-mono font-medium text-slate-900">{formatCurrency(calculations.igstTotal)}</span>
                  </div>
                )
              )}

              {/* Solid Blue Grand Total Box */}
              <div className="mt-2.5 px-3.5 py-2 bg-blue-600 rounded-xl text-white flex items-center justify-between shadow-xs">
                <div>
                  <span className="font-bold text-xs uppercase tracking-wide block">
                    {calculations.applyTax ? 'Total Final Invoice Value' : 'Total Invoice Value'}
                  </span>
                  <span className="text-[9px] text-blue-100 italic line-clamp-1">
                    {numberToIndianWords(calculations.grossTotal)}
                  </span>
                </div>
                <span className="font-extrabold text-base sm:text-lg font-mono">{formatCurrency(calculations.grossTotal)}</span>
              </div>

            </div>
          </div>

          {/* Advance Reconciliation & Settlement Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-bold text-slate-800 uppercase tracking-wide text-xs">
                Advance Reconciliation
              </h4>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
                Settlement
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Less: Advance Received (₹)
              </label>
              <input
                type="number"
                min="0"
                value={formData.advancePaid ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, advancePaid: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Payment UTR / Ref
                </label>
                <input
                  type="text"
                  value={formData.advanceUtr || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, advanceUtr: e.target.value }))}
                  placeholder="e.g. UTR / Chq No"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:bg-white outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                  Advance Date
                </label>
                <input
                  type="date"
                  value={formData.advanceDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, advanceDate: e.target.value }))}
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 text-xs block">Net Balance Due:</span>
                <span className="text-[10px] text-slate-400">Payable on dispatch</span>
              </div>
              <span className="font-mono font-black text-sm sm:text-base text-amber-600">
                {formatCurrency(calculations.balanceDue)}
              </span>
            </div>
          </div>

          {/* Statutory Akola Jurisdiction & Bank Coordinates Note */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] uppercase tracking-wide">Statutory Declarations</span>
            </div>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Subject to <strong className="text-slate-800">Akola (Maharashtra) Jurisdiction</strong> only. Issued under Section 31 of CGST Act, 2017.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-2">
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="w-full flex items-center justify-center space-x-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs active:scale-98 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save & View Final Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => handleSave(false)}
              className="w-full py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Save Draft Final Invoice
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 px-4 text-slate-500 hover:text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}

export default React.memo(TaxInvoiceEditor);
