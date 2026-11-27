/**
 * High-performance URL-safe compression and sharing utility for KITS Quotations & Documents.
 * Enables zero-backend, instant cross-device document viewing and multi-laptop data sync.
 */

/**
 * Strips heavy transient properties and circular refs before encoding
 */
export function cleanDocumentForSharing(doc) {
  if (!doc || typeof doc !== 'object') return null;

  const {
    id,
    quotationNumber,
    date,
    validityDays,
    category,
    categoryName,
    revision,
    subject,
    clientName,
    customerName,
    clientPhone,
    clientEmail,
    contactPerson,
    billingAddress,
    shippingAddress,
    clientGstin,
    customerGstin,
    clientState,
    clientStateCode,
    items,
    subtotal,
    taxableAmount,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    roundOff,
    grandTotal,
    totalAmount,
    paymentTerms,
    deliveryTerms,
    warrantyTerms,
    gstTerms,
    validityTerms,
    exclusions,
    companyName: _companyName,
    documentType,
    isProforma,
    isTaxInvoice,
    isDeliveryChallan,
    isDemoChallan,
    purpose,
    challanNo,
    invoiceNo,
    vehicleNo,
    transporterName,
    dispatchPlace,
    sourceQuotationNumber,
    notes,
    createdAt
  } = doc;

  // Clean items array to keep only essential fields
  const safeItems = Array.isArray(items)
    ? items.map(item => ({
        id: item.id,
        title: item.title || item.name || '',
        description: item.description || '',
        qty: item.qty ?? 1,
        unit: item.unit || 'Nos',
        unitPrice: item.unitPrice ?? 0,
        hsn: item.hsn || '',
        taxableAmount: item.taxableAmount ?? (Number(item.qty || 1) * Number(item.unitPrice || 0)),
        gstRate: item.gstRate ?? 18
      }))
    : [];

  return {
    id: id || ('quot-' + Date.now()),
    quotationNumber: quotationNumber || challanNo || invoiceNo || 'QUOTATION',
    date: date || new Date().toISOString().split('T')[0],
    validityDays: validityDays || 30,
    category: category || 'Automation Work',
    categoryName: categoryName || category || 'Automation Work',
    revision: revision || 'Rev 0',
    subject: subject || '',
    clientName: clientName || customerName || '',
    clientPhone: clientPhone || '',
    clientEmail: clientEmail || '',
    contactPerson: contactPerson || '',
    billingAddress: billingAddress || '',
    shippingAddress: shippingAddress || billingAddress || '',
    clientGstin: clientGstin || customerGstin || '',
    clientState: clientState || 'Maharashtra',
    clientStateCode: clientStateCode || '27',
    items: safeItems,
    subtotal: subtotal ?? taxableAmount ?? 0,
    taxableAmount: taxableAmount ?? subtotal ?? 0,
    cgstRate: cgstRate ?? 9,
    cgstAmount: cgstAmount ?? 0,
    sgstRate: sgstRate ?? 9,
    sgstAmount: sgstAmount ?? 0,
    igstRate: igstRate ?? 0,
    igstAmount: igstAmount ?? 0,
    roundOff: roundOff ?? 0,
    grandTotal: grandTotal ?? totalAmount ?? 0,
    totalAmount: totalAmount ?? grandTotal ?? 0,
    paymentTerms: paymentTerms || 'Payment Terms: 75% in advance along with PO, 25% before dispatch.',
    deliveryTerms: deliveryTerms || 'Within 1–2 weeks from PO date',
    warrantyTerms: warrantyTerms || '12 months from the date of supply/commissioning',
    gstTerms: gstTerms || 'GST @ 18% extra as applicable',
    validityTerms: validityTerms || '30 days from quotation date',
    exclusions: exclusions || '',
    companyName: 'KITS ROBOTICS & AUTOMATION PVT.LTD.',
    documentType: documentType || (isDeliveryChallan ? 'Delivery Challan' : isTaxInvoice ? 'Final Invoice' : isProforma ? 'Proforma Invoice' : 'Quotation'),
    isProforma: Boolean(isProforma),
    isTaxInvoice: Boolean(isTaxInvoice),
    isDeliveryChallan: Boolean(isDeliveryChallan),
    isDemoChallan: Boolean(isDemoChallan || (purpose === 'Demonstration / Exhibition')),
    purpose: purpose || '',
    challanNo: challanNo || '',
    invoiceNo: invoiceNo || '',
    vehicleNo: vehicleNo || '',
    transporterName: transporterName || '',
    dispatchPlace: dispatchPlace || '',
    sourceQuotationNumber: sourceQuotationNumber || '',
    notes: notes || '',
    createdAt: createdAt || new Date().toISOString()
  };
}

