import type { Quote } from "./types";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(cents / 100).replace(/\u00a0/g, " ");
}

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function dateLabel(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : singleLine(value);
}

/** Share only the selected quote; never include management URLs or internal status. */
export function formatQuoteMessage(quote: Quote, includeNotes = false) {
  const lines = [
    "*MS AUTO DETAILS*",
    `Orçamento #${String(quote.id).padStart(4, "0")}`,
    `Cliente: ${singleLine(quote.client)}`,
    `Data: ${dateLabel(quote.date)}`,
  ];
  if (quote.validUntil) lines.push(`Válido até: ${dateLabel(quote.validUntil)}`);
  lines.push("", "*Serviços*");

  const calculation = quote.calculation;
  if (calculation) {
    for (const item of calculation.items) {
      lines.push(`• ${singleLine(item.description)}`, `  ${item.quantity} × ${brl(item.unitPriceCents)} = ${brl(item.quantity * item.unitPriceCents)}`);
    }
    lines.push("", `Subtotal dos serviços: ${brl(calculation.subtotalCents)}`);
    if (calculation.travelCents > 0) lines.push(`Deslocamento: ${brl(calculation.travelCents)}`);
    if (calculation.extraCents > 0) lines.push(`Outros adicionais: ${brl(calculation.extraCents)}`);
    if (calculation.discountCents > 0) {
      const percent = calculation.discount.type === "percent"
        ? ` (${(calculation.discount.value / 100).toLocaleString("pt-BR")}%)` : "";
      lines.push(`Desconto${percent}: − ${brl(calculation.discountCents)}`);
    }
  } else {
    lines.push(`• ${singleLine(quote.service)}`);
  }

  lines.push("", `*Total: ${brl(quote.amountCents)}*`);
  if (includeNotes && quote.notes.trim()) lines.push("", "*Observações*", quote.notes.trim());
  return lines.join("\n");
}

/** The owner chooses and confirms the recipient in WhatsApp. No message is sent here. */
export function whatsappQuoteUrl(message: string) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function copyQuoteText(message: string, clipboard?: Pick<Clipboard, "writeText">) {
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}
