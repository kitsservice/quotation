import React, { useRef, useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  Share2, 
  Edit3, 
  FileCheck2,
  CreditCard
} from 'lucide-react';
import { formatNumber, formatDate } from '../utils/formatters';
import { numberToIndianWords } from '../utils/numberToWords';
import { exportToPdf, printDocument } from '../services/pdfGenerator';
import { KitsDocumentHeader, KitsDocumentFooter } from './KitsHeaderFooter';
import { HARDWARE_DEFAULT_EXCLUSIONS, SOFTWARE_DEFAULT_EXCLUSIONS, SOFTWARE_DEFAULT_TERMS } from '../utils/gstHelper';

const parsedTermsCache = new Map();

function parseTermsLines(termsText) {
  if (!termsText) return [];
  const cached = parsedTermsCache.get(termsText);
  if (cached !== undefined) return cached;

  const rawLines = String(termsText).split('\n').filter(l => l.trim().length > 0);
  const parsed = rawLines.map(line => {
    const numColonMatch = line.match(/^(\d+[.)]\s*|•\s*)([^:]+)(:\s*)(.*)$/);
    if (numColonMatch) {
      return { type: 1, prefix: numColonMatch[1], label: numColonMatch[2], rest: numColonMatch[4] };
    }
    const numMatch = line.match(/^(\d+[.)]\s*|•\s*)(.*)$/);
    if (numMatch) {
      return { type: 2, prefix: numMatch[1], rest: numMatch[2] };
    }
    const colonMatch = line.match(/^([^:]+)(:\s*)(.*)$/);
    if (colonMatch) {
      return { type: 3, label: colonMatch[1], rest: colonMatch[3] };
    }
    return { type: 4, line };
  });

  if (parsedTermsCache.size > 100) parsedTermsCache.clear();
  parsedTermsCache.set(termsText, parsed);
  return parsed;
}

const FormattedTermsList = React.memo(function FormattedTermsList({ termsText }) {
  if (!termsText) return null;
  const parsedLines = parseTermsLines(termsText);

  return (
    <div className="space-y-1.5 text-slate-800 text-xs sm:text-[12px] leading-relaxed">
      {parsedLines.map((item, idx) => {
        if (item.type === 1) {
          return (
            <div key={idx} className="flex items-start text-left">
              <span className="font-bold text-slate-950 shrink-0 w-5 select-none">{item.prefix}</span>
              <div className="flex-1 leading-snug">
                <span className="font-bold text-slate-950">{item.label}: </span>
                <span className="text-slate-800 font-normal">{item.rest}</span>
              </div>
            </div>
          );
        }
        if (item.type === 2) {
          return (
            <div key={idx} className="flex items-start text-left">
              <span className="font-bold text-slate-950 shrink-0 w-5 select-none">{item.prefix}</span>
              <div className="flex-1 leading-snug text-slate-800 font-normal">
                {item.rest}
              </div>
            </div>
          );
        }
        if (item.type === 3) {
          return (
            <div key={idx} className="leading-snug">
              <span className="font-bold text-slate-950">{item.label}: </span>
              <span className="text-slate-800 font-normal">{item.rest}</span>
            </div>
          );
        }
        return (
          <div key={idx} className="leading-snug text-slate-800 font-normal">
            {item.line}
          </div>
        );
      })}
    </div>
  );
});

