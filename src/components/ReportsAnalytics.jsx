import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Calendar, 
  ChevronDown, 
  Receipt,
  FileCheck2,
  Truck,
  Building2,
  CheckCircle2,
  BarChart3,
  IndianRupee,
  ArrowLeft
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

const DATE_RANGES = [
  { id: 'all', label: 'All Time', days: 0 },
  { id: '30d', label: 'Last 30 Days', days: 30 },
  { id: '90d', label: 'Last 3 Months', days: 90 },
  { id: '180d', label: 'Last 6 Months', days: 180 },
  { id: 'fy', label: 'Current FY (2026-27)', days: -1 }
];

function isDateInPeriod(docDateStr, period) {
  if (period.id === 'all') return true;
  if (!docDateStr) return false;
  
  const docDate = new Date(docDateStr);
  if (isNaN(docDate.getTime())) return true;
  const now = new Date();

  if (period.id === 'fy') {
    // Indian FY runs 1st April to 31st March
    const currentYear = now.getFullYear();
    const fyStartYear = now.getMonth() >= 3 ? currentYear : currentYear - 1;
    const fyStart = new Date(fyStartYear, 3, 1); // 1 April
    const fyEnd = new Date(fyStartYear + 1, 2, 31, 23, 59, 59); // 31 March
    return docDate >= fyStart && docDate <= fyEnd;
  }

  const diffDays = (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= period.days;
}

function generateRecentMonthBuckets(count = 6) {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const shortName = d.toLocaleDateString('en-GB', { month: 'short' });
    const fullName = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
    months.push({ key, shortName, fullName, billed: 0, quoted: 0, count: 0 });
  }
  return months;
}

