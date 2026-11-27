import React, { useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  MessageCircle, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink,
  Link,
  Laptop,
  FileDown,
  Loader2,
  FileText
} from 'lucide-react';
import { formatNumber, formatDate } from '../utils/formatters';
import { buildShareUrl } from '../utils/shareLink';
import { exportToPdf, generatePdfFile } from '../services/pdfGenerator';
import QuotationPreview from './QuotationPreview';
import PrintableChallanSheet from './PrintableChallanSheet';

function ShareModal({
  isOpen,
  onClose,
  quotation,
  companySettings
}) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [shareFeedback, setShareFeedback] = useState(null);
  const [userPhone, setUserPhone] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [prevQuoteId, setPrevQuoteId] = useState(quotation?.id);

  if (quotation?.id !== prevQuoteId) {
    setPrevQuoteId(quotation?.id);
    setUserPhone(null);
    setUserEmail(null);
    setShareFeedback(null);
  }

  // Generate shareable URL when modal opens or quotation changes
  useEffect(() => {
    if (!isOpen || !quotation) return;

    let active = true;
    (async () => {
      setGeneratingUrl(true);
      try {
        const url = await buildShareUrl(quotation);
        if (active) {
          setShareUrl(url);
        }
      } catch (err) {
        console.warn('Error generating share URL:', err);
      } finally {
        if (active) setGeneratingUrl(false);
      }
    })();

    return () => {
      active = false;
      setShareUrl('');
      setShareFeedback(null);
    };
  }, [isOpen, quotation]);

  const defaultPhone = quotation?.clientPhone ? quotation.clientPhone.replace(/[^0-9]/g, '') : '';
  const defaultEmail = quotation?.clientEmail || '';
  const phoneNumber = userPhone !== null ? userPhone : defaultPhone;
  const emailTo = userEmail !== null ? userEmail : defaultEmail;

  if (!isOpen || !quotation) return null;

  // Accurate document type detection
  const isDemoChallan = Boolean(
    quotation.documentType === 'Demo Challan' || 
    quotation.isDemoChallan || 
    quotation.type === 'demo-challan'
  );

  const isDeliveryChallan = Boolean(
    isDemoChallan ||
    quotation.documentType === 'Delivery Challan' || 
    quotation.isDeliveryChallan || 
    quotation.type === 'challan'
  );

  const isTaxInvoice = Boolean(
    !isDeliveryChallan && (
      quotation.documentType === 'Tax Invoice' || 
      quotation.documentType === 'Final Invoice' || 
      quotation.isTaxInvoice
    )
  );

  const isProforma = Boolean(
    !isDeliveryChallan && !isTaxInvoice && (
      quotation.documentType === 'Proforma Invoice' || 
      quotation.isProforma
    )
  );

  // Document labels and titles
  const docTypeName = isDemoChallan 
    ? 'Demo Delivery Challan' 
    : isDeliveryChallan 
    ? 'Delivery Challan' 
    : isTaxInvoice 
    ? 'Final Invoice' 
    : isProforma 
    ? 'Proforma Invoice' 
    : 'Quotation';

  const docNumber = quotation.challanNo || quotation.invoiceNo || quotation.quotationNumber || 'Document';
  
  const docPrefix = isDemoChallan 
    ? 'KITS_Demo_Challan_' 
    : isDeliveryChallan 
    ? 'KITS_Delivery_Challan_' 
    : isTaxInvoice 
    ? 'KITS_Final_Invoice_' 
    : isProforma 
    ? 'KITS_Proforma_' 
    : 'KITS_Quotation_';

  const sanitizedDocNum = docNumber.replace(/[/\\]/g, '_');
  const pdfFileName = `${docPrefix}${sanitizedDocNum}.pdf`;

  // Compute total quantity and total amount
  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const totalQty = quotation.totalQuantity || items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const taxableAmount = parseFloat(quotation.taxableAmount) || items.reduce((sum, item) => sum + (parseFloat(item.taxableAmount) || (parseFloat(item.qty) * parseFloat(item.unitPrice || item.rate)) || 0), 0);
  const grandTotal = parseFloat(quotation.grandTotal || quotation.totalAmount) || taxableAmount;

  const isSoftware = quotation.category === 'Software' || quotation.categoryName?.includes('SOFTWARE');
  const rawContactPhone = companySettings?.phone || '9823042432 / 7385582242';
  const contactPhone = isSoftware
    ? (rawContactPhone.replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ').replace(/\s+/g, ' ').replace(/^[/\s,-]+|[/\s,-]+$/g, '').trim() || '9823042432 / 7385582242')
    : rawContactPhone;

  const companyName = companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.';
  const companyEmail = companySettings?.email || 'info@kitstechsolutions.com';

  // Construct tailored, professional message text according to document type
  let messageText = '';

  if (isTaxInvoice) {
    messageText = `*FINAL INVOICE*
*${companyName}*
----------------------------------------
*Final Invoice No:* ${docNumber}
*Date:* ${formatDate(quotation.date)}
*Billed To:* ${quotation.clientName || 'Valued Customer'}
${quotation.clientGstin ? `*GSTIN:* ${quotation.clientGstin}\n` : ''}*Category:* ${quotation.category || 'Automation Work'}
----------------------------------------
${items.map((item, i) => `${i + 1}. ${item.title || item.name} | Qty: ${item.qty} | Rate: ₹${formatNumber(item.unitPrice || item.rate, 0)} | Total: ₹${formatNumber(item.taxableAmount || (item.qty * (item.unitPrice || item.rate)), 0)}`).join('\n')}
----------------------------------------
*Total Quantity:* ${totalQty}
*Taxable Value:* ₹${formatNumber(taxableAmount, 0)}
*TOTAL FINAL INVOICE VALUE (INCL. GST):* ₹${formatNumber(grandTotal, 0)}
----------------------------------------
*Official Banking Coordinates (RTGS / NEFT):*
Bank: ${companySettings?.bankName || 'State Bank of India'}
A/C: ${companySettings?.accountNumber || '41539255857'} (Current A/C)
IFSC: ${companySettings?.ifscCode || 'SBIN0000306'}
Branch: ${companySettings?.branchName || 'Main Branch, Akola'}
----------------------------------------
${shareUrl ? `📄 *View Final Invoice Online / Download PDF:*\n${shareUrl}\n\n` : ''}Thank you for your valued business.
*${companyName}*
Contact: ${contactPhone} | ${companyEmail}`;
  } else if (isDeliveryChallan) {
    messageText = `*${isDemoChallan ? 'DEMO DELIVERY CHALLAN' : 'DELIVERY CHALLAN'}*
*${companyName}*
(Issued under Rule 55 of CGST Rules, 2017)
----------------------------------------
*Challan No:* ${docNumber}
*Date:* ${formatDate(quotation.date)}
*Consignee (To):* ${quotation.clientName || 'Customer'}
*Nature of Removal:* ${quotation.purpose || (isDemoChallan ? 'Demonstration / Exhibition - Not For Sale' : 'Installation & Commissioning at Site')}
*Mode of Transport:* ${quotation.transportMode || 'Road'} ${quotation.vehicleNo ? `| Veh: ${quotation.vehicleNo}` : ''}
----------------------------------------
${items.map((item, i) => `${i + 1}. ${item.title || item.name} | Qty: ${item.qty} ${item.unit || 'Nos'}${!isDemoChallan && (item.rate || item.unitPrice) ? ` | Rate: ₹${formatNumber(item.rate || item.unitPrice, 0)}` : ''}`).join('\n')}
----------------------------------------
*Total Consignment Units:* ${totalQty}
${!isDemoChallan ? `*Assessable Value:* ₹${formatNumber(taxableAmount || grandTotal, 0)}\n` : ''}----------------------------------------
${isDemoChallan ? '• Non-Commercial Trial Goods • Returnable Equipment\n----------------------------------------\n' : ''}${shareUrl ? `📄 *View Delivery Challan Online / Download PDF:*\n${shareUrl}\n\n` : ''}*${companyName}*
Contact: ${contactPhone} | ${companyEmail}`;
  } else if (isProforma) {
    messageText = `*PROFORMA INVOICE*
*${companyName}*
----------------------------------------
*Proforma Invoice No:* ${docNumber}
*Category:* ${quotation.category || 'Automation Work'}
*Date:* ${formatDate(quotation.date)}
*Validity:* ${quotation.validityDays || 30} Days
*To:* ${quotation.clientName || 'Valued Customer'}
${quotation.subject ? `*Subject:* ${quotation.subject}\n` : ''}----------------------------------------
${items.map((item, i) => `${i + 1}. ${item.title || item.name} | Qty: ${item.qty} | Rate: ₹${formatNumber(item.unitPrice || item.rate, 0)} | Total: ₹${formatNumber(item.taxableAmount || (item.qty * (item.unitPrice || item.rate)), 0)}`).join('\n')}
----------------------------------------
*Total Quantity:* ${totalQty}
*TOTAL PROFORMA VALUE (INCL. GST):* ₹${formatNumber(grandTotal, 0)}
----------------------------------------
*Commercial & Payment Terms:*
• Advance Required: 75% along with PO
• Balance: 25% before dispatch
• Delivery: ${quotation.deliveryTerms || 'Within 1–2 weeks'}
• Warranty: ${quotation.warrantyTerms || '12 months from installation'}
----------------------------------------
*Bank Coordinates for Advance:*
Bank: ${companySettings?.bankName || 'State Bank of India'}
A/C: ${companySettings?.accountNumber || '41539255857'} | IFSC: ${companySettings?.ifscCode || 'SBIN0000306'}
----------------------------------------
${shareUrl ? `📄 *View Proforma Online / Download PDF:*\n${shareUrl}\n\n` : ''}We look forward to your valued order.
*${companyName}*
Contact: ${contactPhone} | ${companyEmail}`;
  } else {
    // Standard Quotation
    messageText = `*QUOTATION*
*${companyName}*
----------------------------------------
*Quotation No:* ${docNumber}
*Category:* ${quotation.category || 'Automation Work'}
*Date:* ${formatDate(quotation.date)}
*Validity:* ${quotation.validityDays || 30} Days
*To:* ${quotation.clientName || 'Valued Customer'}
${quotation.subject ? `*Subject:* ${quotation.subject}\n` : ''}----------------------------------------
${items.map((item, i) => `${i + 1}. ${item.title || item.name} | Qty: ${item.qty} | Rate: ₹${formatNumber(item.unitPrice || item.rate, 0)} | Total: ₹${formatNumber(item.taxableAmount || (item.qty * (item.unitPrice || item.rate)), 0)}`).join('\n')}
----------------------------------------
*Total Quantity:* ${totalQty}
*TOTAL AMOUNT:* ₹${formatNumber(grandTotal, 0)}
----------------------------------------
*General Terms:*
• Delivery: ${quotation.deliveryTerms || 'Within 1–2 weeks'}
• GST: ${quotation.gstTerms || '18% Extra'}
• Payment Terms: ${quotation.paymentTerms || 'Payment Terms: 75% in advance along with PO, 25% before dispatch.'}
• Warranty: ${quotation.warrantyTerms || '12 months from installation'}
----------------------------------------
${shareUrl ? `📄 *View Quotation Online / Download PDF:*\n${shareUrl}\n\n` : ''}We look forward to valued order.
*${companyName}*
Contact: ${contactPhone} | ${companyEmail}`;
  }

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone; // Prefix India country code if 10 digits
    }
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  const handleOpenEmail = () => {
    const subject = encodeURIComponent(`${docTypeName}: ${docNumber}${quotation.subject ? ' - ' + quotation.subject : ''}`);
    const body = encodeURIComponent(messageText);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  /**
   * PDF MODE SHARING:
   * 1. Uses navigator.share({ files: [pdfFile] }) on mobile and supported desktop browsers.
   * 2. If unsupported or cancelled, automatically downloads the PDF file, copies text,
   *    and opens WhatsApp Web so the user can easily attach the PDF.
   */
  const handleSharePdf = async () => {
    setIsExportingPdf(true);
    setShareFeedback(null);

    try {
      // Ensure printable container layout has stabilized
      await new Promise(resolve => setTimeout(resolve, 80));

      // Attempt native Web Share API with genuine PDF file
      if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
        const file = await generatePdfFile('share-modal-printable', pdfFileName);
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${docTypeName} ${docNumber}`,
            text: `Please find attached ${docTypeName} ${docNumber} from ${companyName}.\n${shareUrl ? `Online Link: ${shareUrl}` : ''}`
          });
          setShareFeedback('✓ Shared successfully in PDF mode!');
          return;
        }
      }

      // Fallback for desktop browsers without file share API:
      // Download the PDF file to disk, copy message text, and launch WhatsApp
      await exportToPdf('share-modal-printable', pdfFileName);
      try {
        await navigator.clipboard.writeText(messageText);
      } catch {
        // ignore clipboard error
      }
      handleOpenWhatsApp();
      setShareFeedback(`✓ ${pdfFileName} downloaded to your device! Simply attach it in WhatsApp.`);
    } catch (err) {
      console.error('PDF sharing failed:', err);
      if (err.name === 'AbortError') {
        // User closed the share sheet
        return;
      }
      // Attempt direct download if share threw an unexpected error
      try {
        await exportToPdf('share-modal-printable', pdfFileName);
        setShareFeedback(`✓ ${pdfFileName} downloaded to your device!`);
      } catch (downErr) {
        setShareFeedback(`Note: Error generating PDF (${downErr.message})`);
      }
    } finally {
      setIsExportingPdf(false);
    }
  };

  /**
   * Direct PDF Download
   */
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    setShareFeedback(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 80));
      await exportToPdf('share-modal-printable', pdfFileName);
      setShareFeedback(`✓ ${pdfFileName} downloaded successfully!`);
    } catch (err) {
      console.error('PDF download failed:', err);
      setShareFeedback(`Error generating PDF: ${err.message}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      {/* Hidden Offscreen Printable A4 Container for Accurate PDF Generation */}
      <div 
        id="share-modal-printable"
        className="fixed left-0 top-0 opacity-0 pointer-events-none select-none -z-50 bg-white"
        style={{ width: '210mm' }}
        aria-hidden="true"
      >
        {isDeliveryChallan ? (
          <PrintableChallanSheet
            challan={quotation}
            companySettings={companySettings}
            isDemo={isDemoChallan}
          />
        ) : (
          <QuotationPreview
            quotation={quotation}
            companySettings={companySettings}
            isPrintOnly={true}
            containerId="share-modal-printable"
          />
        )}
      </div>

      {/* Share Modal Dialog */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
        <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Share {docTypeName}
                  </h3>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                    PDF Mode
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{docNumber} • {quotation.clientName || 'Valued Customer'}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Banner */}
          {shareFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{shareFeedback}</span>
            </div>
          )}

          {/* Share Options Container */}
          <div className="space-y-3.5 text-xs">
            
            {/* Primary Action Card: Share in PDF Mode (WhatsApp & Native Share) */}
            <div className="p-4 bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-teal-50/60 border-2 border-emerald-300 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-950 flex items-center space-x-1.5 text-xs">
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Share PDF File (WhatsApp / System Share)</span>
                </span>
                <span className="text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <FileText className="w-3 h-3" />
                  <span>Official PDF</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-snug">
                Shares the genuine high-definition PDF file with official KITS letterhead, statutory breakdown, commercial terms &amp; authorized signature directly into WhatsApp or device apps.
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-emerald-950 mb-1">
                  Client Mobile Number (for WhatsApp)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9823042432 or 7385582242"
                  value={phoneNumber}
                  onChange={(e) => setUserPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Main Action: Share PDF */}
                <button
                  type="button"
                  onClick={handleSharePdf}
                  disabled={isExportingPdf}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  title="Share PDF directly to WhatsApp or Device Apps"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 text-white" />
                      <span>Share PDF (WhatsApp)</span>
                    </>
                  )}
                </button>

                {/* Direct Download PDF Button */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  title="Download Official PDF file directly"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4 text-white" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 2: Direct Shareable Web Link (Works on ANY Laptop or Phone) */}
            <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 flex items-center space-x-1.5 text-xs">
                  <Link className="w-4 h-4 text-blue-600" />
                  <span>Shareable Online Web Link (Any Laptop / Phone)</span>
                </span>
                <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <Laptop className="w-3 h-3" />
                  <span>Zero Login</span>
                </span>
              </div>

              <p className="text-[11px] text-slate-600">
                Anyone opening this link immediately views the complete document with official letterhead, commercial terms, and can download the PDF in one click.
              </p>

              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={generatingUrl ? 'Generating link...' : shareUrl}
                  className="flex-1 px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-[11px] font-mono text-slate-700 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={generatingUrl || !shareUrl}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
                {shareUrl && (
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 bg-white hover:bg-slate-100 border border-blue-300 text-blue-600 rounded-lg transition-colors cursor-pointer"
                    title="Open Link in New Tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Card 3: Send via Email */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Send via Email</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Mail Client</span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={emailTo}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleOpenEmail}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Draft Email</span>
                </button>
              </div>
            </div>

            {/* Card 4: Copy Formatted Text */}
            <button
              type="button"
              onClick={handleCopyText}
              className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">{docTypeName} Text Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Formatted {docTypeName} Text</span>
                </>
              )}
            </button>

          </div>

        </div>
      </div>
    </>
  );
}

export default React.memo(ShareModal);
