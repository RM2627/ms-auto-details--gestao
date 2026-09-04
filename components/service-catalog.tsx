"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { groupServices, initialServiceCategories, serviceInput, type Service } from "@/lib/service-catalog";
import { parseMoneyInput } from "@/lib/quote-calculator";
import { apiFetch } from "@/lib/api-client";

function brl(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }

async function requestCatalog(method: string, body?: object) {
  const response = await apiFetch("/api/services", { method, cache: "no-store", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível carregar os serviços.");
  return result;
}

export async function loadServiceCatalog(): Promise<Service[]> {
  const catalog = await requestCatalog("GET");
  return catalog.initialized ? catalog.services : (await requestCatalog("POST", { action: "initialize" })).services;
}

export function ServiceForm({ service, categories, onSaved, onCancel }: { service: Service | null; categories: string[]; onSaved: () => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState(service?.category ?? initialServiceCategories[0].name);
  const [price, setPrice] = useState(service?.priceCents == null ? "" : (service.priceCents / 100).toFixed(2).replace(".", ","));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      const data = serviceInput({ name, category, priceCents: parseMoneyInput(price) });
      await requestCatalog(service ? "PATCH" : "POST", { ...(service ? { id: service.id } : {}), data });
      await onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar o serviço."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <fieldset disabled={saving} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="service-name">Nome do serviço</Label><Input id="service-name" required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Lavagem completa" /></div>
      <div className="space-y-2"><Label htmlFor="service-category">Categoria</Label><Input id="service-category" required maxLength={100} list="service-categories" value={category} onChange={(event) => setCategory(event.target.value)} /><datalist id="service-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist></div>
      <div className="space-y-2"><Label htmlFor="service-price">Preço fixo por unidade (R$)</Label><Input id="service-price" required inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Informe o seu preço" /></div>
      <p className="text-sm leading-6 text-neutral-500">Este valor será usado nos novos orçamentos. Deslocamento, adicionais e descontos continuam separados. Orçamentos já salvos não mudam.</p>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onCancel}>Voltar</Button><Button type="submit" disabled={saving}>{saving && <LoaderCircle className="animate-spin" />}{saving ? "Salvando..." : "Salvar serviço"}</Button></DialogFooter>
  </form>;
}

export function ServiceCatalog({ services, loading, error, onReload }: { services: Service[]; loading: boolean; error: string; onReload: () => Promise<void> }) {
  const [editing, setEditing] = useState<Service | null | undefined>();
  const [removing, setRemoving] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [notice, setNotice] = useState("");
  const categories = [...new Set([...initialServiceCategories.map((item) => item.name), ...services.map((item) => item.category)])];

  async function remove() {
    if (!removing || saving) return;
    setSaving(true); setRemoveError("");
    try {
      await requestCatalog("DELETE", { id: removing.id });
      setRemoving(null); setNotice("Serviço removido. Os orçamentos anteriores foram preservados.");
      await onReload();
    } catch (caught) { setRemoveError(caught instanceof Error ? caught.message : "Não foi possível remover."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-medium text-red-700">Controle da MS</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Serviços</h1><p className="mt-1 text-sm leading-6 text-neutral-500">Cadastre os serviços e defina o preço fixo de cada um.</p></div><Button disabled={loading || Boolean(error)} onClick={() => { setNotice(""); setEditing(null); }}><Plus />Novo serviço</Button></div>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><Button variant="outline" onClick={() => void onReload()}>Tentar novamente</Button></div>
      : loading ? <p role="status" className="py-12 text-center text-neutral-500">Carregando serviços...</p>
        : services.length === 0 ? <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-neutral-500">Nenhum serviço cadastrado. Use Novo serviço para começar.</p>
          : <>
            {services.some((service) => service.priceCents === null) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Seus serviços anteriores estão aqui. Defina os preços para selecioná-los nos orçamentos. Nenhum valor foi presumido.</p>}
            {groupServices(services).map((group) => <section key={group.name} className="space-y-3"><h2 className="text-lg font-semibold">{group.name}</h2><div className="grid gap-3 xl:grid-cols-2">{group.services.map((service) => <article key={service.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"><div className="min-w-0 flex-1 basis-44"><h3 className="break-words font-medium">{service.name}</h3><p className={`mt-1 text-sm ${service.priceCents === null ? "text-amber-700" : "font-semibold text-neutral-950"}`}>{service.priceCents === null ? "Preço a definir" : `${brl(service.priceCents)} por unidade`}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" aria-label={`Editar ${service.name}`} onClick={() => { setNotice(""); setEditing(service); }}><Pencil />{service.priceCents === null ? "Definir preço" : "Editar"}</Button><Button variant="ghost" size="icon" aria-label={`Remover ${service.name}`} className="text-neutral-500 hover:text-red-700" onClick={() => { setRemoveError(""); setRemoving(service); }}><Trash2 /></Button></div></article>)}</div></section>)}
          </>}
    <Dialog open={editing !== undefined} onOpenChange={(open) => { if (!open) setEditing(undefined); }}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl"><DialogHeader><DialogTitle>{editing ? "Editar serviço" : "Novo serviço"}</DialogTitle><DialogDescription>Defina o valor base para os próximos orçamentos.</DialogDescription></DialogHeader>{editing !== undefined && <ServiceForm key={editing?.id ?? "new"} service={editing} categories={categories} onCancel={() => setEditing(undefined)} onSaved={async () => { setEditing(undefined); setNotice("Serviço salvo. O novo preço está disponível para os próximos orçamentos."); await onReload(); }} />}</DialogContent></Dialog>
    <AlertDialog open={Boolean(removing)} onOpenChange={(open) => { if (!open && !saving) setRemoving(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover {removing?.name}?</AlertDialogTitle><AlertDialogDescription>O serviço deixará de aparecer na seleção de novos orçamentos. Os orçamentos já salvos, seus valores e agendamentos não serão alterados.</AlertDialogDescription></AlertDialogHeader>{removeError && <p role="alert" className="text-sm text-red-700">{removeError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel><Button variant="destructive" disabled={saving} onClick={() => void remove()}>{saving ? "Removendo..." : "Remover serviço"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
