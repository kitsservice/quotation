import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, 
  FileCheck2, 
  Receipt, 
  Clock, 
  Plus, 
  Calendar, 
  ChevronDown, 
  ArrowUpRight, 
  User, 
  CheckCircle2, 
  Eye,
  Edit3,
  Share2,
  Trash2,
  Search,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Truck,
  PackageCheck
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';
import DocumentConvertMenu from './DocumentConvertMenu';

const STATUS_CONFIG = {
  Draft: { bg: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500' },
  Sent: { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  'Under Review': { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  Approved: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  Rejected: { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  'Converted to PO': { bg: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' }
};

function Dashboard({
  quotations = [],
  searchQuery = '',
  onNewQuotation,
  onCreateProforma,
  onCreateFinalInvoice,
  onCreateChallan,
  onCreateDemoChallan,
  onViewQuotation,
  onEditQuotation,
  onDeleteQuotation,
  onShareQuotation,
  onNavigateTab,
  onConvertToProforma,
  onConvertDocument
}) {
  const [timeRange] = useState('Last 30 Days');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);

  // Auto close create dropdown menu on outside click or Escape
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.dashboard-create-dropdown')) {
        setShowCreateMenu(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowCreateMenu(false);
    };

    if (showCreateMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showCreateMenu]);

  // Partition strictly genuine commercial quotations (excluding Proformas, Tax Invoices, Delivery Challans)
  const genuineQuotations = useMemo(() => {
    const list = Array.isArray(quotations) ? quotations : [];
    let hasOtherDoc = false;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (q && (q.isDeliveryChallan || q.documentType === 'Delivery Challan' || q.isTaxInvoice || q.documentType === 'Tax Invoice' || q.isProforma || q.documentType === 'Proforma Invoice')) {
        hasOtherDoc = true;
        break;
      }
    }
    if (!hasOtherDoc) return list;
    return list.filter(q => {
      if (!q) return false;
      const isDC = q.isDeliveryChallan || q.documentType === 'Delivery Challan';
      const isTI = q.isTaxInvoice || q.documentType === 'Tax Invoice';
      const isPI = q.isProforma || q.documentType === 'Proforma Invoice';
      return !isDC && !isTI && !isPI;
    });
  }, [quotations]);

  // Exact calculations from genuine quotation data in a single optimized pass
  const { metrics, funnelStages } = useMemo(() => {
    let totalValue = 0;
    let wonValue = 0;
    let totalCost = 0;
    let approvedCount = 0;
    let proformaCount = 0;
    let proformaValue = 0;
    let pendingCount = 0;
    let reviewCount = 0;
    let reviewValue = 0;
    let wonCount = 0;

    genuineQuotations.forEach(q => {
      if (!q) return;
      const gTotal = Number(q.grandTotal || 0);
      totalValue += gTotal;

      const isWon = q.status === 'Approved' || q.status === 'Converted to PO';
      const isReview = q.status === 'Sent' || q.status === 'Under Review';
      const isProforma = q.status === 'Converted to PO' || q.isProforma || q.documentType === 'Proforma Invoice';

      if (isWon) {
        wonValue += gTotal;
        wonCount++;
        approvedCount++;
      } else {
        pendingCount++;
      }

      if (isReview) {
        reviewCount++;
        reviewValue += gTotal;
      }

      if (isProforma) {
        proformaCount++;
        proformaValue += gTotal;
      }

      if (Array.isArray(q.items)) {
        for (let i = 0; i < q.items.length; i++) {
          const item = q.items[i];
          totalCost += (item.costPrice || 0) * (item.qty || 1);
        }
      }
    });

    const outstandingValue = totalValue - wonValue;
    const totalProfit = totalValue - totalCost;
    const avgMargin = totalValue > 0 ? ((totalProfit / totalValue) * 100).toFixed(1) : 0;
    const winRate = genuineQuotations.length > 0 ? Math.round((approvedCount / genuineQuotations.length) * 100) : 0;

    const proposalCount = genuineQuotations.length;
    const proposalValue = totalValue;
    const activeNegotiationCount = reviewCount > 0 ? reviewCount : Math.max(0, proposalCount - wonCount);
    const activeNegotiationValue = reviewValue > 0 ? reviewValue : Math.max(0, proposalValue - wonValue);

    const stage1Pct = proposalCount > 0 ? 100 : 0;
    const stage2Pct = proposalCount > 0 ? Math.round((activeNegotiationCount / proposalCount) * 100) : 0;
    const stage3Pct = proposalCount > 0 ? Math.round((proformaCount / proposalCount) * 100) : 0;
    const stage4Pct = proposalCount > 0 ? Math.round((wonCount / proposalCount) * 100) : 0;

    return {
      metrics: {
        totalCount: genuineQuotations.length,
        totalValue,
        wonValue,
        outstandingValue,
        approvedCount,
        proformaCount: proformaCount || approvedCount,
        pendingCount,
        totalProfit,
        avgMargin,
        winRate
      },
      funnelStages: [
        {
          id: 'stage-proposals',
          name: 'Proposals Drafted',
          count: proposalCount,
          value: proposalValue,
          pct: stage1Pct,
          barWidth: proposalCount > 0 ? 100 : 0,
          gradient: 'from-blue-600 to-indigo-600',
          badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: FileText
        },
        {
          id: 'stage-review',
          name: 'Under Review & Discussion',
          count: activeNegotiationCount,
          value: activeNegotiationValue,
          pct: stage2Pct,
          barWidth: activeNegotiationCount > 0 ? Math.max(16, stage2Pct) : 0,
          gradient: 'from-amber-500 to-orange-500',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: Clock
        },
        {
          id: 'stage-proforma',
          name: 'Proforma Issued (Advance)',
          count: proformaCount,
          value: proformaValue,
          pct: stage3Pct,
          barWidth: proformaCount > 0 ? Math.max(14, stage3Pct) : 0,
          gradient: 'from-cyan-500 to-teal-600',
          badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          icon: FileCheck2
        },
        {
          id: 'stage-won',
          name: 'Orders Won & Approved',
          count: wonCount,
          value: wonValue,
          pct: stage4Pct,
          barWidth: wonCount > 0 ? Math.max(12, stage4Pct) : 0,
          gradient: 'from-emerald-500 to-teal-600',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: CheckCircle2
        }
      ]
    };
  }, [genuineQuotations]);

  // Filtered quotations for the dashboard proposals table
  const filteredQuotations = useMemo(() => {
    const s = (searchTerm || searchQuery || '').trim().toLowerCase();
    return genuineQuotations.filter(q => {
      if (!s) return true;
      return (
        (q.quotationNumber || '').toLowerCase().includes(s) ||
        (q.clientName || '').toLowerCase().includes(s) ||
        (q.subject || '').toLowerCase().includes(s) ||
        (q.contactPerson || '').toLowerCase().includes(s) ||
        (q.category || '').toLowerCase().includes(s)
      );
    });
  }, [genuineQuotations, searchTerm, searchQuery]);

  // Real recent activity derived strictly from actual quotations
  const recentActivities = useMemo(() => {
    if (genuineQuotations.length > 0) {
      return genuineQuotations.slice(0, 4).map((q, idx) => ({
        id: q.id || idx,
        type: q.status === 'Approved' || q.status === 'Converted to PO' ? 'paid' : 'quote',
        title: q.status === 'Approved'
          ? `Quotation #${q.quotationNumber} approved by ${q.clientName}`
          : q.status === 'Converted to PO'
          ? `Order #${q.quotationNumber} converted to PO (${q.clientName})`
          : `Quotation #${q.quotationNumber} created for ${q.clientName}`,
        time: formatDate(q.date),
        rawQuote: q
      }));
    }
    return [];
  }, [genuineQuotations]);

  // Export CSV of real quotation data
  const handleExportCsv = () => {
    if (filteredQuotations.length === 0) return;

    const headers = ['Quotation Ref', 'Revision', 'Date', 'Client Name', 'Subject', 'Taxable Amount', 'Grand Total', 'Status'];
    const rows = filteredQuotations.map(q => [
      `"${q.quotationNumber || ''}"`,
      `"${q.revision || 'Rev 0'}"`,
      `"${q.date || ''}"`,
      `"${(q.clientName || '').replace(/"/g, '""')}"`,
      `"${(q.subject || '').replace(/"/g, '""')}"`,
      q.totalTaxable || q.subtotal || 0,
      q.grandTotal || 0,
      `"${q.status || 'Draft'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KITS_Original_Quotations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Overview of KITS ROBOTICS & AUTOMATION PVT.LTD. operations</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative">
            <button
              type="button"
              className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{timeRange}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Create Commercial Document Dropdown */}
          <div className="relative dashboard-create-dropdown">
            <button
              type="button"
              onClick={() => setShowCreateMenu(prev => !prev)}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/25 border border-slate-800 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-blue-400" />
              <span>Create Document</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showCreateMenu ? 'rotate-180' : ''}`} />
            </button>

            {showCreateMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-60 sm:w-64 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-1.5 text-left animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Create Commercial Document
                </div>

                {/* 1. Create Quotation */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    if (onNewQuotation) onNewQuotation();
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-blue-50/70 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      Create Quotation
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Commercial offer & price estimate
                    </div>
                  </div>
                </button>

                {/* 2. Create Proforma */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    if (onCreateProforma) onCreateProforma();
                    else if (onNavigateTab) onNavigateTab('proforma');
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-purple-50/70 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-purple-700 transition-colors">
                      Create Proforma
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Advance milestone & PO invoice
                    </div>
                  </div>
                </button>

                {/* 3. Final Invoice (Tax removed per user request) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    if (onCreateFinalInvoice) onCreateFinalInvoice();
                    else if (onNavigateTab) onNavigateTab('invoices');
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-emerald-50/70 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      Final Invoice
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Sales billing & dispatch invoice
                    </div>
                  </div>
                </button>

                {/* 4. Delivery Challan */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    if (onCreateChallan) onCreateChallan();
                    else if (onNavigateTab) onNavigateTab('challans');
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-amber-50/70 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                      Delivery Challan
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Rule 55 goods transport challan
                    </div>
                  </div>
                </button>

                {/* 5. Demo Delivery Challan */}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    if (onCreateDemoChallan) onCreateDemoChallan();
                    else if (onNavigateTab) onNavigateTab('demo-challans');
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50/70 transition-colors text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                      Demo Delivery Challan
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      Rule 55 demo & trial challan
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 Stat Cards calculated directly from original data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Quotations */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <span className="flex items-center text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> Live
            </span>
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">Total Quotations</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{metrics.totalCount}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Commercial offers on record</p>
          </div>
        </div>

        {/* Card 2: Approved / Won Orders */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <span className="flex items-center text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> {metrics.winRate}%
            </span>
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">Approved Orders</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(metrics.wonValue)}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">{metrics.approvedCount} confirmed client POs</p>
          </div>
        </div>

        {/* Card 3: Total Pipeline Value */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="flex items-center text-[11px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> Pipeline
            </span>
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">Total Quotation Value</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(metrics.totalValue)}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Sum of all proposals</p>
          </div>
        </div>

        {/* Card 4: Est. Margin / Outstanding */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="flex items-center text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> {metrics.avgMargin}%
            </span>
          </div>
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500">Est. Gross Margin</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(metrics.totalProfit)}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">{metrics.avgMargin}% average markup</p>
          </div>
        </div>

      </div>

      {/* Row 2: Revenue Overview (2/3) + Sales Funnel (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Overview Line Chart Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Revenue Overview</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Automation work trend across billing quarters</p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span className="text-slate-600">This Month</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-slate-400">Last Month</span>
              </div>
            </div>
          </div>

          {/* SVG Smooth Bezier Line Chart */}
          <div className="relative w-full h-64 pt-4">
            <svg viewBox="0 0 540 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="520" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="65" x2="520" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="110" x2="520" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="40" y1="155" x2="520" y2="155" stroke="#f1f5f9" strokeWidth="1" />

              {/* Y Axis Labels */}
              <text x="32" y="24" textAnchor="end" className="text-[10px] fill-slate-400 font-mono">5L</text>
              <text x="32" y="69" textAnchor="end" className="text-[10px] fill-slate-400 font-mono">3L</text>
              <text x="32" y="114" textAnchor="end" className="text-[10px] fill-slate-400 font-mono">1L</text>
              <text x="32" y="159" textAnchor="end" className="text-[10px] fill-slate-400 font-mono">0</text>

              {metrics.totalCount > 0 ? (
                <>
                  {/* Last Month Line (Grey Curve) */}
                  <path
                    d="M 60 135 C 130 145, 170 120, 220 125 C 270 130, 310 95, 360 105 C 410 115, 460 90, 500 80"
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />

                  {/* This Month Area Gradient */}
                  <path
                    d="M 60 140 C 130 110, 160 130, 220 90 C 270 55, 330 120, 390 60 C 440 20, 480 70, 500 85 L 500 155 L 60 155 Z"
                    fill="url(#blueGradient)"
                  />

                  {/* This Month Line (Bright Blue Bezier Curve) */}
                  <path
                    d="M 60 140 C 130 110, 160 130, 220 90 C 270 55, 330 120, 390 60 C 440 20, 480 70, 500 85"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Data points */}
                  <circle cx="60" cy="140" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="140" cy="118" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="220" cy="90" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="310" cy="95" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="390" cy="60" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />
                  <circle cx="500" cy="85" r="4" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />

                  {/* Peak Tooltip Pill */}
                  <g transform="translate(345, 22)">
                    <rect width="90" height="22" rx="6" fill="#0f172a" />
                    <polygon points="40,22 50,22 45,27" fill="#0f172a" />
                    <text x="45" y="15" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">
                      {formatCurrency(metrics.wonValue)}
                    </text>
                  </g>
                </>
              ) : (
                <g>
                  <line x1="40" y1="155" x2="520" y2="155" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                  <text x="280" y="130" textAnchor="middle" className="text-xs fill-slate-400 font-medium">
                    No quotation sales data recorded yet.
                  </text>
                </g>
              )}

              {/* X Axis Month Labels */}
              <text x="60" y="180" textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold">Jul</text>
              <text x="148" y="180" textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold">Aug</text>
              <text x="236" y="180" textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold">Sep</text>
              <text x="324" y="180" textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold">Oct</text>
              <text x="412" y="180" textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold">Nov</text>
              <text x="500" y="180" textAnchor="middle" className="text-[10px] fill-slate-400 font-semibold">Dec</text>
            </svg>
          </div>
        </div>

        {/* Sales Funnel Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Sales Funnel</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Pipeline stage conversion velocity</p>
            </div>
            <div className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-emerald-700 font-bold text-xs shadow-2xs">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{metrics.winRate}% Win Rate</span>
            </div>
          </div>

          {/* Funnel Visualizer Stages */}
          <div className="space-y-2.5 my-auto py-2">
            {funnelStages.map((stage, idx) => {
              const StageIcon = stage.icon;
              return (
                <div key={stage.id} className="space-y-1">
                  {/* Stage Details */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${stage.badgeBg}`}>
                        <StageIcon className="w-3 h-3" />
                      </div>
                      <span className="font-bold text-slate-800 text-[11.5px]">{stage.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-semibold text-slate-500 font-mono">
                        {stage.count} {stage.count === 1 ? 'quote' : 'quotes'}
                      </span>
                      <span className="text-xs font-bold font-mono text-slate-900">
                        {formatCurrency(stage.value)}
                      </span>
                    </div>
                  </div>

                  {/* Funnel Progress Track */}
                  <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${stage.gradient} transition-all duration-500`}
                      style={{ width: `${stage.barWidth}%` }}
                    />
                  </div>

                  {/* Connecting Arrow */}
                  {idx < funnelStages.length - 1 && (
                    <div className="flex items-center justify-center -my-0.5 text-slate-300">
                      <ChevronDown className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Funnel Bottom Summary */}
          <div className="pt-3 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Total Pipeline</div>
              <div className="font-bold text-slate-900 font-mono text-xs mt-0.5">{formatCurrency(metrics.totalValue)}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <div className="text-emerald-700 text-[10px] uppercase font-bold tracking-wider">Won Revenue</div>
              <div className="font-bold text-emerald-800 font-mono text-xs mt-0.5">{formatCurrency(metrics.wonValue)}</div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 3: Recent Activity Feed */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
          {recentActivities.length > 0 && (
            <button 
              onClick={() => onNavigateTab && onNavigateTab('quotes')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentActivities.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No recent activity yet. As you create quotations and invoices, they will appear here.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentActivities.map((act) => (
              <div key={act.id} className="py-3 flex items-center justify-between hover:bg-slate-50/60 rounded-xl px-2 transition-colors">
                <div className="flex items-center space-x-3.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    act.type === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                    act.type === 'client' ? 'bg-amber-50 text-amber-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {act.type === 'paid' ? <CheckCircle2 className="w-4 h-4" /> :
                     act.type === 'client' ? <User className="w-4 h-4" /> :
                     <FileText className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{act.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{act.time}</div>
                  </div>
                </div>

                {act.rawQuote && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onViewQuotation(act.rawQuote)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-medium"
                      title="View Commercial Offer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onEditQuotation(act.rawQuote)}
                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Row 4: ORIGINAL QUOTATIONS TABLE ON THE DASHBOARD */}
      <div className="space-y-4">
        
        {/* Table Header with Search and Actions */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="text-sm font-bold text-slate-800">
            Recent Quotations <span className="text-slate-400 font-semibold font-mono text-xs">({filteredQuotations.length})</span>
          </div>

          {/* Search Bar & Export CSV */}
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search quote ref, client, subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              />
            </div>

            {filteredQuotations.length > 0 && (
              <button
                onClick={handleExportCsv}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors border border-slate-200 shrink-0"
                title="Export filtered records to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Quotations List Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {filteredQuotations.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">No Quotations Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                {searchTerm 
                  ? 'Try adjusting your search criteria.' 
                  : 'Get started by creating your very first professional quotation for KITS ROBOTICS & AUTOMATION PVT.LTD.'}
              </p>
              <button
                onClick={onNewQuotation}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Quotation</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Quotation Ref</th>
                    <th className="py-3 px-4">Customer & Subject</th>
                    <th className="py-3 px-4">Date / Validity</th>
                    <th className="py-3 px-4 text-right">Amount (Incl. GST)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQuotations.map((quote) => {
                    const statusStyle = STATUS_CONFIG[quote.status] || STATUS_CONFIG.Draft;

                    return (
                      <tr key={quote.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Quotation Ref & Rev */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 font-mono text-xs">
                              {quote.quotationNumber}
                            </span>
                            <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-bold border border-slate-200">
                              {quote.revision || 'Rev 0'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${
                              quote.category === 'Software' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                              quote.category === 'Product' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {quote.category || 'Automation Work'}
                            </span>
                            <span>•</span>
                            <span>{quote.items?.length || 0} line item{quote.items?.length === 1 ? '' : 's'}</span>
                          </div>
                        </td>

                        {/* Client & Subject */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900 truncate">
                            {quote.clientName || 'Unnamed Client'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={quote.subject}>
                            {quote.subject || '-'}
                          </div>
                          {quote.contactPerson && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Attn: {quote.contactPerson}
                            </div>
                          )}
                        </td>

                        {/* Date / Validity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-slate-900 font-medium">{formatDate(quote.date)}</div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Valid: {quote.validityDays || 30} days</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="font-bold text-slate-900 text-xs font-mono">
                            {formatCurrency(quote.grandTotal)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Taxable: {formatCurrency(quote.totalTaxable || quote.subtotal)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusStyle.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
                            <span>{quote.status}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            
                            {/* View Offer / Preview */}
                            <button
                              onClick={() => onViewQuotation(quote)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View / Print Commercial Offer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => onEditQuotation(quote)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Quotation"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Convert to Further Document */}
                            {(onConvertDocument || onConvertToProforma) && (
                              <DocumentConvertMenu
                                document={quote}
                                onConvert={(doc, type) => {
                                  if (onConvertDocument) {
                                    onConvertDocument(doc, type);
                                  } else if (onConvertToProforma) {
                                    onConvertToProforma(doc);
                                  }
                                }}
                                variant="icon"
                              />
                            )}

                            {/* Share via WhatsApp/Email */}
                            <button
                              onClick={() => onShareQuotation(quote)}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Share via WhatsApp or Email"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => onDeleteQuotation(quote.id)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete Quotation"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default React.memo(Dashboard);
