"use client";

import { createContext, useContext, useId, useState, type FormEvent, type ReactNode, type ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { Client, Product } from "@/lib/operations";
import type { DashboardData } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";

export const OperationsContext = createContext<{clients:Client[];products:Product[];data:DashboardData;onChanged:()=>Promise<void>}>({ clients: [], products: [], data: { incomes: [], expenses: [], appointments: [], quotes: [] }, onChanged: async () => {} });
export const useOperations = () => useContext(OperationsContext);
export const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
export const quantityLabel = (value: number) => (value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
export const today = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const errorText = (error: unknown) => error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente.";

export async function opsGet<T>(query: string): Promise<T> {
  const response = await apiFetch(`/api/operations?${query}`, { cache: "no-store" }); const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível carregar."); return result;
}
export async function opsMutate(body: object) {
  const response = await apiFetch("/api/operations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível salvar."); return result;
}
export function Field({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  const id = useId(); return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} {...props} /></div>;
}
export function SelectField({ label, children, ...props }: ComponentProps<typeof NativeSelect> & { label: string; children: ReactNode }) {
  const id = useId(); return <div className="space-y-2 [&_[data-slot=native-select-wrapper]]:w-full"><Label htmlFor={id}>{label}</Label><NativeSelect id={id} {...props}>{children}</NativeSelect></div>;
}
export function MethodField({ value, onChange }: {value:string;onChange:(value:string)=>void}) {
  return <SelectField label="Forma de pagamento" required value={value} onChange={(event) => onChange(event.target.value)}><NativeSelectOption value="pix">Pix</NativeSelectOption><NativeSelectOption value="dinheiro">Dinheiro</NativeSelectOption><NativeSelectOption value="cartao">Cartão</NativeSelectOption><NativeSelectOption value="transferencia">Transferência</NativeSelectOption></SelectField>;
}
export function ActionForm({ children, onSubmit, label = "Salvar" }: {children:ReactNode;onSubmit:()=>Promise<void>;label?:string}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (busy) return; setBusy(true); setError(""); try { await onSubmit(); } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); } }
return <form onSubmit={submit} className="space-y-4"><fieldset disabled={busy} className="min-w-0 space-y-4">{children}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Button type="submit" className="h-auto min-h-10 w-full whitespace-normal px-3 py-2">{busy && <LoaderCircle className="animate-spin" />}{busy ? "Salvando..." : label}</Button></fieldset></form>;
}
export function FormDialog({ label, title, description, children, wide = false }: {label:string;title:string;description:string;children:(close:()=>void)=>ReactNode;wide?:boolean}) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button type="button" variant="outline" size="sm">{label}</Button></DialogTrigger><DialogContent className={`max-h-[92dvh] overflow-y-auto rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{open && children(() => setOpen(false))}</DialogContent></Dialog>;
}
export function ConfirmAction({ label, description, onConfirm }: {label:string;description:string;onConfirm:()=>Promise<void>}) {
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState("");
  async function confirm() { setBusy(true); setError(""); try { await onConfirm(); setOpen(false); } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); } }
  return <AlertDialog open={open} onOpenChange={(next) => { if (!busy) { setOpen(next); setError(""); } }}><AlertDialogTrigger asChild><Button size="sm" variant="outline">{label}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={() => void confirm()}>{busy ? "Aguarde..." : "Confirmar"}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
