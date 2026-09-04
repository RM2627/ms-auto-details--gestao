import { z } from "zod";

export type Client = { id: number; name: string; phone: string; address: string; notes: string };
export type Product = { id: number; name: string; unit: "ml" | "g" | "un"; stockMilli: number; stockValueCents: number; minimumMilli: number };
export type Payment = { id: string; incomeId: number; date: string; amountCents: number; method: string };
export type Usage = { id: string; productId: number; appointmentId: number; productName: string; unit: string; date: string; quantityMilli: number; costCents: number; reversed: number };
export type JobCost = { id: string; appointmentId: number; expenseId: number | null; description: string; amountCents: number };
export type WorkOrder = { appointmentId: number; itemDescription: string; conditionNotes: string; checklist: { label: string; done: boolean }[] };
export type JobPhoto = { id: string; appointmentId: number; stage: "before" | "after" };
export type JobDetails = { usage: Usage[]; costs: JobCost[]; workOrder: WorkOrder | null; photos: JobPhoto[] };
export type ProfitRow = { id: number; date: string; client: string; service: string; status: string; amountCents: number; productCostCents: number; otherCostCents: number };
export type FinancialSummary = {receivedCents:number;receivedCount:number;spentCents:number;expenseCount:number;pendingCents:number;chart:{month:string;ganhos:number;despesas:number}[]};

export const cents = z.number().int().min(0).max(100_000_000);
export const positiveId = z.number().int().positive();
export const operationId = z.string().uuid();
export const quantity = z.number().int().positive().max(1_000_000_000);
export const paymentMethod = z.enum(["pix", "dinheiro", "cartao", "transferencia"]);
export const clientSchema = z.object({ name: z.string().trim().min(1).max(200), phone: z.string().trim().max(40).default(""), address: z.string().trim().max(500).default(""), notes: z.string().trim().max(2000).default("") });
export const productSchema = z.object({ name: z.string().trim().min(1).max(200), unit: z.enum(["ml", "g", "un"]), minimumMilli: quantity.or(z.literal(0)) });
export const orderSchema = z.object({ itemDescription: z.string().trim().max(500), conditionNotes: z.string().trim().max(4000), checklist: z.array(z.object({ label: z.string().trim().min(1).max(150), done: z.boolean() })).max(50) });

export function parseQuantity(value: string) {
  const text = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(text)) throw new Error("Informe uma quantidade válida, com até 3 casas decimais, sem separador de milhar.");
  const [whole, fraction = ""] = text.split(".");
  const result = Number(whole) * 1000 + Number(fraction.padEnd(3, "0"));
  if (!Number.isSafeInteger(result) || result < 0 || result > 1_000_000_000) throw new Error("Quantidade fora do limite permitido.");
  return result;
}

/** 1 part product + waterParts parts water; never infer a manufacturer's ratio. */
export function concentrateMilli(solutionMilli: number, waterParts: number) {
  if (!Number.isSafeInteger(solutionMilli) || solutionMilli <= 0 || !Number.isInteger(waterParts) || waterParts < 0 || waterParts > 1000) throw new Error("Confira a quantidade e a diluição.");
  return Math.max(1, Math.round(solutionMilli / (1 + waterParts)));
}

export function usageCost(product: Product, usedMilli: number) {
  if (!Number.isSafeInteger(usedMilli) || usedMilli <= 0 || usedMilli > product.stockMilli) throw new Error("Estoque insuficiente para esse consumo.");
  return Math.round(product.stockValueCents * usedMilli / product.stockMilli);
}

export function duration(value: unknown = 60) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 15 || result > 1440) throw new Error("A duração deve ser de 15 a 1.440 minutos.");
  return result;
}

export function minutes(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Horário inválido.");
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function scheduleConflicts(a: { date: string; time: string; durationMinutes?: number | null }, b: { date: string; time: string; durationMinutes?: number | null }) {
  return a.date === b.date && minutes(a.time) < minutes(b.time) + (b.durationMinutes ?? 60) && minutes(b.time) < minutes(a.time) + (a.durationMinutes ?? 60);
}

export function weekDates(date: string) {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => { const value = new Date(day); value.setUTCDate(value.getUTCDate() + index); return value.toISOString().slice(0, 10); });
}

export function receivedAmount(income: { status: string; amountCents: number; paidCents?: number }) { return income.paidCents ?? (income.status === "recebido" ? income.amountCents : 0); }
export function remainingAmount(income: { status: string; amountCents: number; paidCents?: number }) { return income.status === "cancelado" ? 0 : Math.max(0, income.amountCents - receivedAmount(income)); }
