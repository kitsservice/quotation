import React, { useState, useRef, useEffect } from 'react';
import { 
  FileCheck2, 
  Receipt, 
  Truck, 
  PackageCheck, 
  ChevronDown 
} from 'lucide-react';

/**
 * Universal Document Conversion Dropdown Menu.
 * Allows users to convert a Quotation or Proforma into further downstream documents:
 * 1. Proforma Invoice (Commercial Advance & Milestones)
 * 2. Final Tax Invoice (GST Tax Invoice for Billing & Dispatch)
 * 3. Delivery Challan (Transportation of Goods under Rule 55)
 * 4. Demo Delivery Challan (7-Day Trial & Demonstration)
 */
function DocumentConvertMenu({
  document: doc,
  onConvert,
  variant = 'button', // 'button' | 'icon'
  buttonClassName = '',
  align = 'right' // 'left' | 'right'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  if (!doc || !onConvert) return null;

  const isTaxDoc = Boolean(doc.isTaxInvoice || doc.documentType === 'Tax Invoice');
  const isProformaDoc = Boolean(doc.isProforma || doc.documentType === 'Proforma Invoice');
  const isChallanDoc = Boolean(doc.isDeliveryChallan || doc.documentType === 'Delivery Challan');

  const handleSelect = (targetType) => {
    setIsOpen(false);
    onConvert(doc, targetType);
  };

  return (
    <div className="relative inline-block text-left shrink-0" ref={menuRef}>
      {variant === 'button' ? (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={buttonClassName || "flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"}
          title="Create further documents (Proforma, Tax Invoice, Delivery Challan)"
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Generate Document</span>
          <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={buttonClassName || "p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center space-x-0.5"}
          title="Generate further document (Proforma, Tax Invoice, Delivery Challan)"
        >
          <FileCheck2 className="w-4 h-4" />
          <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isOpen && (
        <div 
          className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} mt-1.5 w-64 sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
            Create Further Document
          </div>

          {/* 1. Proforma Invoice (if not already Proforma, Tax Invoice, or Challan) */}
          {!isProformaDoc && !isTaxDoc && !isChallanDoc && (
            <button
              type="button"
              onClick={() => handleSelect('proforma')}
              className="w-full flex items-start space-x-2.5 px-3 py-2 rounded-xl text-left hover:bg-purple-50 transition-colors group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-800 group-hover:text-purple-700 flex items-center justify-between">
                  <span>Proforma Invoice</span>
                  <span className="text-[9px] font-mono text-purple-600 bg-purple-50 px-1 rounded border border-purple-200">PI</span>
                </div>
                <div className="text-[10px] text-slate-500 leading-tight">Commercial offer & advance payment terms</div>
              </div>
            </button>
          )}

          {/* 2. Final Tax Invoice (if not already Tax Invoice or Challan) */}
          {!isTaxDoc && !isChallanDoc && (
            <button
              type="button"
              onClick={() => handleSelect('tax-invoice')}
              className="w-full flex items-start space-x-2.5 px-3 py-2 rounded-xl text-left hover:bg-emerald-50 transition-colors group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Receipt className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 flex items-center justify-between">
                  <span>Final Tax Invoice</span>
                  <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-1 rounded border border-emerald-200">GST</span>
                </div>
                <div className="text-[10px] text-slate-500 leading-tight">Official GST invoice for billing & dispatch</div>
              </div>
            </button>
          )}

          {/* 3. Delivery Challan (Rule 55) */}
          <button
            type="button"
            onClick={() => handleSelect('challan')}
            className="w-full flex items-start space-x-2.5 px-3 py-2 rounded-xl text-left hover:bg-blue-50 transition-colors group cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Truck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700 flex items-center justify-between">
                <span>Delivery Challan</span>
                <span className="text-[9px] font-mono text-blue-600 bg-blue-50 px-1 rounded border border-blue-200">Rule 55</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">Goods dispatch for site installation</div>
            </div>
          </button>

          {/* 4. Demo Delivery Challan */}
          <button
            type="button"
            onClick={() => handleSelect('demo-challan')}
            className="w-full flex items-start space-x-2.5 px-3 py-2 rounded-xl text-left hover:bg-amber-50 transition-colors group cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700 flex items-center justify-between">
                <span>Demo Delivery Challan</span>
                <span className="text-[9px] font-mono text-amber-700 bg-amber-50 px-1 rounded border border-amber-200">Trial</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">7-Day trial / demo without rates & tax</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default React.memo(DocumentConvertMenu);