/**
 * Compresses an object into a compact, URL-safe base64 string
 */
export async function compressToUrlSafe(data) {
  try {
    const jsonStr = JSON.stringify(data);

    if (typeof CompressionStream !== 'undefined') {
      const stream = new Blob([jsonStr]).stream();
      const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
      const response = new Response(compressedStream);
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return 'gz.' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // Fallback: standard URL-safe base64
    const utf8Bytes = encodeURIComponent(jsonStr).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    );
    return 'b64.' + btoa(utf8Bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (err) {
    console.error('Compression error:', err);
    throw err;
  }
}

/**
 * Decompresses a URL-safe string back into the original object
 */
export async function decompressFromUrlSafe(str) {
  if (!str || typeof str !== 'string') return null;

  try {
    if (str.startsWith('gz.')) {
      let base64 = str.slice(3).replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      if (typeof DecompressionStream !== 'undefined') {
        const stream = new Blob([bytes]).stream();
        const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
        const response = new Response(decompressedStream);
        const text = await response.text();
        return JSON.parse(text);
      }
    }

    // Handle b64. prefix or raw base64
    const cleanStr = str.startsWith('b64.') ? str.slice(4) : str.startsWith('gz.') ? str.slice(3) : str;
    let base64 = cleanStr.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const binary = atob(base64);
    const decoded = decodeURIComponent(
      Array.prototype.map.call(binary, ch => '%' + ('00' + ch.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(decoded);
  } catch (err) {
    console.warn('Decompression warning (trying raw JSON fallback):', err.message);
    try {
      return JSON.parse(decodeURIComponent(str));
    } catch {
      return null;
    }
  }
}

/**
 * Builds a complete, standalone shareable URL for a quotation or document.
 * This URL can be opened on ANY laptop, mobile device, or tablet to view the document.
 */
export async function buildShareUrl(document) {
  const cleanDoc = cleanDocumentForSharing(document);
  if (!cleanDoc) return window.location.href;

  const code = await compressToUrlSafe(cleanDoc);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${origin}${pathname}#share=${code}`;
}

/**
 * Builds a sync URL containing all data (quotations, clients, catalog products)
 * for one-click transfer between laptops.
 */
export async function buildFullSyncUrl(backupData) {
  if (!backupData) return window.location.href;

  const payload = {
    v: 'kits-sync-v1',
    timestamp: new Date().toISOString(),
    quotations: Array.isArray(backupData.quotations) ? backupData.quotations.map(cleanDocumentForSharing).filter(Boolean) : [],
    clients: Array.isArray(backupData.clients) ? backupData.clients : [],
    products: Array.isArray(backupData.products) ? backupData.products : [],
    settings: backupData.settings || null
  };

  const code = await compressToUrlSafe(payload);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  return `${origin}${pathname}#sync=${code}`;
}

/**
 * Checks window.location (hash or query) for incoming shared documents or sync payloads.
 */
export async function parseIncomingSharePayload() {
  if (typeof window === 'undefined') return null;

  // Check URL hash first (preferred, zero server overhead)
  const hash = window.location.hash || '';
  let payloadStr = null;
  let type = null;

  if (hash.includes('#share=')) {
    payloadStr = hash.split('#share=')[1]?.split('&')[0];
    type = 'quote';
  } else if (hash.includes('#sync=')) {
    payloadStr = hash.split('#sync=')[1]?.split('&')[0];
    type = 'sync';
  }

  // Fallback to query string
  if (!payloadStr) {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('share')) {
      payloadStr = searchParams.get('share');
      type = 'quote';
    } else if (searchParams.has('sync')) {
      payloadStr = searchParams.get('sync');
      type = 'sync';
    }
  }

  if (!payloadStr) return null;

  try {
    const data = await decompressFromUrlSafe(payloadStr);
    if (!data) return null;
    return { type, data };
  } catch (err) {
    console.error('Failed to parse incoming share payload:', err);
    return null;
  }
}

/**
 * Cleans the share / sync payload from the URL without triggering a full page refresh
 */
export function clearShareUrlHash() {
  if (typeof window === 'undefined') return;
  try {
    const currentTab = localStorage.getItem('kits_active_tab') || 'preview';
    window.history.replaceState(null, '', `#${currentTab}`);
  } catch {
    // ignore
  }
}
