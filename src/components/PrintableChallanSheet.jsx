import React from 'react';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { numberToIndianWords } from '../utils/numberToWords';
import { KitsDocumentHeader, KitsDocumentFooter } from './KitsHeaderFooter';
import { DEFAULT_DEMO_TERMS } from './DeliveryChallanManager';

/**
 * Reusable Printable Delivery Challan Sheet (A4 Standard)
 * Supports both Standard Delivery Challans (Rule 55 CGST) and Demo Delivery Challans
 */
export function PrintableChallanSheet({
  challan,
  companySettings,
  copyType = 'ORIGINAL FOR CONSIGNEE',
  isDemo = false
}) {
  if (!challan) return null;

  const selectedChallan = challan;
  const isSelectedDemo = Boolean(isDemo || challan.isDemoChallan || challan.documentType === 'Demo Challan' || challan.type === 'demo-challan');
  const items = Array.isArray(selectedChallan.items) ? selectedChallan.items : [];
  const totalQty = selectedChallan.totalQuantity || items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalValue = Number(selectedChallan.totalAssessableValue || selectedChallan.total || 0);

  return (
    <div className="a4-sheet bg-white text-slate-900 shadow-xl border border-slate-300 w-[210mm] min-h-[297mm] p-6 sm:p-8 flex flex-col justify-between mx-auto box-border relative font-sans text-xs">
      
      <div className="space-y-3.5">
        
        {/* Official KITS Header */}
        <KitsDocumentHeader companySettings={companySettings} />

        {/* Document Title & Copy Type Banner */}
        <div className="relative text-center border-b-2 border-slate-900 pb-2.5 pt-1">
          
          {/* Top Copy Indicator Badge */}
          <div className="absolute right-0 top-0 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-800 bg-slate-100 text-slate-900">
            {copyType}
          </div>

          <h2 className="text-xl font-black tracking-wider text-slate-950 uppercase font-serif">
            {isSelectedDemo ? 'DEMO DELIVERY CHALLAN' : 'DELIVERY CHALLAN'}
          </h2>
          <div className="text-[9.5px] font-bold text-slate-700 tracking-wide mt-0.5 uppercase">
            {isSelectedDemo
              ? '(ISSUED UNDER RULE 55 OF CGST RULES, 2017 FOR DEMONSTRATION / EXHIBITION - NOT FOR SALE)'
              : '(ISSUED UNDER RULE 55 OF CGST RULES, 2017 FOR TRANSPORTATION OF GOODS WITHOUT INVOICE)'}
          </div>
          {isSelectedDemo && (
            <div className="mt-1.5 py-1 px-3 bg-amber-50 border border-amber-300 rounded text-center text-[9.5px] font-black text-amber-900 tracking-wider uppercase">
              NON-COMMERCIAL / DEMO CONSIGNMENT • NOT FOR SALE • RETURNABLE EQUIPMENT
            </div>
          )}
        </div>

        {/* Details Top Grid */}
        <div className="grid grid-cols-2 gap-4 text-[11px] border-b border-slate-300 pb-3">
          
          {/* Left Column: Challan Metadata */}
          <div className="space-y-1">
            <div className="grid grid-cols-[130px_1fr]">
              <span className="font-bold text-slate-900">Delivery Challan No.:</span>
              <span className="font-mono font-black text-slate-950">{selectedChallan.challanNo || selectedChallan.quotationNumber}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr]">
              <span className="font-bold text-slate-900">Challan Date:</span>
              <span className="font-semibold text-slate-950">{formatDate(selectedChallan.date)}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr]">
              <span className="font-bold text-slate-900">Time of Removal:</span>
              <span className="text-slate-800">{selectedChallan.dispatchTime || ''}</span>
            </div>
            <div className="grid grid-cols-[130px_1fr]">
              <span className="font-bold text-slate-900">Nature of Removal:</span>
              <span className="font-bold text-blue-900">{selectedChallan.purpose || (isSelectedDemo ? 'Demonstration / Exhibition' : 'Installation & Commissioning')}</span>
            </div>
            {selectedChallan.projectName && (
              <div className="grid grid-cols-[130px_1fr]">
                <span className="font-bold text-slate-900">Name of Project:</span>
                <span className="font-bold text-slate-950">{selectedChallan.projectName}</span>
              </div>
            )}
          </div>

          {/* Right Column: Transport & Ref Metadata for Standard, or Demo Status for Demo Challan */}
          <div className="space-y-1">
            {isSelectedDemo ? (
              <>
                <div className="grid grid-cols-[130px_1fr]">
                  <span className="font-bold text-slate-900">Consignment Status:</span>
                  <span className="font-semibold text-slate-950">{selectedChallan.status || 'Demo Dispatched'}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr]">
                  <span className="font-bold text-slate-900">Consignment Type:</span>
                  <span className="font-bold text-amber-900">Non-Commercial Trial Goods</span>
                </div>
                <div className="grid grid-cols-[130px_1fr]">
                  <span className="font-bold text-slate-900">Return Policy:</span>
                  <span className="text-slate-800">Returnable Equipment</span>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-[130px_1fr]">
                  <span className="font-bold text-slate-900">Mode of Transport:</span>
                  <span className="font-semibold text-slate-950">{selectedChallan.transportMode || 'Road'}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr]">
                  <span className="font-bold text-slate-900">Vehicle No.:</span>
                  <span className="font-mono font-bold text-slate-950">{selectedChallan.vehicleNo || 'Self / Road'}</span>
                </div>
                <div className="grid grid-cols-[130px_1fr]">
                  <span className="font-bold text-slate-900">LR / GR No. &amp; Date:</span>
                  <span className="text-slate-800">
                    {selectedChallan.lrNumber ? `${selectedChallan.lrNumber} (${formatDate(selectedChallan.lrDate || selectedChallan.date)})` : 'Hand Delivery'}
                  </span>
                </div>
                {selectedChallan.ewayBillNo && (
                  <div className="grid grid-cols-[130px_1fr]">
                    <span className="font-bold text-slate-900">E-Way Bill No.:</span>
                    <span className="font-mono font-bold text-slate-950">{selectedChallan.ewayBillNo}</span>
                  </div>
                )}
                {selectedChallan.linkedDocNumber && (
                  <div className="grid grid-cols-[130px_1fr]">
                    <span className="font-bold text-slate-900">Ref Final Invoice:</span>
                    <span className="font-mono font-bold text-slate-950">{selectedChallan.linkedDocNumber}</span>
                  </div>
                )}
                {selectedChallan.customerPoNo && (
                  <div className="grid grid-cols-[130px_1fr]">
                    <span className="font-bold text-slate-900">Ref PO / Order No.:</span>
                    <span className="text-slate-800">{selectedChallan.customerPoNo}</span>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* Consignor (From) & Consignee (To) Boxes */}
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          
          {/* Left Box: Consignor (Supplier / KITS) */}
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
              Details of Consignor (From):
            </div>
            <div className="font-bold text-slate-950 whitespace-nowrap">
              {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}
            </div>
            <div className="text-slate-700 leading-tight">
              {companySettings?.address || 'Mukta Plaza, KITS Square, Income Tax Chowk, Gaurakshan Road, Akola-444001, Maharashtra'}
            </div>
            <div className="text-slate-900 pt-0.5">
              <span className="font-bold">GSTIN: </span>
              <span className="font-mono font-bold">{companySettings?.gstin || '27AAMCK1536C1ZP'}</span>
            </div>
            <div className="text-slate-900">
              <span className="font-bold">State: </span>Maharashtra
            </div>
          </div>

          {/* Right Box: Consignee (Receiver / Buyer) */}
          <div className="border border-slate-300 rounded p-2.5 bg-slate-50/50 space-y-1">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-1">
              Details of Consignee (Billed &amp; Shipped To):
            </div>
            <div className="font-bold text-slate-950">
              {selectedChallan.clientName || 'Customer Name'}
            </div>
            <div className="text-slate-700 leading-tight">
              {selectedChallan.shipToSameAsBillTo || !selectedChallan.shippingAddress
                ? (selectedChallan.billingAddress || 'Customer Site / Plant Address')
                : selectedChallan.shippingAddress}
            </div>
            {selectedChallan.clientGstin && (
              <div className="text-slate-900 pt-0.5">
                <span className="font-bold">GSTIN / UIN: </span>
                <span className="font-mono font-bold">{selectedChallan.clientGstin}</span>
              </div>
            )}
            <div className="text-slate-900">
              <span className="font-bold">Place of Supply: </span>
              <span>{selectedChallan.placeOfSupply || 'Maharashtra'}</span>
            </div>
          </div>

        </div>

        {/* Table of Goods / Consignment Particulars */}
        <div className="pt-1">
          <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
                <th className="py-2 px-2 border-r border-slate-800 w-8 text-center">Sr.</th>
                <th className="py-2 px-3 border-r border-slate-800">Description of Goods / Machine / Equipment</th>
                {!isSelectedDemo && (
                  <th className="py-2 px-2 border-r border-slate-800 w-24 text-center">HSN / SAC</th>
                )}
                <th className="py-2 px-2 border-r border-slate-800 w-16 text-center">Quantity</th>
                <th className="py-2 px-2 border-r border-slate-800 w-16 text-center">Unit</th>
                {!isSelectedDemo && (
                  <th className="py-2 px-3 border-r border-slate-800 w-24 text-right">Rate (₹)</th>
                )}
                {!isSelectedDemo && (
                  <th className="py-2 px-3 w-28 text-right">Assessable Val (₹)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {Array.isArray(selectedChallan.items) && selectedChallan.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-300">
                  <td className="py-2 px-2 border-r border-slate-800 text-center font-bold text-slate-800">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 border-r border-slate-800">
                    <div className="font-bold text-slate-950">{item.name || item.title}</div>
                    {item.description && (
                      <div className="text-[10px] text-slate-600 mt-0.5 leading-tight">{item.description}</div>
                    )}
                  </td>
                  {!isSelectedDemo && (
                    <td className="py-2 px-2 border-r border-slate-800 text-center font-mono text-[10px]">
                      {item.hsn || item.hsnCode || '-'}
                    </td>
                  )}
                  <td className="py-2 px-2 border-r border-slate-800 text-center font-bold text-slate-950">
                    {item.qty || 1}
                  </td>
                  <td className={isSelectedDemo ? "py-2 px-2 text-center text-slate-700" : "py-2 px-2 border-r border-slate-800 text-center text-slate-700"}>
                    {item.unit || 'Nos'}
                  </td>
                  {!isSelectedDemo && (
                    <td className="py-2 px-3 border-r border-slate-800 text-right font-mono text-slate-800">
                      {formatNumber(item.rate || 0)}
                    </td>
                  )}
                  {!isSelectedDemo && (
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-950">
                      {formatNumber(item.amount || (Number(item.qty || 1) * Number(item.rate || 0)))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold border-t-2 border-slate-800 bg-slate-50 text-slate-950">
              <tr>
                <td colSpan={2} className="py-2 px-3 border-r border-slate-800 text-right uppercase">
                  Total Consignment:
                </td>
                <td className="py-2 px-2 border-r border-slate-800 text-center font-black">
                  {totalQty}
                </td>
                <td className={isSelectedDemo ? "py-2 px-2 text-center text-slate-700" : "py-2 px-2 border-r border-slate-800 text-center text-slate-700"}>
                  Units
                </td>
                {!isSelectedDemo && (
                  <>
                    <td colSpan={2} className="py-2 px-3 border-r border-slate-800 text-right uppercase">
                      Total Assessable Value:
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-black text-slate-950">
                      {formatCurrency(totalValue)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Amount in Words (Strictly hidden for Demo Delivery Challan) */}
        {!isSelectedDemo && (
          <div className="border border-slate-300 rounded px-3 py-2 bg-slate-50 text-[11px]">
            <span className="font-bold text-slate-900">Assessable Value in Words: </span>
            <span className="italic font-serif font-medium text-slate-900">
              {numberToIndianWords(totalValue)}
            </span>
          </div>
        )}

        {/* Remarks & Terms */}
        {(selectedChallan.remarks || isSelectedDemo) && (
          <div className="border border-slate-300 rounded p-2.5 text-[10.5px] space-y-1">
            <div className="font-bold text-slate-900 uppercase text-[9.5px]">
              {isSelectedDemo ? 'Terms & Conditions:' : 'Terms & Purpose Notes:'}
            </div>
            <div className="text-slate-700 whitespace-pre-line leading-relaxed">
              {selectedChallan.remarks || (isSelectedDemo ? DEFAULT_DEMO_TERMS : '')}
            </div>
          </div>
        )}

        {/* Rule 55 Statutory Declaration */}
        <div className="text-[10px] text-slate-700 leading-snug border-l-2 border-blue-600 pl-2 py-0.5">
          <span className="font-bold text-slate-900">Statutory Declaration: </span>
          We hereby certify that the goods described above are being transported strictly for the purpose stated herein under Rule 55 of the CGST Rules, 2017. <strong className="text-slate-950">THIS IS NOT A SALES INVOICE.</strong> No sale is effected through this Delivery Challan.
        </div>

        {/* Dual Signatures & Receiver Acknowledgment Box */}
        <div className="grid grid-cols-2 gap-4 pt-3">
          
          {/* Left: Receiver's Acknowledgment Box */}
          <div className="border-2 border-dashed border-slate-400 rounded-lg p-3 space-y-3 bg-slate-50/30">
            <div className="text-[10.5px] font-black uppercase text-slate-900 tracking-wider">
              CONSIGNEE / RECEIVER'S ACKNOWLEDGMENT
            </div>
            <p className="text-[9.5px] text-slate-600 leading-tight">
              Received the above mentioned goods &amp; machinery in sound condition and verified full quantity as described.
            </p>
            <div className="space-y-1 text-[10px] text-slate-800">
              <div>Receiver's Name: ____________________________</div>
              <div>Date &amp; Time: _________________________________</div>
            </div>
            <div className="h-10 flex items-end">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                Signature &amp; Receiver's Rubber Stamp
              </span>
            </div>
          </div>

          {/* Right: For KITS ROBOTICS & AUTOMATION PVT.LTD. */}
          <div className="border border-slate-300 rounded-lg p-3 flex flex-col justify-between text-right">
            <div>
              <div className="text-[10px] font-bold text-slate-600 uppercase">For Consignor</div>
              <div className="text-xs font-black text-slate-950 whitespace-nowrap">
                {companySettings?.name || 'KITS ROBOTICS & AUTOMATION PVT.LTD.'}
              </div>
            </div>

            <div className="space-y-1 pt-8">
              <div className="text-[10px] font-bold text-slate-900 uppercase">
                Authorized Signatory / Dispatch Officer
              </div>
              <div className="text-[9px] text-slate-500">Subject to Akola Jurisdiction</div>
            </div>
          </div>

        </div>

      </div>

      {/* Official KITS Footer */}
      <KitsDocumentFooter companySettings={companySettings} isSoftware={false} />

    </div>
  );
}

export default React.memo(PrintableChallanSheet);