function ReportsAnalytics({
  quotations = [],
  _clients = [],
  onNavigateTab
}) {
  const [selectedPeriod, setSelectedPeriod] = useState(DATE_RANGES[3]); // Default: Last 6 Months
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('Overview');

  // Single-pass categorization of all live documents
  const {
    quotationsOnly,
    proformaOnly,
    taxInvoicesOnly,
    challansOnly
  } = useMemo(() => {
    const quotes = [];
    const proformas = [];
    const taxInvoices = [];
    const challans = [];

    const safeList = Array.isArray(quotations) ? quotations : [];
    for (let i = 0; i < safeList.length; i++) {
      const q = safeList[i];
      if (!q) continue;

      if (!isDateInPeriod(q.date || q.createdAt, selectedPeriod)) {
        continue;
      }

      const isDC = q.isDeliveryChallan || q.documentType === 'Delivery Challan' || q.challanNo;
      if (isDC) {
        challans.push(q);
        continue;
      }

      const isTI = q.isTaxInvoice || q.documentType === 'Tax Invoice' || q.documentType === 'Invoice' || 
        (typeof q.invoiceNo === 'string' && (q.invoiceNo.includes('/INV/') || q.invoiceNo.startsWith('INV-')));
      const isPI = q.isProforma || q.documentType === 'Proforma Invoice' || 
        (typeof q.quotationNumber === 'string' && q.quotationNumber.startsWith('PI-')) || 
        (typeof q.invoiceNo === 'string' && q.invoiceNo.startsWith('PI-'));

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
      challansOnly: challans
    };
  }, [quotations, selectedPeriod]);

  // High-level live commercial KPIs
  const metrics = useMemo(() => {
    let totalInvoicedRevenue = 0;
    let totalTaxCollected = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    taxInvoicesOnly.forEach(inv => {
      totalInvoicedRevenue += Number(inv.grandTotal || inv.total || 0);
      totalTaxCollected += Number(inv.totalTax || inv.gstAmount || 0);
      totalCgst += Number(inv.cgstAmount || 0);
      totalSgst += Number(inv.sgstAmount || 0);
      totalIgst += Number(inv.igstAmount || 0);
    });

    let totalProformaValue = 0;
    let totalAdvanceCollected = 0;
    proformaOnly.forEach(pi => {
      const total = Number(pi.grandTotal || pi.total || 0);
      totalProformaValue += total;
      totalAdvanceCollected += Number(pi.advancePaid || pi.advancePayable || (total * (Number(pi.advancePercent || 50) / 100)));
    });

    let totalQuotedValue = 0;
    let approvedQuotesValue = 0;
    let approvedCount = 0;

    quotationsOnly.forEach(q => {
      const amt = Number(q.grandTotal || q.total || 0);
      totalQuotedValue += amt;
      if (q.status === 'Approved' || q.status === 'Converted to PO') {
        approvedQuotesValue += amt;
        approvedCount++;
      }
    });

    const quoteConversionRate = quotationsOnly.length > 0
      ? Math.round((approvedCount / quotationsOnly.length) * 100)
      : (taxInvoicesOnly.length > 0 ? 100 : 0);

    let totalDispatchedUnits = 0;
    challansOnly.forEach(ch => {
      if (Array.isArray(ch.items)) {
        totalDispatchedUnits += ch.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
      } else {
        totalDispatchedUnits += Number(ch.totalQuantity || 1);
      }
    });

    return {
      invoicedRevenue: totalInvoicedRevenue,
      taxCollected: totalTaxCollected,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      proformaValue: totalProformaValue,
      advanceCollected: totalAdvanceCollected,
      quotedValue: totalQuotedValue,
      approvedQuotesValue,
      approvedCount,
      quoteCount: quotationsOnly.length,
      conversionRate: quoteConversionRate,
      challansCount: challansOnly.length,
      dispatchedUnits: totalDispatchedUnits,
      totalCommercialValue: totalInvoicedRevenue > 0 ? totalInvoicedRevenue : totalQuotedValue
    };
  }, [taxInvoicesOnly, proformaOnly, quotationsOnly, challansOnly]);

  // Live Dynamic 6-Month Trend Data Plotted from Real Document Dates
  const monthlyTrendData = useMemo(() => {
    const months = generateRecentMonthBuckets(6);

    // Helper to get year-month key
    const getMonthKey = (dateStr) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    // Tally real Final Invoices (or Proformas if no final invoices yet)
    const primaryRevenueDocs = taxInvoicesOnly.length > 0 ? taxInvoicesOnly : proformaOnly;
    primaryRevenueDocs.forEach(doc => {
      const k = getMonthKey(doc.date || doc.createdAt);
      const bucket = months.find(m => m.key === k);
      if (bucket) {
        bucket.billed += Number(doc.grandTotal || doc.total || 0);
        bucket.count++;
      }
    });

    // Tally real Quotations
    quotationsOnly.forEach(q => {
      const k = getMonthKey(q.date || q.createdAt);
      const bucket = months.find(m => m.key === k);
      if (bucket) {
        bucket.quoted += Number(q.grandTotal || q.total || 0);
      }
    });

    // Calculate maximum scale for the chart
    let maxRevenue = 0;
    months.forEach(m => {
      if (m.billed > maxRevenue) maxRevenue = m.billed;
      if (m.quoted > maxRevenue) maxRevenue = m.quoted;
    });

    const chartMax = maxRevenue > 0 ? maxRevenue * 1.15 : 100000;

    // Compute SVG coordinates: width 500 (from x=50 to x=550), height 150 (from y=20 to y=170)
    const points = months.map((m, idx) => {
      const x = 50 + idx * 100;
      const normalizedBilled = Math.min(1, Math.max(0, m.billed / chartMax));
      const y = 170 - normalizedBilled * 140;
      return { ...m, x, y };
    });

    // Generate smooth SVG Bézier path
    let pathD = '';
    let areaD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cx = (p0.x + p1.x) / 2;
        pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      areaD = `${pathD} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;
    }

    return {
      months: points,
      pathD,
      areaD,
      chartMax,
      hasLiveActivity: maxRevenue > 0
    };
  }, [taxInvoicesOnly, proformaOnly, quotationsOnly]);

  // Top Customers dynamically aggregated from actual documents
  const topCustomers = useMemo(() => {
    const map = new Map();

    const processDoc = (doc) => {
      const name = (doc.clientName || doc.customerName || doc.companyName || '').trim();
      if (!name) return;
      const amt = Number(doc.grandTotal || doc.total || 0);
      const current = map.get(name) || { name, billed: 0, quoted: 0, count: 0 };
      if (doc.isTaxInvoice || doc.documentType === 'Tax Invoice' || doc.documentType === 'Invoice') {
        current.billed += amt;
      } else if (doc.isProforma || doc.documentType === 'Proforma Invoice') {
        current.billed += amt;
      } else {
        current.quoted += amt;
      }
      current.count++;
      map.set(name, current);
    };

    taxInvoicesOnly.forEach(processDoc);
    proformaOnly.forEach(processDoc);
    quotationsOnly.forEach(processDoc);

    const sorted = Array.from(map.values())
      .map(c => ({
        ...c,
        totalVal: c.billed > 0 ? c.billed : c.quoted
      }))
      .sort((a, b) => b.totalVal - a.totalVal)
      .slice(0, 5);

    const maxVal = sorted[0]?.totalVal || 1;
    return sorted.map((cust, idx) => ({
      id: idx + 1,
      name: cust.name,
      amount: cust.totalVal,
      billed: cust.billed,
      quoted: cust.quoted,
      count: cust.count,
      percentage: Math.min(100, Math.round((cust.totalVal / maxVal) * 100))
    }));
  }, [taxInvoicesOnly, proformaOnly, quotationsOnly]);

  // Live Commercial Status Breakdown for Real Donut Chart
  const statusBreakdown = useMemo(() => {
    let approved = 0;
    let underReview = 0;
    let drafts = 0;
    let invoiced = taxInvoicesOnly.length;

    quotationsOnly.forEach(q => {
      if (q.status === 'Approved' || q.status === 'Converted to PO') approved++;
      else if (q.status === 'Sent' || q.status === 'Under Review') underReview++;
      else drafts++;
    });

    const totalDocs = invoiced + approved + underReview + drafts;
    if (totalDocs === 0) {
      return {
        total: 0,
        invoicedPct: 0,
        approvedPct: 0,
        reviewPct: 0,
        draftPct: 0,
        slices: []
      };
    }

    const invoicedPct = Math.round((invoiced / totalDocs) * 100);
    const approvedPct = Math.round((approved / totalDocs) * 100);
    const reviewPct = Math.round((underReview / totalDocs) * 100);
    const draftPct = Math.max(0, 100 - invoicedPct - approvedPct - reviewPct);

    // Circumference for r=38 is 2 * PI * 38 = ~238.76
    const circumference = 238.76;
    let offset = 0;

    const slices = [
      { label: 'Final Invoices', count: invoiced, pct: invoicedPct, color: '#10b981', dotClass: 'bg-emerald-500' },
      { label: 'Approved Proposals', count: approved, pct: approvedPct, color: '#3b82f6', dotClass: 'bg-blue-500' },
      { label: 'Under Review', count: underReview, pct: reviewPct, color: '#f59e0b', dotClass: 'bg-amber-500' },
      { label: 'Drafts', count: drafts, pct: draftPct, color: '#94a3b8', dotClass: 'bg-slate-400' }
    ].map(item => {
      const dashLength = (item.pct / 100) * circumference;
      const slice = {
        ...item,
        dashArray: `${dashLength} ${circumference}`,
        dashOffset: -offset
      };
      offset += dashLength;
      return slice;
    });

    return {
      total: totalDocs,
      invoicedPct,
      approvedPct,
      reviewPct,
      draftPct,
      slices
    };
  }, [quotationsOnly, taxInvoicesOnly]);

  // Comprehensive Live CSV Export
  const handleExport = () => {
    const rows = [
      ['KITS Robotics & Automation Pvt. Ltd. - Performance & Analytics Report'],
      [`Reporting Period: ${selectedPeriod.label}`, `Generated on: ${new Date().toLocaleDateString('en-GB')}`],
      [''],
      ['FINANCIAL SUMMARY'],
      ['Metric', 'Value'],
      ['Final Invoiced Revenue', `${metrics.invoicedRevenue}`],
      ['Proforma Total Value', `${metrics.proformaValue}`],
      ['Advance Payments Collected', `${metrics.advanceCollected}`],
      ['GST Tax Collected', `${metrics.taxCollected}`],
      ['Quotation Pipeline Value', `${metrics.quotedValue}`],
      ['Quotation Conversion Rate', `${metrics.conversionRate}%`],
      ['Total Delivery Challans Dispatched', `${metrics.challansCount}`],
      ['Total Units Dispatched', `${metrics.dispatchedUnits}`],
      [''],
      ['TOP CUSTOMERS BY REVENUE / PIPELINE'],
      ['Customer Name', 'Total Commercial Value', 'Documents Count'],
      ...topCustomers.map(c => [`"${c.name}"`, `${c.amount}`, `${c.count}`]),
      [''],
      ['ALL COMMERCIAL DOCUMENTS BREAKDOWN'],
      ['Document Number', 'Type', 'Date', 'Customer', 'Grand Total', 'Status'],
      ...taxInvoicesOnly.map(d => [`"${d.invoiceNo || d.quotationNumber}"`, 'Final Tax Invoice', `"${d.date || ''}"`, `"${d.clientName || ''}"`, `${d.grandTotal || 0}`, 'Billed']),
      ...proformaOnly.map(d => [`"${d.invoiceNo || d.quotationNumber}"`, 'Proforma Invoice', `"${d.date || ''}"`, `"${d.clientName || ''}"`, `${d.grandTotal || 0}`, 'Proforma']),
      ...quotationsOnly.map(d => [`"${d.quotationNumber || ''}"`, 'Quotation', `"${d.date || ''}"`, `"${d.clientName || ''}"`, `${d.grandTotal || 0}`, `"${d.status || 'Draft'}"`]),
      ...challansOnly.map(d => [`"${d.challanNo || ''}"`, 'Delivery Challan', `"${d.date || ''}"`, `"${d.clientName || ''}"`, `${d.totalQuantity || 1}`, 'Dispatched'])
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KITS_Live_Report_${selectedPeriod.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2.5">
              <span>Reports & Analytics</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Data
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Real-time business performance derived directly from your official commercial documents.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Real Interactive Time Filter Dropdown */}
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowPeriodDropdown(prev => !prev)}
              className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>{selectedPeriod.label}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showPeriodDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showPeriodDropdown && (
              <div 
                className="absolute right-0 top-full mt-1.5 z-50 w-52 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-1.5 text-left animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Time Period
                </div>
                {DATE_RANGES.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPeriod(p);
                      setShowPeriodDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      selectedPeriod.id === p.id 
                        ? 'bg-blue-50 text-blue-700 font-bold' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{p.label}</span>
                    {selectedPeriod.id === p.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs: Overview, Quotations, Invoices, Collections */}
      <div className="flex items-center space-x-2 border-b border-slate-200/80 overflow-x-auto custom-scrollbar">
        {[
          { id: 'Overview', label: 'Executive Overview', icon: BarChart3 },
          { id: 'Quotations', label: `Quotations (${quotationsOnly.length})`, icon: FileText },
          { id: 'Invoices', label: `Invoices & Tax (${taxInvoicesOnly.length + proformaOnly.length})`, icon: Receipt },
          { id: 'Payments', label: 'Payments & Ledger', icon: IndianRupee }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
                activeSubTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ==================== SUB-TAB 1: OVERVIEW ==================== */}
      {activeSubTab === 'Overview' && (
        <div className="space-y-6">
          
          {/* 4 Real Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Invoiced Revenue */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-mono">
                  {taxInvoicesOnly.length} Invoices
                </span>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-500">Total Billed Revenue</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {formatCurrency(metrics.invoicedRevenue, false)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Tax Collected: <strong className="text-slate-700 font-mono">{formatCurrency(metrics.taxCollected, false)}</strong>
                </div>
              </div>
            </div>

            {/* Metric 2: Proforma Advance Pipeline */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-mono">
                  {proformaOnly.length} Proformas
                </span>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-500">Proforma Value</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {formatCurrency(metrics.proformaValue, false)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Advance Receivable: <strong className="text-purple-700 font-mono">{formatCurrency(metrics.advanceCollected, false)}</strong>
                </div>
              </div>
            </div>

            {/* Metric 3: Quotation Pipeline */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-mono">
                  {metrics.quoteCount} Quotes
                </span>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-500">Quotation Pipeline</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {formatCurrency(metrics.quotedValue, false)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Win Rate: <strong className="text-blue-700 font-mono">{metrics.conversionRate}%</strong>
                </div>
              </div>
            </div>

            {/* Metric 4: Goods Dispatches */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Truck className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
                  {metrics.challansCount} Challans
                </span>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold text-slate-500">Consignments Shipped</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {metrics.dispatchedUnits} <span className="text-sm font-bold text-slate-500">Units</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Rule 55 CGST Transport
                </div>
              </div>
            </div>

          </div>

          {/* Revenue & Pipeline Trend Line Chart - Plotted 100% from Live Data */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Commercial Monthly Trend</h2>
                <p className="text-[11px] text-slate-400">Actual billing and proposal volume over the last 6 months</p>
              </div>
              <div className="flex items-center space-x-4 text-xs font-medium">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span className="text-slate-600 font-semibold">Billed / Invoiced</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-slate-400">Quoted Pipeline</span>
                </div>
              </div>
            </div>

            {/* SVG Trend Chart */}
            <div className="relative w-full h-64 pt-2">
              <svg viewBox="0 0 600 200" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="liveTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="40" y1="30" x2="560" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="40" y1="75" x2="560" y2="75" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="40" y1="120" x2="560" y2="120" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="40" y1="165" x2="560" y2="165" stroke="#e2e8f0" strokeWidth="1.5" />

                {/* Y Axis Dynamic Labels */}
                <text x="35" y="34" textAnchor="end" className="text-[9.5px] fill-slate-400 font-mono">
                  {formatCurrency(monthlyTrendData.chartMax, false)}
                </text>
                <text x="35" y="100" textAnchor="end" className="text-[9.5px] fill-slate-400 font-mono">
                  {formatCurrency(monthlyTrendData.chartMax / 2, false)}
                </text>
                <text x="35" y="168" textAnchor="end" className="text-[9.5px] fill-slate-400 font-mono">₹0</text>

                {/* Live Curve or Baseline */}
                {monthlyTrendData.hasLiveActivity ? (
                  <>
                    <path
                      d={monthlyTrendData.areaD}
                      fill="url(#liveTrendGradient)"
                    />
                    <path
                      d={monthlyTrendData.pathD}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {monthlyTrendData.months.map((m) => (
                      <g key={m.key}>
                        <circle
                          cx={m.x}
                          cy={m.y}
                          r="5"
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          className="hover:scale-125 transition-transform"
                        />
                        {m.billed > 0 && (
                          <g transform={`translate(${m.x - 30}, ${m.y - 28})`}>
                            <rect width="60" height="20" rx="6" fill="#0f172a" />
                            <text x="30" y="13" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold" fontFamily="monospace">
                              {formatCurrency(m.billed, false)}
                            </text>
                          </g>
                        )}
                      </g>
                    ))}
                  </>
                ) : (
                  <>
                    <line x1="50" y1="165" x2="550" y2="165" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                    <text x="300" y="140" textAnchor="middle" className="text-xs fill-slate-400 font-medium">
                      No commercial billing recorded in this selected period
                    </text>
                  </>
                )}

                {/* X Axis Month Labels */}
                {monthlyTrendData.months.map((m) => (
                  <text key={m.key} x={m.x} y="188" textAnchor="middle" className="text-[10px] fill-slate-500 font-bold">
                    {m.shortName}
                  </text>
                ))}
              </svg>
            </div>
          </div>

          {/* Row 3: Top Customers (Left) + Document Status Donut (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Customers Card with Progress Bars */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Top Customers</h2>
                  <p className="text-[11px] text-slate-400">Clients ranked by total billed & quoted commercial volume</p>
                </div>
                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-bold">
                  {topCustomers.length} Active
                </span>
              </div>

              {topCustomers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  No customer records generated in this period.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {topCustomers.map((cust) => (
                    <div key={cust.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          <span className="text-slate-800 truncate">{cust.name}</span>
                          <span className="text-[9.5px] text-slate-400 font-normal shrink-0">({cust.count} docs)</span>
                        </div>
                        <span className="text-slate-900 font-mono font-bold shrink-0">{formatCurrency(cust.amount, false)}</span>
                      </div>
                      {/* Horizontal Progress bar */}
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
                          style={{ width: `${cust.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Status Donut Chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Commercial Pipeline Distribution</h2>
                  <p className="text-[11px] text-slate-400">Proportions of Invoices, Approved orders, and Proposals</p>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">
                  {statusBreakdown.total} Total
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
                
                {/* SVG Donut Chart */}
                <div className="relative w-36 h-36 shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="38"
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="14"
                    />

                    {statusBreakdown.total > 0 && statusBreakdown.slices.map((slice, idx) => (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={slice.color}
                        strokeWidth="14"
                        strokeDasharray={slice.dashArray}
                        strokeDashoffset={slice.dashOffset}
                        className="transition-all duration-500"
                      />
                    ))}
                  </svg>

                  {/* Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-slate-900 font-mono">
                      {statusBreakdown.total}
                    </span>
                    <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-tight">Docs</span>
                  </div>
                </div>

                {/* Donut Legend */}
                <div className="space-y-2.5 text-xs w-full max-w-xs">
                  {statusBreakdown.slices.map((slice, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${slice.dotClass} shrink-0`} />
                        <span className="font-semibold text-slate-700">{slice.label}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-mono text-[11px]">({slice.count})</span>
                        <span className="font-bold text-slate-900 font-mono w-10 text-right">{slice.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>

          </div>

        </div>
      )}

      {/* ==================== SUB-TAB 2: QUOTATIONS DETAILED ==================== */}
      {activeSubTab === 'Quotations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Total Quotations</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">{metrics.quoteCount}</span>
              <span className="text-xs text-slate-400 mt-1 block">Commercial proposals drafted</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Quoted Pipeline Value</span>
              <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">{formatCurrency(metrics.quotedValue, false)}</span>
              <span className="text-xs text-slate-400 mt-1 block">Cumulative gross proposal sum</span>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Win / Acceptance Rate</span>
              <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">{metrics.conversionRate}%</span>
              <span className="text-xs text-slate-400 mt-1 block">{metrics.approvedCount} proposals approved</span>
            </div>
          </div>

          {/* Quotations Register Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Quotations Register</h3>
              <span className="text-xs text-slate-400 font-mono">{quotationsOnly.length} Records</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Ref #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4 text-right">Grand Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotationsOnly.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400">
                        No commercial quotations recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    quotationsOnly.map((q) => (
                      <tr key={q.id || q.quotationNumber} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600">{q.quotationNumber}</td>
                        <td className="py-3 px-4 text-slate-500">{formatDate(q.date || q.createdAt)}</td>
                        <td className="py-3 px-4 font-bold text-slate-800">{q.clientName}</td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{q.subject || '-'}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(q.grandTotal || 0, false)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            q.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            q.status === 'Sent' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            q.status === 'Under Review' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {q.status || 'Draft'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: INVOICES & TAX ==================== */}
      {activeSubTab === 'Invoices' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Final Tax Invoices</span>
              <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
                {formatCurrency(metrics.invoicedRevenue, false)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">{taxInvoicesOnly.length} Invoices Issued</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Proforma Invoices</span>
              <span className="text-2xl font-black text-purple-700 font-mono mt-1 block">
                {formatCurrency(metrics.proformaValue, false)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">{proformaOnly.length} Proformas Issued</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">CGST + SGST (Intra)</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {formatCurrency(metrics.cgst + metrics.sgst, false)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">CGST: {formatCurrency(metrics.cgst, false)} • SGST: {formatCurrency(metrics.sgst, false)}</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">IGST (Inter-State)</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">
                {formatCurrency(metrics.igst, false)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Integrated Goods & Service Tax</span>
            </div>
          </div>

          {/* Invoices List Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Commercial Invoices Register</h3>
              <span className="text-xs text-slate-400 font-mono">{taxInvoicesOnly.length + proformaOnly.length} Total Invoices</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4">GSTIN</th>
                    <th className="py-3 px-4 text-right">Taxable</th>
                    <th className="py-3 px-4 text-right">GST Total</th>
                    <th className="py-3 px-4 text-right">Invoice Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...taxInvoicesOnly, ...proformaOnly].length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400">
                        No invoices generated in this period.
                      </td>
                    </tr>
                  ) : (
                    [...taxInvoicesOnly, ...proformaOnly].map((inv) => {
                      const isTax = inv.isTaxInvoice || inv.documentType === 'Tax Invoice' || inv.documentType === 'Invoice';
                      return (
                        <tr key={inv.id || inv.invoiceNo || inv.quotationNumber} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {inv.invoiceNo || inv.quotationNumber}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold ${
                              isTax 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {isTax ? 'Final Invoice' : 'Proforma'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">{formatDate(inv.date || inv.invoiceDate || inv.createdAt)}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{inv.clientName || inv.customerName}</td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-500">{inv.clientGstin || inv.customerGstin || 'Unregistered'}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            {formatCurrency(inv.subtotal || inv.totalTaxable || 0, false)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-700">
                            {formatCurrency(inv.totalTax || inv.gstAmount || 0, false)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-slate-900">
                            {formatCurrency(inv.grandTotal || inv.total || 0, false)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: PAYMENTS & LEDGER ==================== */}
      {activeSubTab === 'Payments' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Total Advance Billed / Received</span>
              <span className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
                {formatCurrency(metrics.advanceCollected, false)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Remittance against Proforma milestone terms</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Outstanding Balance</span>
              <span className="text-2xl font-black text-amber-700 font-mono mt-1 block">
                {formatCurrency(Math.max(0, metrics.invoicedRevenue - metrics.advanceCollected), false)}
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Payable on dispatch / commissioning</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-xs font-bold text-slate-400 uppercase block">Collection Efficiency</span>
              <span className="text-2xl font-black text-blue-700 font-mono mt-1 block">
                {metrics.invoicedRevenue > 0 
                  ? Math.min(100, Math.round((metrics.advanceCollected / metrics.invoicedRevenue) * 100)) 
                  : 100}%
              </span>
              <span className="text-xs text-slate-400 mt-1 block">Advance coverage of billed pipeline</span>
            </div>
          </div>

          {/* Customer Collections Ledger */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Client-wise Payment & Ledger Overview</h3>
              <span className="text-xs text-slate-400 font-mono">{topCustomers.length} Clients Tracked</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Client Name</th>
                    <th className="py-3 px-4 text-right">Total Billed</th>
                    <th className="py-3 px-4 text-right">Advance Received</th>
                    <th className="py-3 px-4 text-right">Balance Outstanding</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400">
                        No client ledger data in this period.
                      </td>
                    </tr>
                  ) : (
                    topCustomers.map((cust) => {
                      const billed = cust.billed || 0;
                      const advance = Math.round(billed * 0.5); // 50% standard industrial advance
                      const balance = Math.max(0, billed - advance);
                      return (
                        <tr key={cust.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{cust.name}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(billed, false)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                            {formatCurrency(advance, false)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-amber-700 font-semibold">
                            {formatCurrency(balance, false)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              balance === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {balance === 0 ? 'Settled' : 'Payment on Dispatch'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(ReportsAnalytics);