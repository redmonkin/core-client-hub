import DOMPurify from 'dompurify';

/**
 * Before rendering to canvas, split heading text nodes into
 * individual word spans with explicit margins so html2canvas
 * doesn't collapse the whitespace.
 */
function preserveWordSpacing(root: HTMLElement) {
  root.querySelectorAll('h1, h2, h3, p, td, th, li, span, strong, em, b, i').forEach((el) => {
    const element = el as HTMLElement;
    // Only process leaf text nodes
    if (element.children.length > 0) return;
    const text = element.textContent || '';
    if (!text.includes(' ')) return;

    // Replace spaces with non-breaking spaces + zero-width space
    // This forces html2canvas to preserve word gaps
    element.innerHTML = text.replace(/ /g, '&nbsp; ');
  });
}

// Shared by exportToPdf (triggers a browser download) and getPdfBase64
// (returns the bytes for e.g. an email attachment) so both stay pixel-
// identical -- same single-canvas html2canvas + jsPDF render, just a
// different final step.
async function renderPdf(html: string) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const MARGIN_MM = 15;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
  const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '680px';
  container.style.background = '#ffffff';
  document.body.appendChild(container);

  container.innerHTML = `
    <style>
      .pdf-content {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #1a1a1a;
        padding: 10px 0;
        max-width: 100%;
        word-wrap: break-word;
      }
      .pdf-content h1 { font-size: 26px; font-weight: 700; margin: 28px 0 12px; color: #111827; line-height: 1.3; }
      .pdf-content h2 { font-size: 21px; font-weight: 700; margin: 24px 0 10px; color: #111827; line-height: 1.3; }
      .pdf-content h3 { font-size: 17px; font-weight: 600; margin: 20px 0 8px; color: #111827; line-height: 1.4; }
      .pdf-content p { margin: 0 0 12px; color: #374151; }
      .pdf-content strong, .pdf-content b { font-weight: 700; color: #111827; }
      .pdf-content em, .pdf-content i { font-style: italic; }
      .pdf-content ul { list-style-type: disc; margin: 8px 0 12px; padding-left: 24px; }
      .pdf-content ol { list-style-type: decimal; margin: 8px 0 12px; padding-left: 24px; }
      .pdf-content li { margin: 4px 0; padding-left: 4px; color: #374151; }
      .pdf-content li > ul, .pdf-content li > ol { margin: 4px 0; }
      .pdf-content blockquote { border-left: 3px solid #d1d5db; margin: 12px 0; padding: 8px 16px; color: #6b7280; font-style: italic; }
      .pdf-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
      .pdf-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
      .pdf-content table th { background: #f3f4f6; border-bottom: 2px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; }
      .pdf-content table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; }
      .pdf-content table tfoot td { font-weight: 600; }
      .pdf-content img { max-width: 100%; height: auto; }
    </style>
    <div class="pdf-content">${DOMPurify.sanitize(html)}</div>
  `;

  try {
    const contentEl = container.querySelector('.pdf-content') as HTMLElement;
    preserveWordSpacing(contentEl);

    const canvas = await html2canvas(contentEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
    const pageHeightPx = Math.floor(CONTENT_HEIGHT_MM * pxPerMm);
    const totalPages = Math.ceil(canvas.height / pageHeightPx);

    for (let page = 0; page < totalPages; page++) {
      if (page > 0) pdf.addPage();

      const srcY = page * pageHeightPx;
      const sliceHeight = Math.min(pageHeightPx, canvas.height - srcY);

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

      ctx.drawImage(
        canvas,
        0, srcY, canvas.width, sliceHeight,
        0, 0, canvas.width, sliceHeight
      );

      const sliceHeightMm = sliceHeight / pxPerMm;
      pdf.addImage(
        pageCanvas.toDataURL('image/png'),
        'PNG',
        MARGIN_MM,
        MARGIN_MM,
        CONTENT_WIDTH_MM,
        sliceHeightMm
      );
    }

    return pdf;
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportToPdf(html: string, filename: string) {
  const pdf = await renderPdf(html);
  pdf.save(filename);
}

// Returns the PDF as base64 (no data: URI prefix) -- e.g. for a Resend
// email attachment -- without triggering a browser download.
export async function getPdfBase64(html: string): Promise<string> {
  const pdf = await renderPdf(html);
  return pdf.output('datauristring').split(',')[1];
}
