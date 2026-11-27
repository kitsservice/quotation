/**
 * Indian GST Reference Data & Calculations for KITS Robotics & Automation Pvt. Ltd.
 */

export const GST_STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh'
};

export const COMMON_HSN_CODES = [
  { code: '84795000', desc: 'Industrial robots for manufacturing & automation', defaultGst: 18 },
  { code: '85371000', desc: 'PLC & HMI electric control and distribution boards (< 1000V)', defaultGst: 18 },
  { code: '84289090', desc: 'Pick & place gantries, overhead hoists, conveyors', defaultGst: 18 },
  { code: '90314900', desc: 'Optical / machine vision inspection systems & sensors', defaultGst: 18 },
  { code: '84799090', desc: 'Parts of industrial machines, grippers & EOAT', defaultGst: 18 },
  { code: '998314', desc: 'IT & Software engineering development services (SAC)', defaultGst: 18 },
  { code: '997331', desc: 'Software licensing & right to use computer software (SAC)', defaultGst: 18 },
  { code: '998313', desc: 'IT consulting, networking & system integration (SAC)', defaultGst: 18 },
  { code: '998717', desc: 'Erection, commissioning, testing & maintenance charges (SAC)', defaultGst: 18 }
];

export const SOFTWARE_SAC_CODES = [
  { code: '998314', desc: 'IT Design & Development (Web, Apps, Software)', defaultGst: 18, label: '998314 - Development' },
  { code: '997331', desc: 'Software Licensing & Right to Use', defaultGst: 18, label: '997331 - License' },
  { code: '998313', desc: 'IT Consulting & System Integration', defaultGst: 18, label: '998313 - Integration' },
  { code: '998315', desc: 'Web & Cloud Application Development', defaultGst: 18, label: '998315 - Web/Cloud' },
  { code: '998717', desc: 'Software Maintenance & AMC Support', defaultGst: 18, label: '998717 - AMC Support' }
];

export const SOFTWARE_UNITS = ['Job', 'Module', 'License', 'System', 'Month', 'User', 'Package', 'Lot', 'Nos'];
export const HARDWARE_UNITS = ['Set', 'Nos', 'Lot', 'System', 'Unit', 'Mtr', 'Job'];

export const HARDWARE_DEFAULT_EXCLUSIONS = [
  'Civil work, if required for installation, will be done by client.',
  'Electrical wiring like Single/Three-phase AC Supply cable for installation provided by client.',
  'Other cables, conduit, CAT-5 cable required for installation will be provided by client.',
  'Stabilized/Uninterrupted power supply provided by client for Automation system.',
  'Unloading of consignment, safe storage on the site until installation will be in the client scope.',
  'The client shall arrange to bring the consignment at the installation location.',
  'For installation, Hydra, scaffolding, ladder (if required) will be in the client scope.',
  'Further, if due to storage at site/warehouse for prolonged periods, refurbishment due to weather deterioration like rust removal, repainting, etc. will be in client scope.'
];

export const HARDWARE_DEFAULT_TERMS = `1. Payment within 15 days.
2. 18% GST will be applicable.
3. Offer valid for 30 days.`;

export const SOFTWARE_DEFAULT_TERMS = `1. Payment Terms: 40% Advance with PO, 40% on Demo/Testing, 20% on final launch & handover.
2. Delivery Timeline: 3–6 weeks from receipt of advance and complete project content/materials.
3. Client Scope: Domain, Cloud Server/Hosting, and raw content (text, images, logos) to be provided by client.
4. Third-Party Charges: Payment Gateway, SMS, WhatsApp API, and Play Store account fees to be borne by client.
5. Revisions & Scope: Up to 2 design revisions included; new feature additions will be quoted separately.
6. Support & Bug Fixes: 3–6 months complimentary bug fixing and technical support from go-live date.
7. Handover: Complete access and credentials will be released upon 100% payment clearance.
8. Validity: Offer valid for 30 days. GST 18% extra.`;

export const SOFTWARE_DEFAULT_EXCLUSIONS = [
  'All project content, text, company profile, high-resolution logos, and images must be provided by the client in digital format.',
  'Domain registration, web/cloud server hosting fees (e.g. AWS, Hostinger, DigitalOcean), and SSL certificates are in client scope.',
  'Third-party paid API services (Payment Gateways, SMS OTP, WhatsApp API, Google Maps API, etc.) shall be billed directly to the client.',
  'Quotation includes up to 2 rounds of UI/UX design revisions; any major structural scope changes or new features will be charged extra.',
  'For Mobile Apps (Android/iOS), Google Play Console ($25 one-time) and Apple App Store ($99/year) developer account fees are in client scope.',
  'Source code rights and complete server/app credentials will be released upon 100% full and final payment settlement.',
  'Client will provide necessary server/VPN access, machine communication protocols (if applicable), and technical contact during UAT.',
  'Complimentary 3–6 months bug-fixing support included from go-live; subsequent maintenance or feature additions covered under AMC.'
];

const stateFromGstinCache = new Map();
const MAX_STATE_CACHE_SIZE = 250;

/**
 * Returns state name and code inferred from first 2 digits of GSTIN
 */
export function getStateFromGstin(gstin = '') {
  if (!gstin || typeof gstin !== 'string') return null;
  const clean = gstin.trim().toUpperCase();
  if (stateFromGstinCache.has(clean)) {
    return stateFromGstinCache.get(clean);
  }

  let result = null;
  if (clean.length >= 2) {
    const code = clean.slice(0, 2);
    if (GST_STATE_CODES[code]) {
      result = { code, state: GST_STATE_CODES[code] };
    }
  }

  if (stateFromGstinCache.size >= MAX_STATE_CACHE_SIZE) {
    stateFromGstinCache.clear();
  }
  stateFromGstinCache.set(clean, result);
  return result;
}

