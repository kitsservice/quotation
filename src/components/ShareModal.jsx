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
  Laptop
} from 'lucide-react';
import { formatNumber, formatDate } from '../utils/formatters';
import { buildShareUrl } from '../utils/shareLink';

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
  const [userPhone, setUserPhone] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [prevQuoteId, setPrevQuoteId] = useState(quotation?.id);

  if (quotation?.id !== prevQuoteId) {
    setPrevQuoteId(quotation?.id);
    setUserPhone(null);
    setUserEmail(null);
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
    };
  }, [isOpen, quotation]);

  const defaultPhone = quotation?.clientPhone ? quotation.clientPhone.replace(/[^0-9]/g, '') : '';
  const defaultEmail = quotation?.clientEmail || '';
  const phoneNumber = userPhone !== null ? userPhone : defaultPhone;
  const emailTo = userEmail !== null ? userEmail : defaultEmail;

  if (!isOpen || !quotation) return null;

  // Compute total quantity and total amount
  const items = Array.isArray(quotation.items) ? quotation.items : [];
  const totalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.taxableAmount) || (parseFloat(item.qty) * parseFloat(item.unitPrice)) || 0), 0);

  const isSoftware = quotation.category === 'Software' || quotation.categoryName?.includes('SOFTWARE');
  const rawContactPhone = companySettings?.phone || '9823042432 / 7385582242';
  const contactPhone = isSoftware
    ? (rawContactPhone.replace(/(?:^|\s*[/,-]\s*)9453536807(?:\s*[/,-]\s*|$)/g, ' ').replace(/\s+/g, ' ').replace(/^[/\s,-]+|[/\s,-]+$/g, '').trim() || '9823042432 / 7385582242')
    : rawContactPhone;

  // Generate WhatsApp Message matching the KITS reference style with the web link
  const messageText = `*QUOTATION*
*${companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}*
----------------------------------------
*Quotation No:* ${quotation.quotationNumber}
*Category:* ${quotation.category || 'Automation Work'}
*Date:* ${formatDate(quotation.date)}
*Validity:* ${quotation.validityDays || 30} Days
*To:* ${quotation.clientName}
${quotation.subject ? `*Subject:* ${quotation.subject}\n` : ''}
*Sales Quotation for ${quotation.category || quotation.categoryName || 'Automation Work'}:*
${items.map((item, i) => `${i + 1}. ${item.title} | Qty: ${item.qty} | Rate: ₹${formatNumber(item.unitPrice, 0)} | Total: ₹${formatNumber(item.taxableAmount || (item.qty * item.unitPrice), 0)}`).join('\n')}

*Total Quantity:* ${totalQty}
*TOTAL AMOUNT:* ₹${formatNumber(totalAmount, 0)}
----------------------------------------
*General Terms:*
• Delivery: ${quotation.deliveryTerms || 'Within 1–2 weeks'}
• GST: ${quotation.gstTerms || '18% Extra'}
• Payment Terms: ${quotation.paymentTerms || 'Payment Terms: 75% in advance along with PO, 25% before dispatch.'}
• Warranty: ${quotation.warrantyTerms || '12 months from installation'}

${shareUrl ? `📄 *View Quotation Online / Download PDF:*\n${shareUrl}\n\n` : ''}We look forward to valued order.
*${companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}*
Contact: ${contactPhone} | ${companySettings?.email || 'info@kitstechsolutions.com'}`;

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
    const subject = encodeURIComponent(`Quotation: ${quotation.quotationNumber}${quotation.subject ? ' - ' + quotation.subject : ''}`);
    const body = encodeURIComponent(messageText);
    window.location.href = `mailto:${emailTo}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Share Quotation</h3>
              <p className="text-xs text-slate-500 font-mono">{quotation.quotationNumber}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share Options Container */}
        <div className="space-y-3.5 text-xs">
          
          {/* Card 1: Direct Shareable Web Link (Works on ANY Laptop or Phone) */}
          <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-950 flex items-center space-x-1.5 text-xs">
                <Link className="w-4 h-4 text-blue-600" />
                <span>Shareable Web Link (View on Any Laptop / Phone)</span>
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                <Laptop className="w-3 h-3" />
                <span>Zero Login</span>
              </span>
            </div>

            <p className="text-[11px] text-slate-600">
              Anyone opening this link on another laptop immediately views the full quotation with your company letterhead, 75% advance terms, and bank details.
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
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer shrink-0 disabled:opacity-50"
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

          {/* Card 2: WhatsApp Section */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center space-x-1.5 text-xs">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Send via WhatsApp (Includes View Link)</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold">One-click</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                Client Mobile Number
              </label>
              <input
                type="text"
                placeholder="e.g. 9876543210"
                value={phoneNumber}
                onChange={(e) => setUserPhone(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              onClick={handleOpenWhatsApp}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </button>
          </div>

          {/* Card 3: Email Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Send via Email</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Mail Client</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                placeholder="client@example.com"
                value={emailTo}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              onClick={handleOpenEmail}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Draft Email</span>
            </button>
          </div>

          {/* Card 4: Copy Formatted Text */}
          <button
            onClick={handleCopyText}
            className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            {copiedText ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Quotation Text Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Formatted Quotation Text</span>
              </>
            )}
          </button>

        </div>

      </div>
    </div>
  );
}

export default React.memo(ShareModal);
