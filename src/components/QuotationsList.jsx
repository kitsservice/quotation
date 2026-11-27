import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Eye, 
  Edit3, 
  Trash2, 
  Share2, 
  Clock, 
  Download,
  FileSpreadsheet,
  ChevronDown,
  ArrowLeft
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

function QuotationsList({
  quotations = [],
  searchQuery = '',
  onNewQuotation,
  onViewQuotation,
  onEditQuotation,
  onDeleteQuotation,
  onShareQuotation,
  onConvertToProforma,
  onConvertDocument,
  onNavigateTab
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  const baseQuotations = useMemo(() => {
    const list = Array.isArray(quotations) ? quotations : [];
    let hasOtherDoc = false;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (q && (q.isProforma || q.documentType === 'Proforma Invoice' || q.isTaxInvoice || q.documentType === 'Tax Invoice' || q.isDeliveryChallan || q.documentType === 'Delivery Challan')) {
        hasOtherDoc = true;
        break;
      }
    }
    if (!hasOtherDoc) return list;
    return list.filter(q => 
      !q.isProforma && 
      q.documentType !== 'Proforma Invoice' && 
      !q.isTaxInvoice && 
      q.documentType !== 'Tax Invoice'
    );
  }, [quotations]);

  const categoryCounts = useMemo(() => {
    let automation = 0;
    let product = 0;
    let software = 0;
    for (let i = 0; i < baseQuotations.length; i++) {
      const cat = baseQuotations[i].category;
      if (cat === 'Software') software++;
      else if (cat === 'Product') product++;
      else automation++;
    }
    return { all: baseQuotations.length, automation, product, software };
  }, [baseQuotations]);

  const statusCounts = useMemo(() => {
    let all = baseQuotations.length;
    let draft = 0;
    let underReview = 0;
    let approved = 0;
    let invoiced = 0;
    for (let i = 0; i < baseQuotations.length; i++) {
      const s = baseQuotations[i].status || 'Draft';
      if (s === 'Draft') draft++;
      else if (s === 'Under Review') underReview++;
      else if (s === 'Approved') approved++;
      else if (s === 'Invoiced') invoiced++;
    }
    return { all, draft, underReview, approved, invoiced };
  }, [baseQuotations]);

  const filteredQuotations = useMemo(() => {
    const s = (searchTerm || searchQuery || '').trim().toLowerCase();
    return baseQuotations.filter(q => {
      const cat = q.category || 'Automation Work';
      const matchesCategory = selectedCategory === 'All' || cat === selectedCategory;
      if (!matchesCategory) return false;

      const st = q.status || 'Draft';
      const matchesStatus = selectedStatus === 'All' || st === selectedStatus;
      if (!matchesStatus) return false;

      if (!s) return true;
      return (
        (q.quotationNumber || '').toLowerCase().includes(s) ||
        (q.clientName || '').toLowerCase().includes(s) ||
        (q.subject || '').toLowerCase().includes(s) ||
        (q.contactPerson || '').toLowerCase().includes(s) ||
        cat.toLowerCase().includes(s) ||
        st.toLowerCase().includes(s)
      );
    });
  }, [baseQuotations, searchTerm, searchQuery, selectedCategory, selectedStatus]);

  // Export summary to CSV
  const handleExportCsv = () => {
    if (filteredQuotations.length === 0) return;

    const headers = ['Quotation Ref', 'Category', 'Revision', 'Date', 'Client Name', 'Subject', 'Taxable Amount', 'Grand Total', 'Status'];
    const rows = filteredQuotations.map(q => [
      `"${q.quotationNumber || ''}"`,
      `"${q.category || 'Automation Work'}"`,
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
    link.setAttribute('download', `KITS_Quotations_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Quotations</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Manage, track revisions, and export official commercial offers
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {filteredQuotations.length > 0 && (
            <button
              onClick={handleExportCsv}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-3.5 py-2 rounded-xl border border-slate-200 transition-colors text-xs shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            onClick={onNewQuotation}
            className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 transition-all active:scale-95 text-xs shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quotation</span>
          </button>
        </div>
      </div>

      {/* Category Dropdown, Status Filter & Search Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Dropdown Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Category:</span>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer appearance-none focus:border-blue-500 focus:bg-white transition-all"
              >
                <option value="All">All Categories ({categoryCounts.all})</option>
                <option value="Automation Work">Automation Work ({categoryCounts.automation})</option>
                <option value="Product">Product ({categoryCounts.product})</option>
                <option value="Software">Software ({categoryCounts.software})</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ref, client, category, subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
            />
          </div>
        </div>

        {/* Quick Status Filter Tabs including DRAFTS */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-2 border-t border-slate-100 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedStatus('All')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedStatus === 'All'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            All Statuses ({statusCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('Draft')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedStatus === 'Draft'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
            <span>Drafts ({statusCounts.draft})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('Under Review')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedStatus === 'Under Review'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span>Under Review ({statusCounts.underReview})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('Approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedStatus === 'Approved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Approved ({statusCounts.approved})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatus('Invoiced')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
              selectedStatus === 'Invoiced'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
            <span>Invoiced ({statusCounts.invoiced})</span>
          </button>
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
  );
}

export default React.memo(QuotationsList);