/**
 * Determines whether the supply is Intra-State (CGST + SGST) or Inter-State (IGST)
 * Robustly accepts state names (e.g. 'Maharashtra'), state codes ('27'), or GSTIN strings (e.g. '27AAMCK...').
 */
export function isIntraStateSupply(clientInput = '', companyInput = 'Maharashtra') {
  if (!clientInput) return true;
  if (clientInput === companyInput) return true;

  // Resolve client state
  let clientState = String(clientInput).trim();
  const clientFromGst = getStateFromGstin(clientState);
  if (clientFromGst) {
    clientState = clientFromGst.state;
  } else if (GST_STATE_CODES[clientState]) {
    clientState = GST_STATE_CODES[clientState];
  }

  // Resolve company state
  let companyState = String(companyInput || 'Maharashtra').trim();
  const companyFromGst = getStateFromGstin(companyState);
  if (companyFromGst) {
    companyState = companyFromGst.state;
  } else if (GST_STATE_CODES[companyState]) {
    companyState = GST_STATE_CODES[companyState];
  }

  return clientState.toLowerCase() === companyState.toLowerCase();
}

/**
 * Computes complete GST breakdown including HSN-wise tax summary
 */
export function computeFinancialBreakdown(items = [], extraCharges = {}, companyState = 'Maharashtra', clientState = 'Maharashtra') {
  let subtotal = 0;
  let totalCost = 0;
  
  // Group by HSN/SAC
  const hsnSummaryMap = {};
  const safeItems = Array.isArray(items) ? items : [];

  for (let i = 0; i < safeItems.length; i++) {
    const item = safeItems[i];
    if (!item || item.isOptional) continue;

    const qty = parseFloat(item.qty) || 0;
    const unitPrice = parseFloat(item.unitPrice !== undefined ? item.unitPrice : (item.rate || 0)) || 0;
    const discountPercent = parseFloat(item.discountPercent !== undefined ? item.discountPercent : (item.discount || 0)) || 0;
    const costPrice = parseFloat(item.costPrice) || 0;
    const gstRate = parseFloat(item.gstRate !== undefined ? item.gstRate : (item.gst || 18)) || 0;

    const baseAmount = qty * unitPrice;
    const discountAmount = (baseAmount * discountPercent) / 100;
    const taxableAmount = Math.max(0, baseAmount - discountAmount);
    const itemCost = costPrice * qty;

    subtotal += taxableAmount;
    totalCost += itemCost;

    const hsnKey = item.hsn || item.hsnCode || 'General';
    if (!hsnSummaryMap[hsnKey]) {
      hsnSummaryMap[hsnKey] = {
        hsn: hsnKey,
        taxable: 0,
        gstRate,
        taxAmount: 0
      };
    }
    hsnSummaryMap[hsnKey].taxable += taxableAmount;
    hsnSummaryMap[hsnKey].taxAmount += (taxableAmount * gstRate) / 100;
  }

  const packaging = parseFloat(extraCharges?.packagingCharges) || 0;
  const freight = parseFloat(extraCharges?.freightCharges) || 0;
  const other = parseFloat(extraCharges?.otherCharges) || 0;
  const discountOnTotal = parseFloat(extraCharges?.discountOnTotal) || 0;

  const totalExtra = packaging + freight + other;
  // Apply standard 18% GST on packaging/freight/ancillary services if applicable
  const extraChargesGst = (totalExtra * 18) / 100;

  if (totalExtra > 0) {
    const extraKey = '996511 / Freight & P&F';
    if (!hsnSummaryMap[extraKey]) {
      hsnSummaryMap[extraKey] = {
        hsn: extraKey,
        taxable: 0,
        gstRate: 18,
        taxAmount: 0
      };
    }
    hsnSummaryMap[extraKey].taxable += totalExtra;
    hsnSummaryMap[extraKey].taxAmount += extraChargesGst;
  }

  const netTaxable = Math.max(0, subtotal + totalExtra - discountOnTotal);
  
  // Total tax from all HSN buckets
  const hsnSummaryList = Object.values(hsnSummaryMap);
  let totalGst = 0;
  for (let i = 0; i < hsnSummaryList.length; i++) {
    totalGst += hsnSummaryList[i].taxAmount;
  }

  const isIntraState = isIntraStateSupply(clientState, companyState);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isIntraState) {
    cgstAmount = totalGst / 2;
    sgstAmount = totalGst / 2;
  } else {
    igstAmount = totalGst;
  }

  const rawGrandTotal = netTaxable + totalGst;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = parseFloat((grandTotal - rawGrandTotal).toFixed(2));

  const totalProfit = subtotal - totalCost;
  const profitMarginPercent = subtotal > 0 ? parseFloat(((totalProfit / subtotal) * 100).toFixed(1)) : 0;

  return {
    subtotal,
    totalCost,
    packagingCharges: packaging,
    freightCharges: freight,
    otherCharges: other,
    discountOnTotal,
    totalExtra,
    netTaxable,
    totalGst,
    isIntraState,
    cgstAmount,
    sgstAmount,
    igstAmount,
    roundOff,
    grandTotal,
    totalProfit,
    profitMarginPercent,
    hsnSummary: hsnSummaryList
  };
}