function KitsBankDetailsBox({ companySettings, title = 'Official Banking Coordinates (For Direct RTGS / NEFT Remittance)' }) {
  return (
    <div className="border border-blue-900/80 bg-blue-50/40 px-3.5 py-2.5 rounded-xl shadow-2xs space-y-2">
      <div className="font-bold text-[10.5px] uppercase tracking-wider text-blue-950 flex items-center justify-between border-b border-blue-200/80 pb-1.5">
        <span className="flex items-center space-x-1.5">
          <CreditCard className="w-3.5 h-3.5 text-blue-700" />
          <span>{title}</span>
        </span>
        <span className="text-[9px] bg-blue-600 text-white font-mono px-1.5 py-0.5 rounded font-bold tracking-wide">
          CURRENT ACCOUNT
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div>
          <span className="text-slate-500 font-medium text-[9.5px] sm:text-[10px] block leading-tight">Beneficiary Account Name:</span>
          <span className="font-bold text-slate-950 text-xs sm:text-[12.5px] block leading-tight whitespace-nowrap">{companySettings?.bankAccountName || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium text-[9.5px] sm:text-[10px] block leading-tight">Bank Name & Branch:</span>
          <span className="font-bold text-slate-950 text-xs sm:text-[12.5px] block leading-tight">{companySettings?.bankName || 'CITY UNION BANK'}, {companySettings?.branch || 'Akola Branch'}</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium text-[9.5px] sm:text-[10px] block leading-tight">Current Account Number:</span>
          <span className="font-mono font-black text-blue-950 text-xs sm:text-sm block leading-tight">{companySettings?.accountNumber || '510909010369706'}</span>
        </div>
        <div>
          <span className="text-slate-500 font-medium text-[9.5px] sm:text-[10px] block leading-tight">RTGS / NEFT IFSC Code:</span>
          <span className="font-mono font-black text-blue-950 text-xs sm:text-sm block leading-tight">{companySettings?.ifscCode || 'CIUB0000800'}</span>
        </div>
      </div>
    </div>
  );
}

function KitsSignatoryBlock({ companySettings, noteText = null }) {
  return (
    <div className="pt-6 sm:pt-8 flex justify-between items-end">
      <div className="space-y-1 max-w-sm">
        {noteText && (
          <p className="font-medium text-slate-900 text-xs sm:text-[13px]">
            {noteText}
          </p>
        )}
        <p className="text-[11px] text-slate-600">
          Subject to Akola Jurisdiction • E. & O.E.
        </p>
      </div>

      <div className="text-right">
        <div className="font-bold text-xs sm:text-sm tracking-tight text-[#0f245c] uppercase mb-12 whitespace-nowrap">
          For {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}
        </div>
        <div className="w-48 border-b border-black ml-auto mb-1"></div>
        <div className="text-xs font-bold text-slate-900">
          {companySettings?.signatoryDesignation || 'Authorized Signatory / Director'}
        </div>
      </div>
    </div>
  );
}

function QuotationPreview({
  quotation,
  companySettings,
  onBack,
  onEdit,
  onShare,
  onConvertToProforma
}) {
  const [isExporting, setIsExporting] = useState(false);
  const printAreaRef = useRef(null);

  const safeQuotation = quotation || {};
  const isTaxInvoiceDoc = safeQuotation.documentType === 'Tax Invoice' || safeQuotation.isTaxInvoice;
  const isProformaDoc = !isTaxInvoiceDoc && (safeQuotation.documentType === 'Proforma Invoice' || safeQuotation.isProforma);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const prefix = isTaxInvoiceDoc ? 'KITS_Tax_Invoice_' : (isProformaDoc ? 'KITS_Proforma_' : 'KITS_Quotation_');
      const sanitizedNumber = (safeQuotation.quotationNumber || 'Document').replace(/[/\\]/g, '_');
      const filename = `${prefix}${sanitizedNumber}.pdf`;
      await exportToPdf('printable-quotation', filename);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Error generating PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    printDocument();
  };

  const isSoftware = safeQuotation.category === 'Software' || 
    safeQuotation.categoryName?.includes('SOFTWARE') ||
    (Array.isArray(safeQuotation.items) && safeQuotation.items.some(it => {
      const code = String(it.hsn || it.hsnCode || '');
      return code.startsWith('9983') || code.startsWith('9973');
    }));

  const displayPhone = useMemo(() => {
    const raw = companySettings?.phone || '9823042432 / 9453536807';
    if (isSoftware) {
      const cleaned = raw
        .replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[/\s,-]+|[/\s,-]+$/g, '')
        .trim();
      return cleaned || '9823042432';
    }
    return raw;
  }, [companySettings?.phone, isSoftware]);

  // Normalized item list supporting both Quotation fields (title, unitPrice) and Proforma fields (name, rate)
  const items = useMemo(() => {
    const rawItems = Array.isArray(safeQuotation.items) ? safeQuotation.items : [];
    return rawItems.map((item, idx) => {
      const qty = parseFloat(item.qty) || 1;
      const rate = parseFloat(item.unitPrice !== undefined && !isNaN(item.unitPrice) ? item.unitPrice : (item.rate || 0));
      const disc = parseFloat(item.discountPercent !== undefined ? item.discountPercent : (item.discount || 0));
      const base = qty * rate;
      const discAmt = (base * disc) / 100;
      const calculatedTaxable = Math.max(0, Math.round(base - discAmt));
      
      const taxableAmount = item.taxableAmount !== undefined && !isNaN(item.taxableAmount)
        ? parseFloat(item.taxableAmount)
        : (item.amount !== undefined && !isNaN(item.amount) ? parseFloat(item.amount) : calculatedTaxable);

      return {
        id: item.id || `item-${idx}`,
        title: item.title || item.name || (isSoftware ? 'Software Solution' : 'Equipment / Automation Work'),
        description: item.description || '',
        hsn: isSoftware ? '' : (item.hsnCode || item.hsn || ''),
        unit: isSoftware ? '' : (item.unit || ''),
        qty,
        unitPrice: rate,
        discountPercent: disc,
        taxableAmount
      };
    });
  }, [safeQuotation.items, isSoftware]);

  const totalQty = useMemo(() => items.reduce((sum, item) => sum + item.qty, 0), [items]);
  const totalTaxable = useMemo(() => items.reduce((sum, item) => sum + item.taxableAmount, 0), [items]);

  // Tax calculations
  const hasTax = safeQuotation.applyTax !== undefined 
    ? Boolean(safeQuotation.applyTax) 
    : (safeQuotation.hasTax !== undefined 
        ? Boolean(safeQuotation.hasTax) 
        : (!isSoftware && (Number(safeQuotation.cgst) > 0 || Number(safeQuotation.sgst) > 0 || Number(safeQuotation.igst) > 0 || Number(safeQuotation.taxAmount) > 0)));

  const isIntraState = safeQuotation.isIntraState !== undefined 
    ? safeQuotation.isIntraState 
    : (safeQuotation.clientState ? safeQuotation.clientState.toLowerCase().includes('maharashtra') : true);

  const cgstVal = hasTax ? (safeQuotation.cgst !== undefined 
    ? safeQuotation.cgst 
    : (safeQuotation.cgstAmount !== undefined ? safeQuotation.cgstAmount : (isIntraState ? Math.round(totalTaxable * 0.09) : 0))) : 0;

  const sgstVal = hasTax ? (safeQuotation.sgst !== undefined 
    ? safeQuotation.sgst 
    : (safeQuotation.sgstAmount !== undefined ? safeQuotation.sgstAmount : (isIntraState ? Math.round(totalTaxable * 0.09) : 0))) : 0;

  const igstVal = hasTax ? (safeQuotation.igst !== undefined 
    ? safeQuotation.igst 
    : (safeQuotation.igstAmount !== undefined ? safeQuotation.igstAmount : (!isIntraState ? Math.round(totalTaxable * 0.18) : 0))) : 0;

  const grandTotal = hasTax 
    ? (safeQuotation.grandTotal || (totalTaxable + (isIntraState ? (cgstVal + sgstVal) : igstVal)))
    : totalTaxable;

  const rawAdvPercent = safeQuotation.advancePercent;
  const advancePercent = rawAdvPercent === 50 ? 75 : (rawAdvPercent || 75);
  const advanceAmount = safeQuotation.advancePaid !== undefined 
    ? parseFloat(safeQuotation.advancePaid) || 0 
    : (safeQuotation.advancePayable !== undefined 
        ? (rawAdvPercent === 50 ? Math.round((grandTotal * 75) / 100) : parseFloat(safeQuotation.advancePayable) || 0)
        : Math.round((grandTotal * advancePercent) / 100));
  const balanceAmount = safeQuotation.balanceDue !== undefined 
    ? (rawAdvPercent === 50 ? Math.max(0, grandTotal - advanceAmount) : parseFloat(safeQuotation.balanceDue) || 0)
    : Math.max(0, grandTotal - advanceAmount);

  const exclusionsList = Array.isArray(safeQuotation.notesExclusions) && safeQuotation.notesExclusions.length > 0
    ? safeQuotation.notesExclusions
    : (isSoftware ? SOFTWARE_DEFAULT_EXCLUSIONS : HARDWARE_DEFAULT_EXCLUSIONS);

  return (
    <div className="space-y-6 pb-20">
      
      {/* Top Action Toolbar (Hidden during print) */}
      <div className="no-print bg-white px-5 py-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 max-w-5xl mx-auto">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer border border-slate-200/80 shrink-0"
            title="Back to Previous View"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 font-mono text-sm sm:text-base">
                {safeQuotation.quotationNumber || 'Document'}
              </span>
              <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {isTaxInvoiceDoc ? 'TAX INV' : (safeQuotation.revision || (isProformaDoc ? 'PI' : 'Rev 0'))}
              </span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-semibold border border-emerald-200">
                {isTaxInvoiceDoc ? 'Final Invoice Issued' : (isProformaDoc ? 'Proforma Issued' : (safeQuotation.status || 'Approved'))}
              </span>
            </div>
            {safeQuotation.clientName && (
              <p className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                {safeQuotation.clientName} {safeQuotation.subject ? `• ${safeQuotation.subject}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Compact Action Buttons */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            title="Print Document"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Download Official PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={() => onShare(safeQuotation)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
            title="Share via WhatsApp or Email"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          {!isProformaDoc && !isTaxInvoiceDoc && onConvertToProforma && (
            <button
              onClick={() => onConvertToProforma(safeQuotation)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              title="Generate Linked Proforma Invoice"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Proforma</span>
            </button>
          )}

          <button
            onClick={() => onEdit(safeQuotation)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            title="Edit Document"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
        </div>
      </div>

      {/* Main Printable Sheets Container */}
      <div id="printable-quotation" ref={printAreaRef} className="w-full overflow-x-auto py-2 flex flex-col items-center">
        
        {isTaxInvoiceDoc ? (
          /* ============================================================== */
          /* FINAL TAX INVOICE: 2-PAGE OFFICIAL KITS STANDARD               */
          /* ============================================================== */
          <>
            {/* PAGE 1: STATUTORY TAX INVOICE & MACHINERY BREAKDOWN */}
            <div className="a4-sheet text-slate-900 font-sans text-xs sm:text-[11.5px] leading-normal" id="tax-invoice-page-1">
              
              {/* Official Header */}
              <KitsDocumentHeader companySettings={companySettings} />

              <div className="flex-1 py-1 space-y-2">
                {/* Title & Document Status Banner */}
                <div className="text-center my-0.5 border-b border-black pb-1">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[9px] sm:text-[9.5px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                      ORIGINAL FOR RECIPIENT
                    </span>
                    <span className="text-[9.5px] sm:text-[10px] font-bold text-[#0f245c] uppercase tracking-wider font-mono">
                      {hasTax 
                        ? (isSoftware ? 'TAX INVOICE • SOFTWARE & IT SERVICES' : 'TAX INVOICE • AUTOMATION WORK')
                        : (isSoftware ? 'INVOICE • SOFTWARE & IT SERVICES' : 'INVOICE • AUTOMATION WORK')}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase">
                    {hasTax ? 'TAX INVOICE' : 'INVOICE'}
                  </h2>
                  {hasTax && (
                    <p className="text-[9px] sm:text-[9.5px] text-slate-600 font-semibold tracking-wider uppercase mt-0.5">
                      (Issued under Section 31 of CGST Act, 2017 &amp; Rule 46 of CGST Rules, 2017)
                    </p>
                  )}
                </div>

                {/* Structured Professional 2-Column Metadata Grid */}
                <div className="border border-black grid grid-cols-2 text-xs sm:text-[11px] divide-x divide-black bg-white my-1">
                  
                  {/* Left Column: Supplier & Billed To (Buyer) Details */}
                  <div className="p-2 space-y-2">
                    <div>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">From (Supplier / Issuer):</div>
                      <div className="font-bold text-slate-950 text-xs sm:text-[11.5px] leading-tight whitespace-nowrap">
                        {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}, {companySettings?.city || 'Akola'}
                      </div>
                      <div className="text-slate-800 text-[10px] leading-tight mt-0.5">
                        GSTIN: <span className="font-mono font-semibold">{companySettings?.gstin || '27AAMCK1536C1ZP'}</span> • PAN: <span className="font-mono font-semibold">{companySettings?.pan || 'AAMCK1536C'}</span> • State: {companySettings?.state || 'Maharashtra'}
                      </div>
                      <div className="text-slate-800 text-[10px]">Mobile: {displayPhone}</div>
                    </div>

                    <div className="border-t border-slate-300 pt-1.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-[#0f245c]">Billed To (Buyer / Recipient):</div>
                      <div className="font-bold text-slate-900 text-xs sm:text-[12px]">{safeQuotation.clientName || 'Valued Customer'}</div>
                      {safeQuotation.billingAddress && (
                        <div className="text-slate-800 text-[10.5px] whitespace-pre-line leading-snug">{safeQuotation.billingAddress}</div>
                      )}
                      <div className="text-slate-800 text-[10px] font-mono mt-0.5">
                        GSTIN / UIN: <span className="font-bold text-slate-950">{safeQuotation.clientGstin || 'Unregistered / Consumer'}</span>
                      </div>
                      {safeQuotation.shippingAddress && safeQuotation.shippingAddress !== safeQuotation.billingAddress && (
                        <div className="mt-1 pt-1 border-t border-slate-200">
                          <span className="text-[8.5px] font-bold uppercase text-slate-500 block">Shipped To / Consignee:</span>
                          <span className="text-[10px] text-slate-800">{safeQuotation.shippingAddress}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Invoice Coordinates & Delivery Particulars */}
                  <div className="p-2 space-y-1.5 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline border-b border-slate-200 pb-0.5">
                        <span className="text-slate-600 font-medium text-[10px] uppercase">{hasTax ? 'Tax Invoice No:' : 'Invoice No:'}</span>
                        <span className="font-bold font-mono text-slate-950 text-xs sm:text-[11.5px]">{safeQuotation.quotationNumber}</span>
                      </div>
                      <div className="flex justify-between items-baseline border-b border-slate-200 pb-0.5">
                        <span className="text-slate-600 font-medium text-[10px] uppercase">Invoice Date:</span>
                        <span className="font-bold text-slate-950">{formatDate(safeQuotation.date)}</span>
                      </div>
                      {safeQuotation.linkedProformaNumber && (
                        <div className="flex justify-between items-baseline border-b border-slate-200 pb-0.5">
                          <span className="text-slate-600 font-medium text-[10px] uppercase">Ref Proforma (PI):</span>
                          <span className="font-mono font-bold text-purple-700">{safeQuotation.linkedProformaNumber}</span>
                        </div>
                      )}
                      {safeQuotation.customerPoNo && (
                        <div className="flex justify-between items-baseline border-b border-slate-200 pb-0.5">
                          <span className="text-slate-600 font-medium text-[10px] uppercase">Customer PO:</span>
                          <span className="font-mono font-bold text-slate-950">{safeQuotation.customerPoNo}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline border-b border-slate-200 pb-0.5">
                        <span className="text-slate-600 font-medium text-[10px] uppercase">Place of Supply:</span>
                        <span className="font-bold text-slate-950">{(safeQuotation.placeOfSupply || 'Maharashtra').replace(/^\d+\s*[-–]\s*|\s*\(\d+\)$/g, '').trim()}</span>
                      </div>
                    </div>

                    {/* Software vs Physical Logistics Sub-block */}
                    <div className="bg-slate-50 border border-slate-300 rounded p-1.5 mt-1 text-[10px]">
                      {isSoftware ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">Delivery Mode:</span>
                            <span className="font-bold text-blue-900">Electronic / Remote</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">Service Type:</span>
                            <span className="font-bold text-slate-950">Software &amp; IT Services</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">Deployment Date:</span>
                            <span className="font-medium text-slate-950">{safeQuotation.dispatchDate ? formatDate(safeQuotation.dispatchDate) : formatDate(safeQuotation.date)}</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">Freight / Cargo:</span>
                            <span className="font-bold text-emerald-800">NIL (Digital Transfer)</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">E-Way Bill No:</span>
                            <span className="font-mono font-bold text-slate-950">{safeQuotation.ewayBillNo || '-'}</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">Vehicle No:</span>
                            <span className="font-mono font-bold text-slate-950">{safeQuotation.vehicleNo || '-'}</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">Transporter:</span>
                            <span className="font-medium text-slate-950">{safeQuotation.transporterName || safeQuotation.modeOfTransport || 'By Road'}</span>
                          </div>
                          <div>
                            <span className="block text-slate-500 font-bold uppercase text-[8.5px]">LR / GR No. &amp; Date:</span>
                            <span className="font-mono font-bold text-slate-950">
                              {safeQuotation.lrNo ? `${safeQuotation.lrNo} ${safeQuotation.lrDate ? '(' + formatDate(safeQuotation.lrDate) + ')' : ''}` : '-'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Machinery & Automation Items Table */}
                <div className="border border-black overflow-hidden my-1">
                  <table className="w-full text-left text-xs sm:text-[11px] border-collapse">
                    <thead>
                      <tr className="border-b border-black font-bold text-slate-900 bg-slate-100">
                        <th className="py-1 px-2 text-center w-8 border-r border-black">Sr</th>
                        <th className="py-1 px-3 border-r border-black">{isSoftware ? 'Description of Software Solutions / Services' : 'Description of Goods / Automation Work'}</th>
                        {!isSoftware && (
                          <th className="py-1 px-2 text-center w-20 border-r border-black">HSN/SAC</th>
                        )}
                        <th className="py-1 px-2 text-center w-14 border-r border-black">Qty</th>
                        <th className="py-1 px-2 text-right w-20 border-r border-black">Rate (₹)</th>
                        <th className="py-1 px-3 text-right w-24">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Category Header Row */}
                      <tr className="border-b border-black font-bold text-slate-900 bg-slate-50/70">
                        <td className="py-1 px-2 text-center border-r border-black font-bold text-slate-600">A</td>
                        <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 uppercase text-[10px] font-bold text-[#0f245c] tracking-wider">
                          {isSoftware ? 'SOFTWARE SOLUTIONS & IT SERVICES' : (safeQuotation.categoryName || 'INDUSTRIAL AUTOMATION WORK')}
                        </td>
                      </tr>

                      {items.map((item, index) => (
                        <tr key={item.id || index} className="border-b border-black">
                          <td className="py-1.5 px-2 text-center border-r border-black font-semibold text-slate-600">{index + 1}</td>
                          <td className="py-1.5 px-3 border-r border-black font-medium text-slate-950">
                            <div className="font-bold">{item.title}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-600 leading-snug mt-0.5">{item.description}</div>
                            )}
                          </td>
                          {!isSoftware && (
                            <td className="py-1.5 px-2 text-center border-r border-black font-mono font-medium text-slate-700">
                              {item.hsn}
                            </td>
                          )}
                          <td className="py-1.5 px-2 text-center border-r border-black font-bold text-slate-900">
                            {item.qty}{(!isSoftware && item.unit) ? ` ${item.unit}` : ''}
                          </td>
                          <td className="py-1.5 px-2 text-right border-r border-black font-mono font-medium text-slate-900">
                            {formatNumber(item.unitPrice, 0)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-950">
                            {formatNumber(item.taxableAmount, 0)}
                          </td>
                        </tr>
                      ))}

                      {/* Taxable Total / Subtotal */}
                      <tr className="border-t border-black font-semibold text-slate-800 bg-slate-50/50">
                        <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">
                          {hasTax ? 'Total Taxable Value:' : 'Subtotal (Total Amount):'}
                        </td>
                        <td className="py-1 px-3 text-right font-mono font-bold text-slate-900">
                          {formatNumber(totalTaxable, 0)}
                        </td>
                      </tr>

                      {/* GST Split (Rendered only when hasTax is true) */}
                      {hasTax && (
                        isIntraState ? (
                          <>
                            <tr className="border-t border-slate-200 text-slate-800">
                              <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Add: CGST @ 9%:</td>
                              <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900">
                                {formatNumber(cgstVal, 0)}
                              </td>
                            </tr>
                            <tr className="border-t border-slate-200 text-slate-800">
                              <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Add: SGST @ 9%:</td>
                              <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900">
                                {formatNumber(sgstVal, 0)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <tr className="border-t border-slate-200 text-slate-800">
                            <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Add: IGST @ 18% (Inter-State):</td>
                            <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatNumber(igstVal, 0)}
                            </td>
                          </tr>
                        )
                      )}

                      {/* Grand Total */}
                      <tr className="border-t-2 border-black font-bold text-slate-950 bg-slate-100 text-xs sm:text-[12px]">
                        <td colSpan={isSoftware ? 4 : 5} className="py-1.5 px-3 text-right border-r border-black uppercase font-black">
                          {hasTax ? 'TOTAL TAX INVOICE VALUE (INCL. GST):' : 'TOTAL INVOICE VALUE:'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-black text-slate-950">
                          ₹{formatNumber(grandTotal, 0)}
                        </td>
                      </tr>

                      {/* Integrated Amount in Words Row */}
                      <tr className="border-t border-black bg-slate-50/70 text-[10.5px]">
                        <td colSpan={isSoftware ? 5 : 6} className="py-1.5 px-3">
                          <span className="font-bold text-slate-950 uppercase text-[9px] tracking-wider">Invoice Amount in Words: </span>
                          <span className="font-semibold italic text-slate-900">{safeQuotation.amountInWords || numberToIndianWords(grandTotal)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Statutory Transport Declaration */}
                <div className="pt-0.5 text-[10.5px] text-slate-700">
                  <p className="italic">
                    {isSoftware
                      ? '* Electronic delivery: Software solutions, web applications & licenses are deployed remotely with zero physical freight.'
                      : '* Goods dispatched on buyer’s account. Risk in transit ceases once consignment handed over to carrier/transporter.'}
                  </p>
                </div>

              </div>

              {/* Page 1 Footer */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={isSoftware} />
            </div>

            {/* PAGE 2: PAYMENT RECONCILIATION, STATUTORY DECLARATION & SIGNATORY */}
            <div className="a4-sheet text-slate-900 font-sans text-xs sm:text-[12.5px] leading-normal" id="tax-invoice-page-2">
              
              {/* Official Header */}
              <KitsDocumentHeader companySettings={companySettings} />

              <div className="flex-1 py-3 space-y-5">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase tracking-wide">
                    Payment Reconciliation & Settlement Summary
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    {advanceAmount > 0 
                      ? 'Tax Invoice reconciliation against Advance received via Proforma Invoice.'
                      : 'Commercial Tax Invoice statutory summary and settlement.'}
                  </p>
                </div>

                {/* Payment Reconciliation Box */}
                <div className="border-2 border-slate-900 bg-slate-50/70 p-4 rounded-2xl shadow-xs space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-2 flex justify-between items-center">
                    <span>Commercial Account Settlement</span>
                    <span className="font-mono font-bold text-blue-700">{hasTax ? 'Tax Inv No:' : 'Invoice No:'} {safeQuotation.quotationNumber}</span>
                  </div>

                  <div className="space-y-2 text-xs sm:text-[12.5px]">
                    <div className="flex justify-between items-center text-slate-800">
                      <span className="font-semibold">{hasTax ? 'Gross Tax Invoice Value (Incl. GST):' : 'Gross Invoice Value:'}</span>
                      <span className="font-mono font-bold text-slate-950">₹{formatNumber(grandTotal, 0)}</span>
                    </div>

                    {advanceAmount > 0 ? (
                      <>
                        <div className="flex justify-between items-center text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                          <div>
                            <span className="font-bold">Less: Advance Paid via Proforma Invoice:</span>
                            {safeQuotation.linkedProformaNumber && (
                              <span className="text-[11px] font-mono ml-1.5 font-bold text-purple-700">(Ref: {safeQuotation.linkedProformaNumber})</span>
                            )}
                            {safeQuotation.advanceUtr && (
                              <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                                Payment Ref / UTR: <span className="font-bold">{safeQuotation.advanceUtr}</span> {safeQuotation.advanceDate ? `• Date: ${formatDate(safeQuotation.advanceDate)}` : ''}
                              </div>
                            )}
                          </div>
                          <span className="font-mono font-bold text-emerald-900 text-sm">- ₹{formatNumber(advanceAmount, 0)}</span>
                        </div>

                        <div className="flex justify-between items-center text-slate-950 bg-slate-900 text-white p-3.5 rounded-xl mt-2">
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-300">
                              {isSoftware ? 'NET BALANCE AMOUNT PAYABLE ON HANDOVER / LIVE:' : 'NET BALANCE AMOUNT PAYABLE ON DISPATCH:'}
                            </span>
                            <span className="text-xs italic text-amber-300">
                              {safeQuotation.balanceInWords || numberToIndianWords(balanceAmount)}
                            </span>
                          </div>
                          <span className="font-mono font-black text-xl sm:text-2xl text-amber-400">
                            ₹{formatNumber(balanceAmount, 0)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between items-center text-slate-950 bg-slate-900 text-white p-3.5 rounded-xl mt-2">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider block text-slate-300">
                            TOTAL AMOUNT PAYABLE:
                          </span>
                          <span className="text-xs italic text-amber-300">
                            {safeQuotation.amountInWords || numberToIndianWords(grandTotal)}
                          </span>
                        </div>
                        <span className="font-mono font-black text-xl sm:text-2xl text-amber-400">
                          ₹{formatNumber(grandTotal, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bank Coordinates Box */}
                <KitsBankDetailsBox companySettings={companySettings} title="Official Banking Coordinates (For RTGS / NEFT Remittance)" />

                {/* Statutory Declarations */}
                <div className="space-y-1.5 text-xs sm:text-[12px] text-slate-800 leading-relaxed pl-2 border-l-2 border-slate-300">
                  <div className="font-bold text-slate-900 uppercase text-xs">
                    {isSoftware ? 'Terms & Conditions of Software Service:' : 'Terms & Conditions of Sale:'}
                  </div>
                  {isSoftware ? (
                    <>
                      <p>1. Certified that the particulars given above are true and correct and represent the actual cost for software solutions &amp; cloud deployment.</p>
                      <p>2. Warranty &amp; Maintenance: Bug fixes and defect liability support provided as per the agreed Software Service Level Agreement (SLA).</p>
                      <p>3. Intellectual Property: Source code, production build assets and administrative credentials handed over to the client upon full payment reconciliation.</p>
                      <p>4. Payment terms: Settlement upon handover / deployment. Overdue accounts attract interest @ 18% per annum.</p>
                      <p>5. All disputes are strictly subject to <strong>Akola (Maharashtra) Jurisdiction</strong> only.</p>
                    </>
                  ) : (
                    <>
                      <p>1. Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged.</p>
                      <p>2. Warranty on automation machinery/panels: 12 months from commissioning OR 13 months from date of invoice.</p>
                      <p>3. Goods once sold and dispatched will not be taken back or exchanged.</p>
                      <p>4. Payment terms: Balance amount payable on dispatch/delivery. Overdue accounts attract interest @ 18% per annum.</p>
                      <p>5. All disputes are strictly subject to <strong>Akola (Maharashtra) Jurisdiction</strong> only.</p>
                    </>
                  )}
                </div>

                {/* Sign-off & Authorized Signatory */}
                <KitsSignatoryBlock companySettings={companySettings} />

              </div>

              {/* Page 2 Footer */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={isSoftware} />
            </div>
          </>
        ) : isProformaDoc ? (
          /* ============================================================== */
          /* PROFORMA INVOICE: 2-PAGE OFFICIAL KITS STANDARD                */
          /* ============================================================== */
          <>
            {/* PAGE 1: COMMERCIAL TAX INVOICE & MACHINERY BREAKDOWN */}
            <div className="a4-sheet text-slate-900 font-sans text-xs sm:text-[12.5px] leading-normal" id="proforma-page-1">
              
              {/* Official Header */}
              <KitsDocumentHeader companySettings={companySettings} />

              <div className="flex-1 py-1 space-y-3">
                {/* Title: PROFORMA INVOICE */}
                <div className="text-center my-1.5 border-b border-black pb-1.5">
                  <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase">
                    PROFORMA INVOICE
                  </h2>
                  <p className="text-[10px] text-slate-600 font-semibold tracking-wider uppercase mt-0.5">
                    (Statutory Tax Invoice will be issued upon dispatch • Commercial Advance Remittance Copy)
                  </p>
                </div>

                {/* Metadata Grid */}
                <div className="flex justify-between items-start text-xs sm:text-[12px]">
                  {/* Left: Seller & Buyer Info */}
                  <div className="space-y-2.5 max-w-[55%]">
                    <div>
                      <span className="font-semibold text-slate-800">From:</span>
                      <div className="font-bold text-slate-950 whitespace-nowrap">
                        {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}, {companySettings?.city || 'Akola'}
                      </div>
                      <div className="text-slate-800 text-[11px] mt-0.5">
                        GSTIN: <span className="font-mono font-semibold">{companySettings?.gstin || '27AAMCK1536C1ZP'}</span>
                      </div>
                      <div className="text-slate-800">Mobile: {displayPhone}</div>
                    </div>

                    <div>
                      <div className="font-bold text-slate-950 uppercase text-[11px] text-[#0f245c]">
                        Billed To (Buyer):
                      </div>
                      <div className="font-bold text-slate-900 text-xs sm:text-[13px]">{safeQuotation.clientName || 'Valued Customer'}</div>
                      {safeQuotation.billingAddress && (
                        <div className="text-slate-800 text-[11.5px] whitespace-pre-line leading-snug">{safeQuotation.billingAddress}</div>
                      )}
                      {safeQuotation.clientGstin && (
                        <div className="text-slate-800 text-[11.5px] font-mono font-medium">
                          GSTIN: <span className="font-bold text-slate-950">{safeQuotation.clientGstin}</span>
                        </div>
                      )}
                    </div>

                    {safeQuotation.shippingAddress && safeQuotation.shippingAddress !== safeQuotation.billingAddress && (
                      <div>
                        <div className="font-bold text-slate-950 uppercase text-[10.5px] text-[#0f245c]">
                          Shipped To (Plant Site):
                        </div>
                        <div className="text-slate-800 text-[11px] whitespace-pre-line leading-snug">{safeQuotation.shippingAddress}</div>
                      </div>
                    )}
                  </div>

                  {/* Right: Invoice No, Date, PO Ref */}
                  <div className="text-right space-y-1 text-xs sm:text-[12px] font-medium">
                    <div>
                      <span className="font-semibold text-slate-800">Proforma Inv No: </span>
                      <span className="font-bold font-mono text-slate-950">{safeQuotation.quotationNumber}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Date: </span>
                      <span className="font-bold text-slate-950">{formatDate(safeQuotation.date)}</span>
                    </div>
                    {safeQuotation.linkedQuotationNumber && (
                      <div>
                        <span className="font-semibold text-slate-800">Ref Quote: </span>
                        <span className="font-mono font-bold text-blue-700">{safeQuotation.linkedQuotationNumber}</span>
                      </div>
                    )}
                    {safeQuotation.customerPoNo && (
                      <div>
                        <span className="font-semibold text-slate-800">Customer PO: </span>
                        <span className="font-mono font-bold text-slate-950">{safeQuotation.customerPoNo}</span>
                      </div>
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">Place of Supply: </span>
                      <span className="font-bold text-slate-950">{(safeQuotation.placeOfSupply || '-').replace(/^\d+\s*[-–]\s*|\s*\(\d+\)$/g, '').trim() || '-'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Validity: </span>
                      <span className="font-bold text-slate-950">{safeQuotation.validityDays || 30} Days</span>
                    </div>
                  </div>
                </div>

                {/* Subject */}
                {safeQuotation.subject ? (
                  <div className="pt-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-[12.5px]">
                      Subject: {safeQuotation.subject}
                    </span>
                  </div>
                ) : null}

                {/* Table */}
                <div className="border border-black overflow-hidden my-2">
                  <table className="w-full text-left text-xs sm:text-[11.5px] border-collapse">
                    <thead>
                      <tr className="border-b border-black font-bold text-slate-900 bg-slate-100">
                        <th className="py-1.5 px-2 text-center w-10 border-r border-black">Sr</th>
                        <th className="py-1.5 px-3 border-r border-black">{isSoftware ? 'Description of Software Solutions / Services' : 'Description of Machinery / Service'}</th>
                        {!isSoftware && (
                          <th className="py-1.5 px-2 text-center w-24 border-r border-black">HSN / SAC</th>
                        )}
                        <th className="py-1.5 px-2 text-center w-16 border-r border-black">Qty</th>
                        <th className="py-1.5 px-2 text-right w-24 border-r border-black">Rate (₹)</th>
                        <th className="py-1.5 px-3 text-right w-28">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item.id || index} className="border-b border-black">
                          <td className="py-1.5 px-2 text-center border-r border-black font-semibold text-slate-600">{index + 1}</td>
                          <td className="py-1.5 px-3 border-r border-black font-medium text-slate-950">
                            <div className="font-bold">{item.title}</div>
                            {item.description && (
                              <div className="text-[10.5px] text-slate-600 leading-snug mt-0.5">{item.description}</div>
                            )}
                          </td>
                          {!isSoftware && (
                            <td className="py-1.5 px-2 text-center border-r border-black font-mono font-medium text-slate-700">
                              {item.hsn}
                            </td>
                          )}
                          <td className="py-1.5 px-2 text-center border-r border-black font-bold text-slate-900">
                            {item.qty}{(!isSoftware && item.unit) ? ` ${item.unit}` : ''}
                          </td>
                          <td className="py-1.5 px-2 text-right border-r border-black font-mono font-medium text-slate-900">
                            {formatNumber(item.unitPrice, 0)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-950">
                            {formatNumber(item.taxableAmount, 0)}
                          </td>
                        </tr>
                      ))}

                      {/* Taxable Total */}
                      <tr className="border-t border-black font-semibold text-slate-800 bg-slate-50/50">
                        <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Total Taxable Value:</td>
                        <td className="py-1 px-3 text-right font-mono font-bold text-slate-900">
                          {formatNumber(totalTaxable, 0)}
                        </td>
                      </tr>

                      {/* GST Split */}
                      {isIntraState ? (
                        <>
                          <tr className="border-t border-slate-200 text-slate-800">
                            <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Add: CGST @ 9%:</td>
                            <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatNumber(cgstVal, 0)}
                            </td>
                          </tr>
                          <tr className="border-t border-slate-200 text-slate-800">
                            <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Add: SGST @ 9%:</td>
                            <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900">
                              {formatNumber(sgstVal, 0)}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr className="border-t border-slate-200 text-slate-800">
                          <td colSpan={isSoftware ? 4 : 5} className="py-1 px-3 text-right border-r border-black">Add: IGST @ 18% (Inter-State):</td>
                          <td className="py-1 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatNumber(igstVal, 0)}
                          </td>
                        </tr>
                      )}

                      {/* Grand Total */}
                      <tr className="border-t-2 border-black font-bold text-slate-950 bg-slate-100 text-xs sm:text-[12.5px]">
                        <td colSpan={isSoftware ? 4 : 5} className="py-1.5 px-3 text-right border-r border-black uppercase">
                          TOTAL PROFORMA INVOICE VALUE (INCL. GST):
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-black text-slate-950">
                          ₹{formatNumber(grandTotal, 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="text-[11px] text-slate-800 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                  <span className="font-bold text-slate-950">Total Amount in Words: </span>
                  <span className="font-medium italic">{safeQuotation.amountInWords || numberToIndianWords(grandTotal)}</span>
                </div>

                {/* General Delivery & Dispatch Terms */}
                <div className="pt-2 space-y-1.5 text-xs sm:text-[12px] text-slate-900">
                  <h3 className="font-bold text-sm text-slate-950 tracking-tight mb-1">
                    {isSoftware ? 'Commercial & Project Terms & Conditions' : 'Commercial Delivery Terms:'}
                  </h3>
                  {isSoftware ? (
                    <FormattedTermsList termsText={safeQuotation.paymentTerms || SOFTWARE_DEFAULT_TERMS} />
                  ) : (
                    <div className="space-y-0.5 text-slate-800">
                      <div><span className="font-bold text-slate-950">Payment Terms:</span> {(!safeQuotation.paymentTerms || safeQuotation.paymentTerms.includes('50% Advance')) ? '75% Advance with PO, 25% Before Dispatch' : safeQuotation.paymentTerms}</div>
                      <div><span className="font-bold text-slate-950">Delivery Timeline:</span> {safeQuotation.deliveryTerms || 'Within 2–4 weeks from confirmed PO & advance'}</div>
                      <div><span className="font-bold text-slate-950">Freight & Transport:</span> {safeQuotation.freightTerms || 'Extra at actual / Borne by Client'}</div>
                      <div><span className="font-bold text-slate-950">Packing & Forwarding:</span> {safeQuotation.packingForwarding || 'Included in base price'}</div>
                      <div><span className="font-bold text-slate-950">Warranty:</span> {safeQuotation.warrantyTerms || '12 months from installation OR 13 months from invoice'}</div>
                    </div>
                  )}
                </div>

              </div>

              {/* Page 1 Footer */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={isSoftware} />
            </div>

            {/* PAGE 2: ADVANCE REMITTANCE, BANK DETAILS & AUTHORIZED SIGNATORY */}
            <div className="a4-sheet text-slate-900 font-sans text-xs sm:text-[13px] leading-normal" id="proforma-page-2">
              
              {/* Official Header */}
              <KitsDocumentHeader companySettings={companySettings} />

              <div className="flex-1 py-3 space-y-4">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                    Advance Payment Schedule & Banking Coordinates
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    Please remit advance payment using the official bank details below to confirm the order.
                  </p>
                </div>

                {/* Highlighted Advance Milestone Box */}
                <div className="border border-emerald-600 bg-emerald-50/60 px-3.5 py-2.5 rounded-xl shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] sm:text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider">
                        Advance Payment Required Against This Proforma ({advancePercent}%):
                      </div>
                      <div className="text-lg sm:text-xl font-black font-mono text-emerald-950 mt-0.5">
                        ₹{formatNumber(advanceAmount, 0)}
                      </div>
                      <div className="text-[10.5px] font-semibold text-emerald-800 italic mt-0.5">
                        {safeQuotation.advanceInWords || numberToIndianWords(advanceAmount)}
                      </div>
                    </div>
                    <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-emerald-200/80 pt-1.5 sm:pt-0 sm:pl-3.5">
                      <div className="text-[10px] text-emerald-700 font-medium">Balance on Inspection / Dispatch:</div>
                      <div className="text-sm sm:text-base font-bold font-mono text-slate-800 mt-0.5">₹{formatNumber(balanceAmount, 0)}</div>
                    </div>
                  </div>
                </div>

                {/* Official Bank Coordinates Box */}
                <KitsBankDetailsBox companySettings={companySettings} title="Official Banking Coordinates (For Direct RTGS / NEFT Remittance)" />

                {/* Statutory Declarations & Client Notes */}
                <div className="space-y-2 text-xs sm:text-[12.5px] text-slate-800 leading-relaxed pl-2 border-l-2 border-slate-300">
                  <div className="font-bold text-slate-900 uppercase text-xs">Statutory Declarations:</div>
                  <p>1. This is a preliminary Proforma Invoice, not a Tax Invoice. Statutory Tax Invoice with official E-Way Bill will be issued on dispatch.</p>
                  <p>2. Please mention the Proforma Invoice reference number ({safeQuotation.quotationNumber}) in the bank remittance remarks.</p>
                  <p>3. Material inspection to be completed within 3 days of intimation before dispatch.</p>
                </div>

                {/* Sign-off & Authorized Signatory */}
                <KitsSignatoryBlock 
                  companySettings={companySettings} 
                  noteText={safeQuotation.closingNote || 'We look forward to your valued order and payment remittance.'} 
                />

              </div>

              {/* Page 2 Footer */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={isSoftware} />
            </div>
          </>
        ) : (
          /* ============================================================== */
          /* STANDARD SALES QUOTATION: 2-PAGE OFFICIAL KITS STANDARD        */
          /* ============================================================== */
          <>
            {/* PAGE 1: COMMERCIAL PROPOSAL & SALES QUOTATION TABLE */}
            <div className="a4-sheet text-slate-900 font-sans text-xs sm:text-[13px] leading-normal" id="quotation-page-1">
              
              {/* Header */}
              <KitsDocumentHeader companySettings={companySettings} />

              {/* Body Content of Page 1 */}
              <div className="flex-1 py-1 space-y-3">
                
                {/* Title: QUOTATION */}
                <div className="text-center my-2">
                  <h2 className="text-base sm:text-lg font-black tracking-widest text-slate-900 uppercase">
                    QUOTATION
                  </h2>
                </div>

                {/* Metadata & Parties Info */}
                <div className="flex justify-between items-start text-xs sm:text-[13px]">
                  
                  {/* Left Column: From & To */}
                  <div className="space-y-3 max-w-[60%]">
                    <div>
                      <span className="font-semibold text-slate-800">From:</span>
                      <div className="font-bold text-slate-950 whitespace-nowrap">
                        {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}, {companySettings?.city || 'Akola'}
                      </div>
                      <div className="text-slate-800 text-[11px] mt-0.5">
                        GSTIN: <span className="font-mono font-semibold">{companySettings?.gstin || '27AAMCK1536C1ZP'}</span>
                      </div>
                      <div className="text-slate-800">
                        Mobile: {displayPhone}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-slate-900 text-sm">To: {safeQuotation.clientName || 'Valued Customer'}</div>
                      {safeQuotation.billingAddress && (
                        <div className="text-slate-800 text-[12px] whitespace-pre-line leading-snug">{safeQuotation.billingAddress}</div>
                      )}
                      {safeQuotation.clientGstin && (
                        <div className="text-slate-800 text-[12px] font-mono font-medium">
                          GSTIN: <span className="font-bold text-slate-950">{safeQuotation.clientGstin}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Quotation No, Date, Validity */}
                  <div className="text-right space-y-1 text-xs sm:text-[13px] font-medium">
                    <div>
                      <span className="font-semibold text-slate-800">Quotation No: </span>
                      <span className="font-bold font-mono text-slate-950">{safeQuotation.quotationNumber || 'KITS/AKL/001'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Date: </span>
                      <span className="font-bold text-slate-950">{formatDate(safeQuotation.date)}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Category: </span>
                      <span className="font-bold text-slate-950">{safeQuotation.category || 'Automation Work'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-800">Validity: </span>
                      <span className="font-bold text-slate-950">{safeQuotation.validityDays || 30} Days</span>
                    </div>
                  </div>

                </div>

                {/* Subject Line */}
                {safeQuotation.subject ? (
                  <div className="pt-1">
                    <span className="font-bold text-slate-900 text-xs sm:text-[13px]">
                      Subject: {safeQuotation.subject}
                    </span>
                  </div>
                ) : null}

                {/* Salutation & Opening Letter */}
                <div className="space-y-1 text-xs sm:text-[12.5px] leading-relaxed text-slate-800">
                  <p className="font-medium">{safeQuotation.salutation || 'Dear Sir / Madam,'}</p>
                  <p>
                    {safeQuotation.openingNote || 'With reference to our telephonic conversation and discussion, we are pleased to submit our proposal for the supply Automation Work.'}
                  </p>
                </div>

                {/* Section Number Header */}
                <div className="pt-2">
                  <h3 className="font-bold text-xs sm:text-[13px] text-slate-900 uppercase">
                    {safeQuotation.sectionTitle || '1. AUTOMATION WORK'}
                  </h3>
                </div>

                {/* Exact Table Layout */}
                <div className="border border-black overflow-hidden my-2">
                  <table className="w-full text-left text-xs sm:text-[12px] border-collapse">
                    
                    {/* Table Title Header */}
                    <thead>
                      <tr className="border-b border-black">
                        <th 
                          colSpan="5" 
                          className="py-1.5 px-3 text-center font-bold text-xs sm:text-[13px] text-slate-900 bg-white"
                        >
                          {safeQuotation.tableHeaderTitle || 'Sales Quotation For Automation Work'}
                        </th>
                      </tr>

                      {/* Column Headers */}
                      <tr className="border-b border-black font-bold text-slate-900 bg-slate-50">
                        <th className="py-1.5 px-2 text-center w-12 border-r border-black">Sr<br/>No</th>
                        <th className="py-1.5 px-3 text-center border-r border-black">{isSoftware ? 'Description of Software Solutions / Services' : 'Description of Products & Automation'}</th>
                        <th className="py-1.5 px-2 text-center w-14 border-r border-black">Qty</th>
                        <th className="py-1.5 px-3 text-center w-24 border-r border-black">Rate</th>
                        <th className="py-1.5 px-3 text-center w-28">Total Amount</th>
                      </tr>
                    </thead>

                    <tbody>
                      {/* Category Header Row */}
                      <tr className="border-b border-black font-bold text-slate-900">
                        <td className="py-1 px-2 text-center border-r border-black">A</td>
                        <td className="py-1 px-3 border-r border-black uppercase">
                          {safeQuotation.categoryName || (isSoftware ? 'SOFTWARE DEVELOPMENT' : 'AUTOMATION WORK')}
                        </td>
                        <td className="py-1 px-2 text-center border-r border-black"></td>
                        <td className="py-1 px-3 text-right border-r border-black"></td>
                        <td className="py-1 px-3 text-right"></td>
                      </tr>

                      {/* Line Items */}
                      {items.map((item, index) => (
                        <tr key={item.id || index} className="border-b border-black">
                          <td className="py-1.5 px-2 text-center border-r border-black font-medium">
                            {index + 1}
                          </td>
                          <td className="py-1.5 px-3 border-r border-black font-medium">
                            <div className="font-bold text-slate-950">{item.title}</div>
                            {item.description && (
                              <div className="text-[11px] text-slate-600 mt-0.5">{item.description}</div>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center border-r border-black font-medium">
                            {item.qty}
                          </td>
                          <td className="py-1.5 px-3 text-right border-r border-black font-mono font-medium">
                            {formatNumber(item.unitPrice, 0)}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-950">
                            {formatNumber(item.taxableAmount, 0)}
                          </td>
                        </tr>
                      ))}

                      {/* Total Row */}
                      <tr className="font-bold text-slate-900 border-t border-black bg-slate-50">
                        <td className="py-1.5 px-3 text-center border-r border-black" colSpan="2">
                          TOTAL
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-black">
                          {totalQty}
                        </td>
                        <td className="py-1.5 px-3 text-right border-r border-black"></td>
                        <td className="py-1.5 px-3 text-right font-mono font-black">
                          {formatNumber(totalTaxable, 0)}
                        </td>
                      </tr>
                    </tbody>

                  </table>
                </div>

                {/* General Terms & Conditions */}
                <div className="pt-2.5 space-y-1.5 text-xs sm:text-[12.5px] text-slate-900">
                  <h3 className="font-bold text-sm sm:text-base text-slate-950 tracking-tight mb-1">
                    {isSoftware ? 'Commercial & Project Terms & Conditions' : 'General Terms & Conditions'}
                  </h3>

                  {isSoftware ? (
                    <FormattedTermsList termsText={safeQuotation.paymentTerms || SOFTWARE_DEFAULT_TERMS} />
                  ) : (
                    <div className="space-y-1 text-slate-800 leading-snug">
                      <div><span className="font-bold text-slate-950">Delivery:</span> {safeQuotation.deliveryTerms || 'Within 1–2 weeks'}</div>
                      <div><span className="font-bold text-slate-950">GST:</span> {safeQuotation.gstTerms || '18% Extra'}</div>
                      <div><span className="font-bold text-slate-950">Taxes, Freight and Transportation:</span> {safeQuotation.freightTerms || 'As Actual'}</div>
                      <div><span className="font-bold text-slate-950">Validity:</span> {safeQuotation.validityDays || 30} Days</div>
                      <div className="whitespace-pre-line"><span className="font-bold text-slate-950">Payment Terms:</span> {safeQuotation.paymentTerms || '75% in advance along with PO, 25% before dispatch.'}</div>
                      <div><span className="font-bold text-slate-950">Warranty (Manufacturing Defect):</span> {safeQuotation.warrantyTerms || '12 months from the date of installation OR 13 months from the date of invoice.'}</div>
                    </div>
                  )}
                </div>

              </div>

              {/* Footer of Page 1 */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={isSoftware} />
            </div>

            {/* PAGE 2: NOTES / EXCLUSIONS */}
            <div className="a4-sheet text-slate-900 font-sans text-xs sm:text-[13px] leading-normal" id="quotation-page-2">
              
              {/* Header */}
              <KitsDocumentHeader companySettings={companySettings} />

              {/* Body Content of Page 2 */}
              <div className="flex-1 py-4 space-y-6">
                
                {/* Title: Notes / Exclusions */}
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 uppercase">
                    Notes / Exclusions & Client Scope
                  </h2>
                </div>

                {/* Bullet Points */}
                <div className="space-y-2 text-xs sm:text-[13px] text-slate-800 leading-relaxed pl-2">
                  {exclusionsList.map((note, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <span className="text-slate-900 font-bold">•</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>

                {/* Closing Line */}
                <div className="pt-10">
                  <p className="font-medium text-slate-900 text-xs sm:text-[13px]">
                    {safeQuotation.closingNote || 'We look forward to valued order.'}
                  </p>
                </div>

                {/* Sign-off */}
                <div className="pt-8">
                  <div className="font-bold text-sm tracking-tight text-[#0f245c] uppercase whitespace-nowrap">
                    {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}
                  </div>
                </div>

              </div>

              {/* Footer of Page 2 */}
              <KitsDocumentFooter companySettings={companySettings} isSoftware={isSoftware} />
            </div>
          </>
        )}

      </div>

    </div>
  );
}

export default React.memo(QuotationPreview);
