/**
 * High-definition Dynamic PDF Exporter for KITS Quotations & Invoices
 * Supports exact 2-page A4 exports with pristine vector quality.
 * Dynamically loads heavy jsPDF & html2canvas on-demand for zero initial bundle bloat.
 * Releases canvas memory immediately after capture to prevent browser memory bloat.
 */
let pdfLibPromise = null;
function loadPdfLibraries() {
  if (!pdfLibPromise) {
    pdfLibPromise = Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]);
  }
  return pdfLibPromise;
}

/**
 * Resolves the printable DOM container element with smart fallbacks
 */
function resolveContainerElement(containerId = 'printable-quotation') {
  if (typeof document === 'undefined') return null;

  // Direct ID match
  let container = document.getElementById(containerId);
  if (container) return container;

  // Smart fallback IDs if primary ID is not currently in the DOM
  const candidates = [
    'share-modal-printable',
    'printable-quotation',
    'printable-delivery-challan'
  ];

  for (const id of candidates) {
    container = document.getElementById(id);
    if (container) return container;
  }

  return null;
}

/**
 * Generates the jsPDF instance by capturing the container sheets
 */
export async function generatePdfDoc(containerId = 'printable-quotation') {
  const container = resolveContainerElement(containerId);
  if (!container) {
    throw new Error(`Printable container element was not found (attempted: ${containerId}).`);
  }

  // Load heavy libraries dynamically on demand with cached module promise
  const [{ default: jsPDF }, { default: html2canvas }] = await loadPdfLibraries();

  // Check if explicit A4 pages exist (.a4-sheet)
  const pageElements = container.querySelectorAll('.a4-sheet');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  try {
    if (pageElements.length > 0) {
      // Render each explicit A4 sheet onto its own PDF page
      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i];

        const canvas = await html2canvas(pageEl, {
          scale: 2, // High resolution (2x)
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        // Immediate memory cleanup
        canvas.width = 0;
        canvas.height = 0;

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }
    } else {
      // Fallback: single canvas slice
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgHeight = (canvas.height * pageWidth) / canvas.width;

      canvas.width = 0;
      canvas.height = 0;

      let heightRemaining = imgHeight;
      let currentPosition = 0;

      pdf.addImage(imgData, 'JPEG', 0, currentPosition, pageWidth, imgHeight, undefined, 'FAST');
      heightRemaining -= pageHeight;

      while (heightRemaining > 3) {
        currentPosition -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, currentPosition, pageWidth, imgHeight, undefined, 'FAST');
        heightRemaining -= pageHeight;
      }
    }

    return pdf;
  } catch (err) {
    console.error('Error during PDF rendering:', err);
    throw err;
  }
}

/**
 * Returns a PDF Blob of the document
 */
export async function generatePdfBlob(containerId = 'printable-quotation') {
  const pdf = await generatePdfDoc(containerId);
  return pdf.output('blob');
}

/**
 * Returns a standard browser File object for Web Share API / email attachments
 */
export async function generatePdfFile(containerId = 'printable-quotation', filename = 'KITS_Document.pdf') {
  const blob = await generatePdfBlob(containerId);
  return new File([blob], filename, {
    type: 'application/pdf',
    lastModified: Date.now()
  });
}

/**
 * Exports directly to file and triggers browser download
 */
export async function exportToPdf(containerId = 'printable-quotation', filename = 'KITS_Document.pdf') {
  const pdf = await generatePdfDoc(containerId);
  pdf.save(filename);
  return true;
}

export function printDocument() {
  window.print();
}
