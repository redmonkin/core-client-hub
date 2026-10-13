import { getPdfBase64 } from '@/lib/pdf-export';
import { ProposalData, replacePlaceholders } from '@/lib/proposal-utils';

/**
 * The contract as an email attachment: the same render as "Export PDF" in the
 * contract preview. Returns null when there's no template or rendering fails,
 * so a PDF hiccup never stops the contract (and its portal link) going out.
 */
export async function contractPdfAttachment(
  templateContent: string | null | undefined,
  data: ProposalData,
): Promise<{ filename: string; content: string } | null> {
  if (!templateContent) return null;
  try {
    const content = await getPdfBase64(replacePlaceholders(templateContent, data, false));
    // "Retainer contract - Northwind Traders.pdf"; titles like "Annual
    // Maintenance Contract" already say so.
    const title = /contract/i.test(data.title) ? data.title : `${data.title} contract`.trim();
    const name = [title, data.companyName].filter(Boolean).join(' - ');
    return { filename: `${name}.pdf`, content };
  } catch (error) {
    console.error('Failed to attach contract PDF, sending without it:', error);
    return null;
  }
}
