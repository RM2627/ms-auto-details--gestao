import { z } from "zod";

export const MAX_QUOTE_ITEMS = 50;
const MAX_MONEY_CENTS = 100_000_000;

const moneySchema = z.number({ invalid_type_error: "Informe um valor válido." })
  .int("Os valores devem estar em centavos inteiros.")
  .min(0, "Os valores não podem ser negativos.")
  .max(MAX_MONEY_CENTS, "O valor informado é muito alto.");

const quoteInputSchema = z.object({
  items: z.array(z.object({
    description: z.string().trim().min(1, "Descreva todos os itens do serviço.").max(200, "Use até 200 caracteres por item."),
    quantity: z.number({ invalid_type_error: "Informe uma quantidade válida." }).int("A quantidade deve ser inteira.").min(1, "A quantidade mínima é 1.").max(1000, "A quantidade máxima por item é 1.000."),
    unitPriceCents: moneySchema,
  })).min(1, "Adicione pelo menos um item.").max(MAX_QUOTE_ITEMS, "Use até 50 itens por orçamento."),
  travelCents: moneySchema.default(0),
  extraCents: moneySchema.default(0),
  discount: z.object({
    type: z.enum(["fixed", "percent"]),
    // Fixed: cents. Percent: hundredths of a percent (10% = 1000).
    value: moneySchema,
  }).default({ type: "fixed", value: 0 }),
});

export type QuoteItem = z.infer<typeof quoteInputSchema>["items"][number];
export type QuoteCalculation = z.infer<typeof quoteInputSchema> & {
  version: 1;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
};

/** Canonical calculation shared by the form and API. Client totals are ignored. */
export function calculateQuote(input: unknown): QuoteCalculation {
  const result = quoteInputSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0].message);
  const data = result.data;
  const subtotalCents = data.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const grossCents = subtotalCents + data.travelCents + data.extraCents;
  if (!Number.isSafeInteger(grossCents) || grossCents > MAX_MONEY_CENTS) {
    throw new Error("O total do orçamento é muito alto.");
  }
  if (data.discount.type === "percent" && data.discount.value > 10_000) {
    throw new Error("O desconto não pode ultrapassar 100%.");
  }
  // All arithmetic is on integer cents; round the percentage discount once.
  const discountCents = data.discount.type === "percent"
    ? Math.round(grossCents * data.discount.value / 10_000)
    : data.discount.value;
  if (discountCents > grossCents) throw new Error("O desconto não pode ser maior que o orçamento.");
  return { ...data, version: 1, subtotalCents, discountCents, totalCents: grossCents - discountCents };
}

/** Accept BRL input without binary floating-point multiplication. */
export function parseMoneyInput(value: string, optional = false): number {
  const text = value.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!text && optional) return 0;
  // Brazilian grouping: 1.234,56; also accept a decimal point from mobile keyboards.
  const br = text.match(/^(\d+|\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/);
  const decimal = br ? null : text.match(/^(\d+)\.(\d{1,2})$/);
  const match = br ?? decimal;
  if (!match) throw new Error("Informe um valor válido, como 120,00.");
  const whole = Number(match[1].replace(/\./g, ""));
  const cents = whole * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_MONEY_CENTS) throw new Error("O valor informado é muito alto.");
  return cents;
}

export type QuoteItemDraft = { id: number; description: string; quantity: string; unitPrice: string; catalogServiceId?: number };
export type QuoteDraft = {
  items: QuoteItemDraft[];
  travel: string;
  extra: string;
  discountType: "fixed" | "percent";
  discountValue: string;
};

export function emptyQuoteDraft(): QuoteDraft {
  return { items: [{ id: 0, description: "", quantity: "1", unitPrice: "" }], travel: "", extra: "", discountType: "fixed", discountValue: "" };
}

export function addCatalogService(draft: QuoteDraft, service: { id: number; name: string; priceCents: number | null }): QuoteDraft {
  if (service.priceCents === null) throw new Error("Defina o preço deste serviço na aba Serviços.");
  const empty = draft.items.find((item) => !item.description && !item.unitPrice);
  if (!empty && draft.items.length >= MAX_QUOTE_ITEMS) return draft;
  const item: QuoteItemDraft = { id: empty?.id ?? Math.max(-1, ...draft.items.map((row) => row.id)) + 1, description: service.name, quantity: "1", unitPrice: (service.priceCents / 100).toFixed(2).replace(".", ","), catalogServiceId: service.id };
  return { ...draft, items: empty ? draft.items.map((row) => row.id === empty.id ? item : row) : [...draft.items, item] };
}

export function calculateQuoteDraft(draft: QuoteDraft, preview = false): QuoteCalculation {
  return calculateQuote({
    items: draft.items.map((item) => ({
      description: preview ? item.description.trim() || "Item" : item.description,
      quantity: /^\d+$/.test(item.quantity) ? Number(item.quantity) : Number.NaN,
      unitPriceCents: parseMoneyInput(item.unitPrice, preview),
    })),
    travelCents: parseMoneyInput(draft.travel, true),
    extraCents: parseMoneyInput(draft.extra, true),
    discount: { type: draft.discountType, value: parseMoneyInput(draft.discountValue, true) },
  });
}

/** Keep the legacy single-price flow valid for old clients and saved quotes. */
export function quotePricing(data: Record<string, unknown>) {
  if (data.calculation !== undefined && data.calculation !== null) {
    const calculation = calculateQuote(data.calculation);
    return {
      calculation,
      service: calculation.items.map((item) => `${item.quantity}× ${item.description}`).join(" + "),
      amountCents: calculation.totalCents,
    };
  }
  const service = typeof data.service === "string" ? data.service.trim() : "";
  if (!service) throw new Error("Serviço é obrigatório.");
  const parsed = moneySchema.safeParse(data.amountCents);
  if (!parsed.success) throw new Error("Informe um valor válido.");
  return { service, amountCents: parsed.data, calculation: null };
}
