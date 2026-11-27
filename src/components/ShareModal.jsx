import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  MessageCircle, 
  Mail, 
  Copy, 
  Check, 
  ExternalLink 
} from 'lucide-react';
import { formatNumber, formatDate } from '../utils/formatters';

function ShareModal({
  isOpen,
  onClose,
  quotation,
  companySettings
}) {
  const [copied, setCopied] = useState(false);
  const [userPhone, setUserPhone] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [prevQuoteId, setPrevQuoteId] = useState(quotation?.id);

  if (quotation?.id !== prevQuoteId) {
    setPrevQuoteId(quotation?.id);
    setUserPhone(null);
    setUserEmail(null);
  }

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

  // Generate WhatsApp Message matching the KITS reference style
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
• Payment Terms: ${quotation.paymentTerms || '75% in advance along with PO, 25% before dispatch.'}
• Warranty: ${quotation.warrantyTerms || '12 months from installation'}

We look forward to valued order.
*${companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}*
Contact: ${contactPhone} | ${companySettings?.email || 'info@kitstechsolutions.com'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Share Quotation</h3>
              <p className="text-xs text-slate-500 font-mono">{quotation.quotationNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share Options */}
        <div className="py-4 space-y-4 text-xs">
          
          {/* WhatsApp Section */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-950 flex items-center space-x-1.5 text-sm">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>Send via WhatsApp</span>
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">One-click</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                Client Mobile Number
              </label>
              <input
                type="text"
                placeholder=""
                value={phoneNumber}
                onChange={(e) => setUserPhone(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={handleOpenWhatsApp}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Send via WhatsApp</span>
            </button>
          </div>

          {/* Email Section */}
          <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-950 flex items-center space-x-1.5 text-sm">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Send via Email</span>
              </span>
              <span className="text-[11px] text-blue-700 font-medium">Draft in Mail Client</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-blue-900 mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                placeholder=""
                value={emailTo}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleOpenEmail}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center space-x-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Draft Email</span>
            </button>
          </div>

          {/* Copy Plain Text */}
          <button
            onClick={handleCopy}
            className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center space-x-1.5"
          >
            {copied ? (
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
