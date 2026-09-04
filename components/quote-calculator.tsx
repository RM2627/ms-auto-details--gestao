"use client";

import { Calculator, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { addCatalogService, calculateQuoteDraft, MAX_QUOTE_ITEMS, parseMoneyInput, type QuoteCalculation, type QuoteDraft, type QuoteItemDraft } from "@/lib/quote-calculator";
import { groupServices, type Service } from "@/lib/service-catalog";
import type { Quote } from "@/lib/types";

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function QuoteTotals({ calculation }: { calculation: QuoteCalculation }) {
  const discountLabel = calculation.discount.type === "percent"
    ? `Desconto (${(calculation.discount.value / 100).toLocaleString("pt-BR")}%)`
    : "Desconto";
  return <dl className="space-y-2 text-sm">
    <div className="flex justify-between gap-4"><dt>Itens do serviço</dt><dd className="font-medium tabular-nums">{brl(calculation.subtotalCents)}</dd></div>
    <div className="flex justify-between gap-4"><dt>Deslocamento</dt><dd className="tabular-nums">{brl(calculation.travelCents)}</dd></div>
    <div className="flex justify-between gap-4"><dt>Outros adicionais</dt><dd className="tabular-nums">{brl(calculation.extraCents)}</dd></div>
    <div className="flex justify-between gap-4"><dt>{discountLabel}</dt><dd className="tabular-nums">− {brl(calculation.discountCents)}</dd></div>
    <div className="flex items-center justify-between gap-4 border-t border-red-200 pt-3 font-bold text-neutral-950"><dt>Total do orçamento</dt><dd className="text-2xl tabular-nums">{brl(calculation.totalCents)}</dd></div>
  </dl>;
}

export function QuoteCalculator({ draft, onChange, services, catalogLoading = false, catalogError = "", disabled = false }: {
  draft: QuoteDraft;
  onChange: (draft: QuoteDraft) => void;
  services: Service[];
  catalogLoading?: boolean;
  catalogError?: string;
  disabled?: boolean;
}) {
  let calculation: QuoteCalculation | null = null;
  let calculationError = "";
  try { calculation = calculateQuoteDraft(draft, true); }
  catch (error) { calculationError = error instanceof Error ? error.message : "Confira os valores dos itens."; }

  function updateItem(id: number, values: Partial<QuoteItemDraft>) {
    onChange({ ...draft, items: draft.items.map((item) => item.id === id ? { ...item, ...values } : item) });
  }

  function addItem(description = "", unitPrice = "") {
    const empty = draft.items.find((item) => !item.description && !item.unitPrice);
    if (description && empty) { updateItem(empty.id, { description, unitPrice }); return; }
    if (draft.items.length >= MAX_QUOTE_ITEMS) return;
    onChange({ ...draft, items: [...draft.items, { id: Math.max(-1, ...draft.items.map((row) => row.id)) + 1, description, quantity: "1", unitPrice }] });
  }

  function selectSuggestion(value: string) {
    const service = services.find((item) => item.id === Number(value));
    if (service && service.priceCents !== null) onChange(addCatalogService(draft, service));
  }

  return <fieldset disabled={disabled} className="min-w-0 space-y-4 [&_[data-slot=native-select-wrapper]]:w-full">
    <legend className="mb-2 flex items-center gap-2 font-semibold text-neutral-900"><Calculator className="size-4 text-red-700" />Calculadora de orçamento</legend>
    <p className="text-sm leading-6 text-neutral-500">Selecione os serviços com preço fixo e informe a quantidade. Acrescente deslocamento, adicionais ou desconto quando necessário.</p>
    <div className="space-y-2">
      <Label htmlFor="quote-suggestion">Adicionar um serviço</Label>
      <NativeSelect id="quote-suggestion" value="" onChange={(event) => selectSuggestion(event.target.value)} disabled={catalogLoading || Boolean(catalogError) || (draft.items.length >= MAX_QUOTE_ITEMS && !draft.items.some((item) => !item.description && !item.unitPrice))}>
        <NativeSelectOption value="">{catalogLoading ? "Carregando serviços..." : "Escolha um serviço cadastrado"}</NativeSelectOption>
        {groupServices(services).map((category) => <NativeSelectOptGroup key={category.name} label={category.name}>{category.services.map((service) => <NativeSelectOption key={service.id} value={service.id} disabled={service.priceCents === null}>{service.name} · {service.priceCents === null ? "Preço a definir" : brl(service.priceCents)}</NativeSelectOption>)}</NativeSelectOptGroup>)}
      </NativeSelect>
      {catalogError && <p role="alert" className="text-sm text-red-700">{catalogError}</p>}
      <p className="text-sm leading-6 text-neutral-500">Cadastre e altere os preços na aba Serviços. Itens sem preço não podem ser selecionados. Para um serviço fora do catálogo, preencha um item avulso.</p>
    </div>

    <div className="space-y-3">{draft.items.map((item, index) => {
      let lineTotal = "—";
      try {
        if (/^\d+$/.test(item.quantity) && Number(item.quantity) >= 1 && Number(item.quantity) <= 1000) {
          lineTotal = brl(Number(item.quantity) * parseMoneyInput(item.unitPrice, true));
        }
      } catch { /* Keep an invalid input visible for correction without inventing a total. */ }
      return <div key={item.id} className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Item {index + 1}{item.catalogServiceId ? " · Preço do catálogo" : " · Avulso"}</p><Button type="button" variant="ghost" size="icon" aria-label={`Remover item ${index + 1}`} onClick={() => onChange({ ...draft, items: draft.items.length === 1 ? [{ id: item.id, description: "", quantity: "1", unitPrice: "" }] : draft.items.filter((row) => row.id !== item.id) })}><Trash2 className="size-4 text-neutral-500" /></Button></div>
        <div className="space-y-2"><Label htmlFor={`quote-description-${item.id}`}>O que será feito?</Label><Input id={`quote-description-${item.id}`} required readOnly={Boolean(item.catalogServiceId)} maxLength={200} value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Ex.: Higienização de sofá de 3 lugares" /></div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor={`quote-quantity-${item.id}`}>Quantidade</Label><Input id={`quote-quantity-${item.id}`} type="number" inputMode="numeric" min={1} max={1000} step={1} required value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor={`quote-price-${item.id}`}>Valor unitário (R$)</Label><Input id={`quote-price-${item.id}`} inputMode="decimal" required readOnly={Boolean(item.catalogServiceId)} value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} placeholder="0,00" /></div>
        </div>
        <p className="mt-3 text-right text-sm text-neutral-500">Total do item: <span className="font-semibold tabular-nums text-neutral-900">{lineTotal}</span></p>
      </div>;
    })}</div>
    <Button type="button" variant="outline" className="w-full border-dashed" disabled={draft.items.length >= MAX_QUOTE_ITEMS} onClick={() => addItem()}><Plus />Adicionar item avulso</Button>

    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="quote-travel">Deslocamento (R$)</Label><Input id="quote-travel" inputMode="decimal" value={draft.travel} onChange={(event) => onChange({ ...draft, travel: event.target.value })} placeholder="0,00" /></div>
      <div className="space-y-2"><Label htmlFor="quote-extra">Outros adicionais (R$)</Label><Input id="quote-extra" inputMode="decimal" value={draft.extra} onChange={(event) => onChange({ ...draft, extra: event.target.value })} placeholder="0,00" /></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2"><Label htmlFor="quote-discount-type">Tipo de desconto</Label><NativeSelect id="quote-discount-type" value={draft.discountType} onChange={(event) => onChange({ ...draft, discountType: event.target.value as QuoteDraft["discountType"], discountValue: "" })}><NativeSelectOption value="fixed">Em reais (R$)</NativeSelectOption><NativeSelectOption value="percent">Porcentagem (%)</NativeSelectOption></NativeSelect></div>
      <div className="space-y-2"><Label htmlFor="quote-discount">{draft.discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}</Label><Input id="quote-discount" inputMode="decimal" value={draft.discountValue} onChange={(event) => onChange({ ...draft, discountValue: event.target.value })} placeholder="0" /></div>
    </div>
    <p className="text-xs leading-5 text-neutral-500">O desconto é aplicado sobre itens + deslocamento + adicionais. Valores extras são opcionais.</p>
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-neutral-600" aria-live="polite" aria-atomic="true">
      {calculation ? <QuoteTotals calculation={calculation} /> : <p role="alert" className="text-sm text-red-700">{calculationError}</p>}
    </div>
  </fieldset>;
}

export function QuoteBreakdown({ quote }: { quote: Quote }) {
  if (!quote.calculation) return null;
  const calculation = quote.calculation;
  return <Accordion type="single" collapsible className="border-t border-neutral-100 px-4">
    <AccordionItem value="calculation">
      <AccordionTrigger className="py-3 text-red-800">Ver cálculo do orçamento · {calculation.items.length} {calculation.items.length === 1 ? "item" : "itens"}</AccordionTrigger>
      <AccordionContent>
        <ul className="mb-4 space-y-3">{calculation.items.map((item, index) => <li key={index} className="flex justify-between gap-4"><div className="min-w-0"><p className="break-words font-medium text-neutral-800">{item.description}</p><p className="mt-1 text-xs text-neutral-500">{item.quantity} × {brl(item.unitPriceCents)}</p></div><span className="shrink-0 font-medium tabular-nums">{brl(item.quantity * item.unitPriceCents)}</span></li>)}</ul>
        <div className="rounded-xl bg-red-50 p-4 text-neutral-600"><QuoteTotals calculation={calculation} /></div>
        {quote.notes && <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-500">{quote.notes}</p>}
      </AccordionContent>
    </AccordionItem>
  </Accordion>;
}
