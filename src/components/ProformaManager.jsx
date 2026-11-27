import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Eye, 
  Edit3, 
  Download, 
  Share2, 
  Link2, 
  Building2, 
  Truck, 
  ShieldCheck, 
  FileText, 
  Receipt, 
  Search, 
  Clock,
  FileCheck2,
  ArrowLeft 
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import { numberToIndianWords } from '../utils/numberToWords';
import { generateNextProformaNumber } from '../services/db';
import { 
  getStateFromGstin, 
  isIntraStateSupply, 
  COMMON_HSN_CODES 
} from '../utils/gstHelper';
import TaxInvoiceEditor from './TaxInvoiceEditor';

function buildFormDataFromQuote(quote, proformaInvoices) {
  const todayStr = new Date().toISOString().split('T')[0];
  const initialNo = generateNextProformaNumber(proformaInvoices, quote);

  if (quote) {
    const inferredState = quote.clientState || (quote.clientGstin ? getStateFromGstin(quote.clientGstin)?.state : '');
    const detectedCategory = quote.category || (
      quote.categoryName?.includes('SOFTWARE') ? 'Software' :
      quote.categoryName?.includes('PRODUCT') ? 'Product' : 'Automation Work'
    );
    const isSw = detectedCategory === 'Software';

    return {
      id: '',
      category: detectedCategory,
      invoiceNo: initialNo,
      linkedQuotationId: quote.id || '',
      linkedQuotationNumber: quote.quotationNumber || '',
      date: todayStr,
      validityDays: quote.validityDays || 30,
      customerPoNo: quote.customerPoNo || '',
      customerPoDate: quote.customerPoDate || '',
      customerId: quote.clientId || '',
      customerName: quote.clientName || '',
      billingAddress: quote.billingAddress || '',
      customerGstin: quote.clientGstin || '',
      clientState: inferredState || '',
      placeOfSupply: quote.placeOfSupply || '',
      shipToSameAsBillTo: quote.shipToSameAsBillTo !== undefined ? quote.shipToSameAsBillTo : true,
      shippingAddress: quote.shippingAddress || '',
      shippingGstin: quote.shippingGstin || '',
      advancePercent: quote.advancePercent !== undefined ? (quote.advancePercent === 50 ? 75 : quote.advancePercent) : (isSw ? 40 : 75),
      paymentTerms: (!quote.paymentTerms || quote.paymentTerms.includes('50% Advance')) 
        ? (isSw ? '40% Advance with PO, 40% on Demo/Testing, 20% on final launch & handover.' : '75% Advance with PO, 25% Before Dispatch') 
        : quote.paymentTerms,
      deliveryTimeline: quote.deliveryTerms || quote.deliveryTimeline || (isSw ? 'Within 3–6 weeks from receipt of advance and content' : 'Within 2–4 weeks from order & advance'),
      freightTerms: quote.freightTerms || (isSw ? 'Not Applicable (Electronic / Remote Delivery & Cloud Setup)' : 'Extra at actual / Borne by Client'),
      packingForwarding: quote.packingForwarding || (isSw ? 'Not Applicable (Cloud / Digital Delivery)' : 'Included in base price'),
      transitInsurance: quote.transitInsurance || (isSw ? 'Not Applicable' : 'In Client Scope / Borne by Buyer'),
      warrantyTerms: quote.warrantyTerms || (isSw ? '3–6 months complimentary bug fixes & technical support from go-live.' : '12 months from commissioning or 13 months from invoice'),
      notes: quote.notes || (isSw ? '1. This is a Proforma Invoice, not a Tax Invoice. Statutory Tax Invoice will be issued upon go-live.\n2. Payment to be made by RTGS/NEFT/IMPS to our bank account mentioned below.' : '1. This is a Proforma Invoice, not a Tax Invoice. Statutory Tax Invoice with E-Way Bill will be issued upon dispatch.\n2. Payment to be made by RTGS/NEFT to our bank account mentioned below.\n3. Material inspection to be completed within 3 days of intimation before dispatch.'),
      items: Array.isArray(quote.items) && quote.items.length > 0 
        ? quote.items.map(it => ({
            id: it.id || 'item-' + Math.random(),
            name: it.title || it.name || '',
            description: it.description || '',
            hsnCode: isSw ? '' : (it.hsn || it.hsnCode || ''),
            unit: isSw ? '' : (it.unit || 'Nos'),
            qty: it.qty || 1,
            rate: it.unitPrice || it.rate || 0,
            discount: it.discountPercent || it.discount || 0,
            gst: it.gstRate !== undefined ? it.gstRate : 18,
            amount: it.taxableAmount || (it.qty * (it.unitPrice || it.rate || 0)) || 0
          }))
        : []
    };
  }

  return {
    id: '',
    category: 'Automation Work',
    invoiceNo: initialNo,
    linkedQuotationId: '',
    linkedQuotationNumber: '',
    date: todayStr,
    validityDays: 30,
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
    advancePercent: 75,
    paymentTerms: '75% Advance with PO, 25% Before Dispatch',
    deliveryTimeline: 'Within 2–4 weeks from order & advance',
    freightTerms: 'Extra at actual / Borne by Client',
    packingForwarding: 'Included in base price',
    transitInsurance: 'In Client Scope / Borne by Buyer',
    warrantyTerms: '12 months from commissioning or 13 months from invoice',
    notes: '1. This is a Proforma Invoice, not a Tax Invoice. Statutory Tax Invoice with E-Way Bill will be issued upon dispatch.\n2. Payment to be made by RTGS/NEFT to our bank account mentioned below.\n3. Material inspection to be completed within 3 days of intimation before dispatch.',
    items: []
  };
}

function ProformaManager({
  clients = [],
  quotations = [],
  companySettings = {},
  initialQuotation = null,
  initialMode = 'cards',
  defaultFilter = 'all',
  onClearInitialQuotation,
  onSaveQuotation,
  onViewQuotation,
  onShareQuotation,
  onDeleteQuotation,
  onNavigateTab
}) {
  const [viewMode, setViewMode] = useState(() => initialQuotation ? 'create' : (initialMode || 'cards'));
  const [taxInvoiceSource, setTaxInvoiceSource] = useState(null);
  const invoiceFilter = defaultFilter || 'all'; // 'all' | 'tax' | 'proforma'
  const [searchTerm, setSearchTerm] = useState('');

  // Single-pass partitioning of invoice types and linkable quotes
  const { proformaInvoices, taxInvoices, allInvoices, linkableQuotations } = useMemo(() => {
    const pi = [];
    const ti = [];
    const all = [];
    const linkable = [];
    for (let i = 0; i < quotations.length; i++) {
      const q = quotations[i];
      const isTI = q.isTaxInvoice || q.documentType === 'Tax Invoice';
      const isPI = q.isProforma || q.documentType === 'Proforma Invoice';

      if (isTI) {
        ti.push(q);
        all.push(q);
      } else if (isPI) {
        pi.push(q);
        all.push(q);
      } else if (!q.isDeliveryChallan && q.documentType !== 'Delivery Challan') {
        linkable.push(q);
      }
    }
    return { proformaInvoices: pi, taxInvoices: ti, allInvoices: all, linkableQuotations: linkable };
  }, [quotations]);

  // Filtered invoices for the Cards view
  const filteredInvoices = useMemo(() => {
    let list = allInvoices;
    if (invoiceFilter === 'tax') list = taxInvoices;
    else if (invoiceFilter === 'proforma') list = proformaInvoices;

    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(inv => 
      (inv.quotationNumber || '').toLowerCase().includes(term) ||
      (inv.clientName || '').toLowerCase().includes(term) ||
      (inv.customerPoNo || '').toLowerCase().includes(term) ||
      (inv.ewayBillNo || '').toLowerCase().includes(term) ||
      (inv.vehicleNo || '').toLowerCase().includes(term) ||
      (inv.linkedProformaNumber || '').toLowerCase().includes(term) ||
      (inv.placeOfSupply || '').toLowerCase().includes(term)
    );
  }, [allInvoices, taxInvoices, proformaInvoices, invoiceFilter, searchTerm]);

  // Top KPI metric statistics computed for the active filter
  const stats = useMemo(() => {
    if (invoiceFilter === 'proforma') {
      const totalCount = proformaInvoices.length;
      let totalVal = 0;
      let totalAdv = 0;
      let totalBal = 0;
      for (let i = 0; i < proformaInvoices.length; i++) {
        const p = proformaInvoices[i];
        const g = Number(p.grandTotal || 0);
        const adv = Number(p.advancePayable || Math.round(g * (((p.advancePercent === 50 ? 75 : p.advancePercent) || 75) / 100)));
        const bal = Number(p.balancePayable || Math.max(0, g - adv));
        totalVal += g;
        totalAdv += adv;
        totalBal += bal;
      }
      return [
        { label: 'Total Proformas', value: totalCount, isCurrency: false, icon: FileCheck2, color: 'text-purple-700', bg: 'bg-purple-50' },
        { label: 'Proforma Pipeline Value', value: totalVal, isCurrency: true, icon: Receipt, color: 'text-slate-900', bg: 'bg-blue-50' },
        { label: 'Advance Expected', value: totalAdv, isCurrency: true, icon: Clock, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { label: 'Balance on Delivery', value: totalBal, isCurrency: true, icon: Building2, color: 'text-amber-700', bg: 'bg-amber-50' },
      ];
    } else if (invoiceFilter === 'tax') {
      const totalCount = taxInvoices.length;
      let totalVal = 0;
      let totalAdv = 0;
      let totalBal = 0;
      for (let i = 0; i < taxInvoices.length; i++) {
        const t = taxInvoices[i];
        const g = Number(t.grandTotal || 0);
        const adv = Number(t.advancePaid || 0);
        const bal = Number(t.balanceDue !== undefined ? t.balanceDue : Math.max(0, g - adv));
        totalVal += g;
        totalAdv += adv;
        totalBal += bal;
      }
      return [
        { label: 'Total Final Invoices', value: totalCount, isCurrency: false, icon: Receipt, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { label: 'Total Billed Value', value: totalVal, isCurrency: true, icon: Receipt, color: 'text-slate-900', bg: 'bg-blue-50' },
        { label: 'Advances Adjusted', value: totalAdv, isCurrency: true, icon: Clock, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        { label: 'Balance Outstanding', value: totalBal, isCurrency: true, icon: Building2, color: 'text-amber-700', bg: 'bg-amber-50' },
      ];
    } else {
      let totalVal = 0;
      for (let i = 0; i < allInvoices.length; i++) {
        totalVal += Number(allInvoices[i].grandTotal || 0);
      }
      return [
        { label: 'Total Invoices', value: allInvoices.length, isCurrency: false, icon: Receipt, color: 'text-slate-900', bg: 'bg-blue-50' },
        { label: 'Combined Value', value: totalVal, isCurrency: true, icon: Receipt, color: 'text-slate-900', bg: 'bg-blue-50' },
        { label: 'Proforma Invoices', value: proformaInvoices.length, isCurrency: false, icon: FileCheck2, color: 'text-purple-700', bg: 'bg-purple-50' },
        { label: 'Final Invoices', value: taxInvoices.length, isCurrency: false, icon: Receipt, color: 'text-emerald-700', bg: 'bg-emerald-50' },
      ];
    }
  }, [invoiceFilter, proformaInvoices, taxInvoices, allInvoices]);

  // Form State initialized sequentially starting from 1
  const [formData, setFormData] = useState(() => buildFormDataFromQuote(initialQuotation, proformaInvoices));

  const handleConvertToTaxInvoice = (inv) => {
    setTaxInvoiceSource(inv);
    setViewMode('tax-invoice');
  };

  const handleCreateTaxInvoice = () => {
    setTaxInvoiceSource(null);
    setViewMode('tax-invoice');
  };

  const handleEditTaxInvoice = (inv) => {
    setTaxInvoiceSource(inv);
    setViewMode('tax-invoice');
  };

  // Edit existing Proforma Invoice
  const handleEditProforma = (inv) => {
    const isSw = inv.category === 'Software' || 
      inv.categoryName?.includes('SOFTWARE') || 
      (Array.isArray(inv.items) && inv.items.some(it => {
        const code = String(it.hsnCode || it.hsn || '');
        return code.startsWith('9983') || code.startsWith('9973');
      }));

    setFormData({
      id: inv.id,
      category: isSw ? 'Software' : (inv.category || 'Automation Work'),
      invoiceNo: inv.quotationNumber || inv.invoiceNo,
      linkedQuotationId: inv.linkedQuotationId || '',
      linkedQuotationNumber: inv.linkedQuotationNumber || '',
      date: inv.date || new Date().toISOString().split('T')[0],
      validityDays: inv.validityDays || 30,
      customerPoNo: inv.customerPoNo || '',
      customerPoDate: inv.customerPoDate || '',
      customerId: inv.clientId || '',
      customerName: inv.clientName || '',
      billingAddress: inv.billingAddress || '',
      customerGstin: inv.clientGstin || '',
      clientState: inv.clientState || '',
      placeOfSupply: inv.placeOfSupply || '',
      shipToSameAsBillTo: inv.shipToSameAsBillTo !== undefined ? inv.shipToSameAsBillTo : true,
      shippingAddress: inv.shippingAddress || '',
      shippingGstin: inv.shippingGstin || '',
      advancePercent: inv.advancePercent !== undefined ? (inv.advancePercent === 50 ? 75 : inv.advancePercent) : (isSw ? 40 : 75),
      paymentTerms: (!inv.paymentTerms || inv.paymentTerms.includes('50% Advance')) 
        ? (isSw ? '40% Advance with PO, 40% on Demo/Testing, 20% on final launch & handover.' : '75% Advance with PO, 25% Before Dispatch') 
        : inv.paymentTerms,
      deliveryTimeline: inv.deliveryTerms || inv.deliveryTimeline || (isSw ? 'Within 3–6 weeks from receipt of advance and content' : 'Within 2–4 weeks from order & advance'),
      freightTerms: inv.freightTerms || (isSw ? 'Not Applicable (Electronic / Remote Delivery & Cloud Setup)' : 'Extra at actual / Borne by Client'),
      packingForwarding: inv.packingForwarding || (isSw ? 'Not Applicable (Cloud / Digital Delivery)' : 'Included in base price'),
      transitInsurance: inv.transitInsurance || (isSw ? 'Not Applicable' : 'In Client Scope / Borne by Buyer'),
      warrantyTerms: inv.warrantyTerms || (isSw ? '3–6 months complimentary bug fixes & technical support from go-live.' : '12 months from commissioning or 13 months from invoice'),
      notes: inv.notes || '',
      items: Array.isArray(inv.items) && inv.items.length > 0 
        ? inv.items.map(it => ({
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
        : []
    });
    setViewMode('create');
    if (onNavigateTab) onNavigateTab('proforma');
  };

  // Handle linking with an existing quotation
  const handleLinkQuotation = (quoteId) => {
    if (!quoteId) {
      setFormData(prev => ({
        ...prev,
        linkedQuotationId: '',
        linkedQuotationNumber: '',
        invoiceNo: generateNextProformaNumber(proformaInvoices)
      }));
      if (onClearInitialQuotation) onClearInitialQuotation();
      return;
    }

    const q = quotations.find(item => item.id === quoteId);
    if (q) {
      setFormData(buildFormDataFromQuote(q, proformaInvoices));
    }
  };

  // Direct navigation to referenced document (Quotation / PI / Tax Invoice / Challan)
  const handleOpenLinkedDocument = (docNumber, docId) => {
    if (!docNumber && !docId) return;

    const target = (docNumber || '').trim().toLowerCase();
    const targetId = docId || '';

    // Search in all system quotations, invoices, and challans
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
        onViewQuotation(found, 'proforma');
      }
    } else {
      // Fallback search in allInvoices
      const fallback = allInvoices.find(a => 
        (a.quotationNumber || '').trim().toLowerCase() === target ||
        (a.invoiceNo || '').trim().toLowerCase() === target
      );
      if (fallback && onViewQuotation) {
        onViewQuotation(fallback, 'proforma');
      } else {
        alert(`Referenced document "${docNumber}" not found in current records.`);
      }
    }
  };

  // Handle client selection with auto state & place of supply
  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const gstin = client.gstin || '';
      const stateObj = gstin ? getStateFromGstin(gstin) : null;
      const clientState = client.state || stateObj?.state || 'Maharashtra';
      const placeOfSupply = client.state || stateObj?.state || clientState;

      setFormData(prev => ({
        ...prev,
        customerId: client.id,
        customerName: client.companyName || '',
        billingAddress: client.billingAddress || '',
        customerGstin: gstin,
        clientState,
        placeOfSupply
      }));
    }
  };

  // Handle client GSTIN input with auto state identification
  const handleGstinChange = (gstinVal) => {
    const cleanGstin = gstinVal.toUpperCase().trim();
    const stateObj = getStateFromGstin(cleanGstin);

    setFormData(prev => {
      const updates = { ...prev, customerGstin: cleanGstin };
      if (stateObj) {
        updates.clientState = stateObj.state;
        updates.placeOfSupply = stateObj.state;
      }
      return updates;
    });
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
      advancePercent: isSw ? 40 : (prev.advancePercent === 40 || prev.advancePercent === 50 ? 75 : prev.advancePercent),
      paymentTerms: isSw && (!prev.paymentTerms || prev.paymentTerms.includes('75% Advance') || prev.paymentTerms.includes('50% Advance')) 
        ? '40% Advance with PO, 40% on Demo/Testing, 20% on final launch & handover.' 
        : (!isSw && (prev.paymentTerms?.includes('40% Advance') || prev.paymentTerms?.includes('50% Advance')) ? '75% Advance with PO, 25% Before Dispatch' : prev.paymentTerms),
      deliveryTimeline: isSw && (!prev.deliveryTimeline || prev.deliveryTimeline.includes('2–4 weeks'))
        ? 'Within 3–6 weeks from receipt of advance and content'
        : (!isSw && prev.deliveryTimeline?.includes('3–6 weeks') ? 'Within 2–4 weeks from order & advance' : prev.deliveryTimeline),
      freightTerms: isSw ? 'Not Applicable (Electronic / Remote Delivery & Cloud Setup)' : (prev.freightTerms?.includes('Electronic') ? 'Extra at actual / Borne by Client' : prev.freightTerms),
      packingForwarding: isSw ? 'Not Applicable (Cloud / Digital Delivery)' : (prev.packingForwarding?.includes('Cloud') ? 'Included in base price' : prev.packingForwarding),
      transitInsurance: isSw ? 'Not Applicable' : (prev.transitInsurance === 'Not Applicable' ? 'In Client Scope / Borne by Buyer' : prev.transitInsurance),
      warrantyTerms: isSw && (!prev.warrantyTerms || prev.warrantyTerms.includes('commissioning'))
        ? '3–6 months complimentary bug fixes & technical support from go-live.'
        : (!isSw && prev.warrantyTerms?.includes('bug fixes') ? '12 months from commissioning or 13 months from invoice' : prev.warrantyTerms),
      items: isSw
        ? prev.items.map(it => ({ ...it, hsnCode: '', unit: '' }))
        : prev.items.map(it => ({ ...it, unit: it.unit || 'Nos' }))
    }));
  };

  // Add Item Row
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

  // Update Item Row
  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const nextItems = [...prev.items];
      const item = { ...nextItems[index], [field]: value };

      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const discount = parseFloat(item.discount) || 0;
      
      const discountedRate = rate * (1 - (discount / 100));
      item.amount = Math.round(qty * discountedRate);

      nextItems[index] = item;
      return { ...prev, items: nextItems };
    });
  };

  // Delete Item Row
  const handleDeleteItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculations with accurate GST (CGST+SGST vs IGST) & Advance milestones
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalGst = 0;

    formData.items.forEach(item => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const discount = parseFloat(item.discount) || 0;
      const gstRate = item.gst !== undefined ? parseFloat(item.gst) : 18;

      const base = qty * rate;
      const discAmt = base * (discount / 100);
      const taxable = Math.max(0, base - discAmt);

      subtotal += base;
      totalDiscount += discAmt;
      totalGst += (taxable * gstRate) / 100;
    });

    const taxable = Math.round(subtotal - totalDiscount);
    const isIntraState = isIntraStateSupply(formData.clientState, companySettings?.state || 'Maharashtra');

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
    const advPercent = parseFloat(formData.advancePercent) || 0;
    const advancePayable = Math.round((grandTotal * advPercent) / 100);
    const balancePayable = Math.max(0, grandTotal - advancePayable);

    return {
      subtotal,
      totalDiscount,
      taxable,
      isIntraState,
      cgst,
      sgst,
      igst,
      grandTotal,
      advancePayable,
      balancePayable
    };
  }, [formData.items, formData.clientState, formData.advancePercent, companySettings?.state]);

  // Helper to build standard proforma document structure
  const buildFinalDoc = (customId = '') => {
    return {
      id: formData.id || customId || 'pi-draft',
      quotationNumber: formData.invoiceNo,
      revision: 'PI',
      date: formData.date,
      status: 'Converted to PO',
      documentType: 'Proforma Invoice',
      isProforma: true,
      category: formData.category || (isSoftware ? 'Software' : 'Automation Work'),
      categoryName: isSoftware ? 'SOFTWARE DEVELOPMENT' : (formData.category === 'Product' ? 'PRODUCT SUPPLY' : 'AUTOMATION WORK'),
      linkedQuotationNumber: formData.linkedQuotationNumber || '',
      linkedQuotationId: formData.linkedQuotationId || '',
      customerPoNo: formData.customerPoNo || '',
      customerPoDate: formData.customerPoDate || '',
      clientId: formData.customerId,
      clientName: formData.customerName,
      clientGstin: formData.customerGstin,
      clientState: formData.clientState,
      placeOfSupply: formData.placeOfSupply,
      billingAddress: formData.billingAddress,
      shipToSameAsBillTo: formData.shipToSameAsBillTo,
      shippingAddress: formData.shipToSameAsBillTo ? formData.billingAddress : (formData.shippingAddress || formData.billingAddress),
      shippingGstin: formData.shipToSameAsBillTo ? formData.customerGstin : (formData.shippingGstin || formData.customerGstin),
      advancePercent: formData.advancePercent,
      advancePayable: calculations.advancePayable,
      balancePayable: calculations.balancePayable,
      subject: formData.linkedQuotationNumber
        ? `Proforma Invoice ${formData.invoiceNo} (Ref Quote: ${formData.linkedQuotationNumber}) - ${formData.customerName}`
        : `Proforma Invoice ${formData.invoiceNo} - ${formData.customerName}`,
      validityDays: formData.validityDays || 30,
      paymentTerms: formData.paymentTerms,
      deliveryTerms: formData.deliveryTimeline,
      freightTerms: formData.freightTerms,
      packingForwarding: formData.packingForwarding,
      transitInsurance: formData.transitInsurance,
      warrantyTerms: formData.warrantyTerms,
      notes: formData.notes,
      items: formData.items.map(it => ({
        id: it.id,
        title: it.name,
        name: it.name,
        description: it.description || '',
        hsn: isSoftware ? '' : (it.hsnCode || ''),
        hsnCode: isSoftware ? '' : (it.hsnCode || ''),
        unit: isSoftware ? '' : (it.unit || 'Nos'),
        qty: it.qty,
        unitPrice: it.rate,
        discountPercent: it.discount,
        gstRate: it.gst,
        taxableAmount: it.amount
      })),
      subtotal: calculations.subtotal,
      totalTaxable: calculations.taxable,
      isIntraState: calculations.isIntraState,
      cgst: calculations.cgst,
      sgst: calculations.sgst,
      igst: calculations.igst,
      grandTotal: calculations.grandTotal,
      amountInWords: numberToIndianWords(calculations.grandTotal),
      advanceInWords: numberToIndianWords(calculations.advancePayable)
    };
  };

  // Convert form data to standard quotation structure for printing/export
  const handleSave = (andView = false) => {
    const finalDoc = buildFinalDoc('pi-' + Date.now());
    onSaveQuotation(finalDoc, andView);

    if (andView) {
      onViewQuotation(finalDoc);
    } else {
      if (onNavigateTab) {
        onNavigateTab('invoices');
      } else {
        setViewMode('cards');
      }
    }
  };

  // Render Tax Invoice Editor if in Final Tax Invoice Mode
  if (viewMode === 'tax-invoice') {
    return (
      <TaxInvoiceEditor
        clients={clients}
        quotations={quotations}
        companySettings={companySettings}
        initialSource={taxInvoiceSource}
        onSave={(saved, andView) => {
          if (onSaveQuotation) onSaveQuotation(saved, andView);
          if (andView && onViewQuotation) {
            onViewQuotation(saved);
          } else {
            setViewMode('cards');
          }
        }}
        onCancel={() => setViewMode('cards')}
        onView={onViewQuotation}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'create') {
                if (onClearInitialQuotation) onClearInitialQuotation();
                setViewMode('cards');
              } else if (onNavigateTab) {
                onNavigateTab('dashboard');
              }
            }}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition-all cursor-pointer active:scale-95 shrink-0"
            title={viewMode === 'create' ? 'Back to Cards' : 'Back to Dashboard'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {viewMode === 'create' 
                ? 'Create Proforma Invoice' 
                : (invoiceFilter === 'proforma' ? 'Proforma Invoices' : (invoiceFilter === 'tax' ? 'Final Invoices' : 'Commercial Invoices'))}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              {viewMode === 'create' 
                ? 'Add details, machinery line items, advance terms, and bank remittance' 
                : (invoiceFilter === 'proforma'
                    ? 'Track, issue, and manage commercial proforma offers for purchase orders and bank advances'
                    : (invoiceFilter === 'tax'
                        ? 'Official final invoices with E-Way bill and dispatch details'
                        : 'Track and issue commercial proforma invoices and final invoices'))}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {viewMode === 'create' ? (
            <button
              type="button"
              onClick={() => {
                if (onClearInitialQuotation) onClearInitialQuotation();
                setViewMode('cards');
              }}
              className="flex items-center space-x-2 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-2xs cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-slate-500" />
              <span>Back to {invoiceFilter === 'proforma' ? 'Proformas' : 'Invoices'} Cards ({filteredInvoices.length})</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              {invoiceFilter !== 'proforma' && (
                <button
                  type="button"
                  onClick={handleCreateTaxInvoice}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>+ Final Invoice</span>
                </button>
              )}

              {invoiceFilter !== 'tax' && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData(buildFormDataFromQuote(null, proformaInvoices));
                    setViewMode('create');
                  }}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Proforma</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CREATE PROFORMA VIEW */}
      {viewMode === 'create' ? (
        <div className="space-y-6">

          {/* Link with Quotation Selector */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50/50 border border-blue-200/80 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center space-x-2">
                  <span>Linked Quotation</span>
                  {formData.linkedQuotationNumber && (
                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                      {formData.linkedQuotationNumber}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {formData.linkedQuotationNumber 
                    ? 'Customer, address, items & rates automatically linked from this quotation' 
                    : 'Select an existing quotation to automatically pull customer, items & prices'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <select
                value={formData.linkedQuotationId || ''}
                onChange={(e) => handleLinkQuotation(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              >
                <option value="">-- Standalone Proforma (Not Linked) --</option>
                {linkableQuotations.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.quotationNumber} • {q.clientName || 'Customer'} (₹{(q.grandTotal || 0).toLocaleString('en-IN')})
                  </option>
                ))}
              </select>

              {formData.linkedQuotationNumber && (
                <button
                  type="button"
                  onClick={() => handleLinkQuotation('')}
                  className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors border border-slate-200"
                  title="Unlink quotation"
                >
                  Unlink
                </button>
              )}
            </div>
          </div>
          
          {/* Top Cards Grid (Customer & Delivery Site Coordinates) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Card 1: Customer Details & PO Reference */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Customer & PO Details</span>
                </h2>
                {clients.length > 0 && (
                  <select
                    value={formData.customerId}
                    onChange={(e) => handleClientChange(e.target.value)}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 outline-none"
                  >
                    <option value="">Autofill Client</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Customer / Buyer Name *</label>
                <input
                  type="text"
                  required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    value={formData.customerGstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    placeholder=""
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Place of Supply</label>
                  <input
                    type="text"
                    value={formData.placeOfSupply}
                    onChange={(e) => setFormData({ ...formData, placeOfSupply: e.target.value })}
                    placeholder=""
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={formData.category || 'Automation Work'}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                  >
                    <option value="Automation Work">Automation Work</option>
                    <option value="Product">Product</option>
                    <option value="Software">Software</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Invoice No. *</label>
                  <input
                    type="text"
                    value={formData.invoiceNo}
                    onChange={(e) => setFormData({ ...formData, invoiceNo: e.target.value })}
                    placeholder="PI-001"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Customer PO Reference Block */}
              <div className="p-2.5 bg-slate-50/80 border border-slate-200/80 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                  <FileText className="w-3 h-3 text-indigo-600" />
                  <span>Customer PO / Work Order Reference</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">PO / Ref No.</label>
                    <input
                      type="text"
                      value={formData.customerPoNo}
                      onChange={(e) => setFormData({ ...formData, customerPoNo: e.target.value })}
                      placeholder=""
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">PO Date</label>
                    <input
                      type="date"
                      value={formData.customerPoDate}
                      onChange={(e) => setFormData({ ...formData, customerPoDate: e.target.value })}
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Commercial Advance Payment Terms Block */}
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2">
                <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
                  <span>Advance Payment & Commercial Terms</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">Default: 75% Advance</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Advance %</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={formData.advancePercent}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                          setFormData(prev => ({
                            ...prev,
                            advancePercent: val,
                            paymentTerms: `${val}% Advance with PO, ${100 - val}% Before Dispatch`
                          }));
                        }}
                        className="w-full pl-2 pr-6 py-1 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold text-emerald-950 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                      <span className="absolute right-2 top-1 text-xs text-slate-400 font-bold pointer-events-none">%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Payment Terms</label>
                    <input
                      type="text"
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      placeholder="e.g. 75% Advance with PO, 25% Before Dispatch"
                      className="w-full px-2 py-1 bg-white border border-emerald-200 rounded-lg text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Billing & Consignee / Delivery Plant Addresses */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Billing & Consignee Site</span>
                </h2>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Billed To (Registered Office Address)
                </label>
                <textarea
                  rows="2"
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  placeholder=""
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Consignee / Shipping Address Toggle */}
              <div className="pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.shipToSameAsBillTo}
                    onChange={(e) => setFormData({ ...formData, shipToSameAsBillTo: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Consignee / Delivery Plant same as Billing Address
                  </span>
                </label>
              </div>

              {!formData.shipToSameAsBillTo && (
                <div className="space-y-2 p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl animate-in fade-in">
                  <div className="text-[11px] font-bold text-amber-900">
                    Shipped To (Plant / Factory / Installation Site)
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Site / Factory Address</label>
                    <textarea
                      rows="2"
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                      placeholder="Plot No. E-24, MIDC Phase 2, Akola..."
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg text-xs text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-600 mb-0.5">Consignee GSTIN (if different)</label>
                    <input
                      type="text"
                      value={formData.shippingGstin}
                      onChange={(e) => setFormData({ ...formData, shippingGstin: e.target.value.toUpperCase().trim() })}
                      placeholder="Consignee GSTIN"
                      className="w-full px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs font-mono uppercase text-slate-800 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Tax Treatment:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    calculations.isIntraState 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {calculations.isIntraState ? 'Intra-State (CGST + SGST 18%)' : 'Inter-State (IGST 18%)'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  {calculations.isIntraState 
                    ? 'Within Maharashtra: 9% CGST + 9% SGST applied.' 
                    : `Outside Maharashtra (${formData.clientState}): 18% Integrated IGST applied.`}
                </div>
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Card Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {isSoftware ? 'Software Solutions & Services' : 'Machinery & Line Items'}
                    </h2>
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200">
                      {formData.items.length} {formData.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isSoftware
                      ? 'Software engineering, cloud solutions, licenses & custom application line items'
                      : 'HSN/SAC codes, technical specifications, and GST rates for Input Tax Credit clearance'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddItem}
                className="h-8.5 inline-flex items-center space-x-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Responsive Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider text-[10.5px] border-b border-slate-200/80">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 min-w-[280px]">
                      {isSoftware ? 'Description of Software Solutions / Services' : 'Description of Machinery / Service'}
                    </th>
                    {!isSoftware && (
                      <th className="py-3 px-2 w-28 text-center">HSN / SAC</th>
                    )}
                    <th className="py-3 px-2 w-18 text-center">Qty</th>
                    {!isSoftware && (
                      <th className="py-3 px-2 w-20 text-center">Unit</th>
                    )}
                    <th className="py-3 px-2 w-28 text-right">Rate (₹)</th>
                    <th className="py-3 px-2 w-18 text-center">Disc %</th>
                    <th className="py-3 px-2 w-20 text-center">GST %</th>
                    <th className="py-3 px-3 w-32 text-right">Taxable (₹)</th>
                    <th className="py-3 px-2 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {formData.items.length === 0 ? (
                    <tr>
                      <td colSpan={isSoftware ? 8 : 10} className="py-12 text-center text-slate-400">
                        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="font-bold text-xs text-slate-700">
                          {isSoftware ? 'No software service items added yet' : 'No machinery or line items added yet'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                          {isSoftware ? 'Add custom software modules, web/mobile apps, or cloud services' : 'Add equipment, machinery items, or automation services'}
                        </p>
                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="h-8 inline-flex items-center space-x-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add First Line Item</span>
                        </button>
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
                        
                        {/* Name & Technical Specifications */}
                        <td className="py-3 px-3 align-top">
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="Product or service description *"
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                          />
                        </td>

                        {/* HSN */}
                        {!isSoftware && (
                          <td className="py-3 px-2 align-top">
                            <input
                              type="text"
                              value={item.hsnCode}
                              onChange={(e) => handleItemChange(index, 'hsnCode', e.target.value)}
                              placeholder="e.g. 8479"
                              className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                              list="hsn-datalist"
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

                        {/* Unit */}
                        {!isSoftware && (
                          <td className="py-3 px-2 align-top">
                            <select
                              value={item.unit || 'Nos'}
                              onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                              className="w-full h-8 px-1 bg-slate-50/70 hover:bg-white border border-slate-200 rounded-lg text-xs font-medium text-center text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                            >
                              <option value="Nos">Nos</option>
                              <option value="Set">Set</option>
                              <option value="Job">Job</option>
                              <option value="Module">Module</option>
                              <option value="License">License</option>
                              <option value="System">System</option>
                              <option value="Month">Month</option>
                              <option value="User">User</option>
                              <option value="Package">Package</option>
                              <option value="Lot">Lot</option>
                              <option value="Unit">Unit</option>
                              <option value="Mtr">Mtr</option>
                            </select>
                          </td>
                        )}

                        {/* Rate */}
                        <td className="py-3 px-2 align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.rate === 0 || item.rate === '0' ? '' : (item.rate ?? '')}
                            onChange={(e) => handleItemChange(index, 'rate', e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="0.00"
                            className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right text-slate-900 placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                          />
                        </td>

                        {/* Disc % */}
                        <td className="py-3 px-2 align-top">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.discount === 0 || item.discount === '0' ? '' : (item.discount ?? '')}
                            onChange={(e) => handleItemChange(index, 'discount', e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="0"
                            className="w-full h-8 px-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all hover:border-slate-300"
                          />
                        </td>

                        {/* GST % */}
                        <td className="py-3 px-2 align-top">
                          <select
                            value={item.gst}
                            onChange={(e) => handleItemChange(index, 'gst', parseFloat(e.target.value))}
                            className="w-full h-8 px-1 bg-slate-50/70 hover:bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                          >
                            <option value="18">18%</option>
                            <option value="12">12%</option>
                            <option value="28">28%</option>
                            <option value="5">5%</option>
                            <option value="0">0%</option>
                          </select>
                        </td>

                        {/* Taxable (₹) */}
                        <td className="py-3 px-3 text-right align-top pt-3.5 whitespace-nowrap">
                          <span className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                            {formatCurrency(item.amount)}
                          </span>
                        </td>

                        {/* Trash */}
                        <td className="py-3 px-2 text-center align-top pt-2.5">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove line item"
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

            {!isSoftware && (
              <datalist id="hsn-datalist">
                {COMMON_HSN_CODES.map(h => (
                  <option key={h.code} value={h.code}>{h.desc}</option>
                ))}
              </datalist>
            )}

            {/* Card Footer: Add Item + Live Subtotal Preview */}
            {formData.items.length > 0 && (
              <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Another Line</span>
                </button>

                <div className="flex items-center space-x-4 text-xs font-medium text-slate-600">
                  <div>
                    <span>{isSoftware ? 'Total Qty: ' : 'Total Units: '}</span>
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

          {/* Bottom Row: Notes (Left) + Amount Summary (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Notes Card */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Statutory Declarations & Client Instructions</span>
              </h2>
              <textarea
                rows="6"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Important terms and bank instructions..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[10px] text-slate-400">
                These conditions and RTGS bank remittance instructions appear directly on the issued Proforma Invoice document.
              </p>
            </div>

            {/* Amount Summary Card */}
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-2.5">
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Financial Summary</h2>
                
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Gross Subtotal</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(calculations.subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span>Total Discount</span>
                    <span className="font-mono text-emerald-600 font-bold">
                      {calculations.totalDiscount > 0 ? `-${formatCurrency(calculations.totalDiscount)}` : '₹0'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600 font-medium pt-1 border-t border-slate-100">
                    <span>Taxable Value</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(calculations.taxable)}</span>
                  </div>

                  {calculations.isIntraState ? (
                    <>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>CGST (9%)</span>
                        <span className="font-mono text-slate-800">{formatCurrency(calculations.cgst)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>SGST (9%)</span>
                        <span className="font-mono text-slate-800">{formatCurrency(calculations.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between text-slate-600">
                      <span>IGST (18% - Inter-State)</span>
                      <span className="font-mono text-slate-800">{formatCurrency(calculations.igst)}</span>
                    </div>
                  )}

                  {/* Solid Blue Grand Total Box */}
                  <div className="mt-2.5 px-3.5 py-2 bg-blue-600 rounded-xl text-white flex items-center justify-between shadow-xs">
                    <span className="font-bold text-xs uppercase tracking-wide">Total Proforma Value</span>
                    <span className="font-extrabold text-base sm:text-lg font-mono">{formatCurrency(calculations.grandTotal)}</span>
                  </div>

                  {/* Advance Payable & Balance Breakdown */}
                  <div className="mt-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between text-emerald-900 font-bold">
                      <span>Advance Required ({formData.advancePercent || 75}%):</span>
                      <span className="font-mono text-sm">{formatCurrency(calculations.advancePayable)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 text-[11px]">
                      <span>Balance on Dispatch ({100 - (formData.advancePercent || 75)}%):</span>
                      <span className="font-mono font-medium">{formatCurrency(calculations.balancePayable)}</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action Buttons Directly Under the Grand Total Card */}
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors shadow-2xs cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="w-full flex-1 flex items-center justify-center space-x-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Preview & Download</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      ) : (
        /* INVOICES CARD-ROW LIST VIEW */
        <div className="space-y-6">
          
          {/* Top KPI Metrics Strip - Reduced & Slim */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((st, i) => {
              const Icon = st.icon;
              return (
                <div key={i} className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{st.label}</span>
                    <span className={`text-lg font-black font-mono mt-0.5 block ${st.color}`}>
                      {st.isCurrency ? formatCurrency(st.value, false) : st.value}
                    </span>
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${st.bg} flex items-center justify-center shrink-0`}>
                    <Icon className="w-4 h-4 text-current" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search Bar */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice, customer, PO, ref..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Invoices List / Cards */}
          {filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                invoiceFilter === 'tax' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'
              }`}>
                {invoiceFilter === 'tax' ? <Receipt className="w-7 h-7" /> : <FileCheck2 className="w-7 h-7" />}
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-slate-800">
                  {searchTerm 
                    ? 'No Matching Invoices Found' 
                    : (invoiceFilter === 'proforma' ? 'No Proforma Invoices Found' : (invoiceFilter === 'tax' ? 'No Final Invoices Found' : 'No Invoices Found'))}
                </h3>
                <p className="text-xs text-slate-500">
                  {searchTerm 
                    ? 'Try adjusting your search criteria.' 
                    : (invoiceFilter === 'proforma'
                        ? 'Generate commercial proforma invoices for advance bank payments, customer purchase orders, and project kickoff.'
                        : (invoiceFilter === 'tax'
                            ? 'Issue statutory final invoices under Rule 46 CGST for finished goods, machine dispatches, and sales billing.'
                            : 'Create a Proforma Invoice to request advance, or issue a statutory final invoice for goods dispatch.'))}
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3">
                {invoiceFilter !== 'proforma' && (
                  <button
                    type="button"
                    onClick={handleCreateTaxInvoice}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Create Final Invoice</span>
                  </button>
                )}
                {invoiceFilter !== 'tax' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(buildFormDataFromQuote(null, proformaInvoices));
                      setViewMode('create');
                    }}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Proforma</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredInvoices.map((inv) => {
                const isTaxDoc = inv.isTaxInvoice || inv.documentType === 'Tax Invoice';
                const advAmt = isTaxDoc 
                  ? (inv.advancePaid !== undefined ? inv.advancePaid : 0)
                  : (inv.advancePayable || Math.round((inv.grandTotal || 0) * (((inv.advancePercent === 50 ? 75 : inv.advancePercent) || 75) / 100)));
                const balanceDue = isTaxDoc
                  ? (inv.balanceDue !== undefined ? inv.balanceDue : Math.max(0, (inv.grandTotal || 0) - advAmt))
                  : (inv.balancePayable || Math.max(0, (inv.grandTotal || 0) - advAmt));

                return (
                  <div 
                    key={inv.id || inv.quotationNumber}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 p-3 sm:p-3.5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                      
                      {/* Left Column (32%): Ref No, Document Type Badge, Client Name, Location, Date */}
                      <div className="flex items-center space-x-3 min-w-0 lg:w-[32%]">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs border ${
                          isTaxDoc 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                            : 'bg-purple-50 text-purple-700 border-purple-200/80'
                        }`}>
                          {isTaxDoc ? <Receipt className="w-4 h-4 text-emerald-600" /> : <FileCheck2 className="w-4 h-4 text-purple-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => onViewQuotation(inv)}
                              className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer hover:underline ${
                                isTaxDoc
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200/80 hover:bg-emerald-100'
                                  : 'text-purple-700 bg-purple-50 border-purple-200/80 hover:bg-purple-100'
                              }`}
                              title={`View ${isTaxDoc ? 'Final Invoice' : 'Proforma Invoice'} ${inv.quotationNumber}`}
                            >
                              {inv.quotationNumber || inv.invoiceNo}
                            </button>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${
                              isTaxDoc
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                              {isTaxDoc ? 'FINAL INVOICE' : 'PROFORMA'}
                            </span>
                          </div>
                          <h4 
                            onClick={() => onViewQuotation(inv)}
                            className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5 hover:text-blue-600 transition-colors cursor-pointer"
                            title={inv.clientName}
                          >
                            {inv.clientName || 'Unnamed Customer'}
                          </h4>
                          <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="truncate max-w-[150px]">{inv.placeOfSupply || inv.billingAddress || 'Akola, Maharashtra'}</span>
                            <span>•</span>
                            <span className="font-medium shrink-0">{formatDate(inv.date)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Center Column (26%): Category, References (PO, Quote), Line Items */}
                      <div className="flex flex-col justify-center space-y-1 lg:w-[26%] border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0 text-xs">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Category & Items</span>
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                              inv.category === 'Software' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              inv.category === 'Product' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {inv.category || 'Automation Work'}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {inv.items?.length || 0} item{inv.items?.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-600">
                          {inv.customerPoNo && (
                            <span className="truncate max-w-[150px]">PO: <strong className="font-mono text-slate-800">{inv.customerPoNo}</strong></span>
                          )}
                          {inv.linkedQuotationNumber && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLinkedDocument(inv.linkedQuotationNumber, inv.linkedQuotationId);
                              }}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200/80 font-mono font-bold text-[10px] transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                              title={`View Referenced Quotation ${inv.linkedQuotationNumber}`}
                            >
                              <Link2 className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                              <span>Ref: {inv.linkedQuotationNumber}</span>
                            </button>
                          )}
                          {inv.linkedProformaNumber && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLinkedDocument(inv.linkedProformaNumber, inv.linkedProformaId);
                              }}
                              className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200/80 font-mono font-bold text-[10px] transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
                              title={`View Referenced Proforma ${inv.linkedProformaNumber}`}
                            >
                              <FileCheck2 className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                              <span>Ref PI: {inv.linkedProformaNumber}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Center-Right Column (22%): Advance / Balance Commercial Terms */}
                      <div className="flex flex-col justify-center space-y-0.5 lg:w-[22%] border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0 text-xs">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          {isTaxDoc ? 'Payment Settlement' : 'Commercial Terms'}
                        </span>
                        {isTaxDoc ? (
                          <div className="space-y-0.5">
                            <div className="text-[10px] sm:text-[11px] text-slate-600">
                              Bal Due: <span className="font-bold text-amber-700 font-mono">{formatCurrency(balanceDue)}</span>
                            </div>
                            {advAmt > 0 && (
                              <div className="text-[9px] text-slate-400">
                                Adv Paid: <span className="font-mono font-medium text-emerald-700">{formatCurrency(advAmt)}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-[10px] sm:text-[11px] text-slate-700">
                              Advance ({(inv.advancePercent === 50 ? 75 : inv.advancePercent) || 75}%): <span className="font-bold text-emerald-700 font-mono">{formatCurrency(advAmt)}</span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              Bal on Delivery: <span className="font-mono font-medium">{formatCurrency(balanceDue)}</span>
                            </div>
                          </div>
                        )}
                        <div className="text-[9px] text-slate-400 flex items-center space-x-1 pt-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Valid: {inv.validityDays || 30} days</span>
                        </div>
                      </div>

                      {/* Right Column (20%): Grand Total & Actions */}
                      <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 border-slate-100 pt-2 lg:pt-0 shrink-0 lg:w-[20%]">
                        <div className="text-left lg:text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Grand Total</span>
                          <span className="text-sm sm:text-base font-black text-slate-900 font-mono block">
                            {formatCurrency(inv.grandTotal)}
                          </span>
                          <span className="text-[9px] text-slate-400 block">
                            Taxable: {formatCurrency(inv.totalTaxable || inv.subtotal)}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 mt-1 sm:mt-1.5">
                          {/* View / Print */}
                          <button
                            onClick={() => onViewQuotation(inv)}
                            className="p-1 sm:p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title={`View / Print ${isTaxDoc ? 'Final Invoice' : 'Proforma Invoice'}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => isTaxDoc ? handleEditTaxInvoice(inv) : handleEditProforma(inv)}
                            className="p-1 sm:p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title={`Edit ${isTaxDoc ? 'Final Invoice' : 'Proforma Invoice'}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Convert to Final Tax Invoice (if Proforma) */}
                          {!isTaxDoc && (
                            <button
                              onClick={() => handleConvertToTaxInvoice(inv)}
                              className="p-1 sm:p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Generate Final Invoice for Dispatch"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Share */}
                          <button
                            onClick={() => onShareQuotation(inv)}
                            className="p-1 sm:p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Share with Customer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete ${isTaxDoc ? 'Final Invoice' : 'Proforma Invoice'} ${inv.quotationNumber}?`)) {
                                if (onDeleteQuotation) onDeleteQuotation(inv.id);
                              }
                            }}
                            className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Document"
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
          )}

        </div>
      )}

    </div>
  );
}

export default React.memo(ProformaManager);
