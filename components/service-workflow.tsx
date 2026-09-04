"use client";

import { useState, type FormEvent } from "react";
import { CalendarPlus, Check, CircleDollarSign, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Appointment, Income, Quote } from "@/lib/types";
import { useOperations } from "@/components/operations-shared";
import { apiFetch } from "@/lib/api-client";

type Mode = "approve" | "complete" | "receive";
type Record = Quote | Appointment | Income;
type OnChanged = () => Promise<void>;

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function brl(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100); }

async function mutate(payload: object, method = "PATCH") {
  const response = await apiFetch("/api/data", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o serviço.");
}

export function WorkflowForm({ mode, record, onSaved }: { mode: Mode; record: Record; onSaved: OnChanged }) {
  const { clients } = useOperations();
  const [date, setDate] = useState(mode === "approve" ? "" : today());
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [location, setLocation] = useState(clients.find((client) => client.id === record.clientId)?.address ?? "");
  const [paymentStatus, setPaymentStatus] = useState(mode === "receive" ? "recebido" : "");
  const [paymentMethod, setPaymentMethod] = useState("paymentMethod" in record && record.paymentMethod !== "a definir" ? record.paymentMethod : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const legacy = mode !== "receive" && !(record as Quote | Appointment).incomeId;
  const prefix = `workflow-${mode}-${record.id}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      await mutate({
        resource: mode === "approve" ? "quotes" : mode === "complete" ? "appointments" : "incomes",
        id: record.id, status: mode === "approve" ? "aprovado" : mode === "complete" ? "concluido" : "recebido",
        data: { date, time, durationMinutes, location, paymentStatus, paymentMethod },
      });
      await onSaved();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-4">
    <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold">{record.client}</p><p className="mt-1 text-sm text-neutral-600">{record.service}</p><p className="mt-2 text-xl font-bold">{brl(record.amountCents)}</p></div>
    {legacy && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">Registro antigo sem ganho vinculado. Antes de continuar, confira se você já lançou esse valor manualmente em Ganhos para não duplicá-lo.</p>}
    <fieldset disabled={saving} className="space-y-4 [&_[data-slot=native-select-wrapper]]:w-full">
      <div className="space-y-2"><Label htmlFor={`${prefix}-date`}>{mode === "approve" ? "Data do serviço" : mode === "complete" ? "Data da realização" : "Data do recebimento"}</Label><Input id={`${prefix}-date`} type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></div>
      {mode === "approve" ? <>
        <div className="space-y-2"><Label htmlFor={`${prefix}-time`}>Horário do serviço</Label><Input id={`${prefix}-time`} type="time" required value={time} onChange={(event) => setTime(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-duration`}>Duração prevista (minutos)</Label><Input id={`${prefix}-duration`} type="number" min={15} max={1440} required value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /><p className="text-xs text-neutral-500">A agenda avisa se outro serviço ocupar esse intervalo.</p></div>
        <div className="space-y-2"><Label htmlFor={`${prefix}-location`}>Localidade (opcional)</Label><Input id={`${prefix}-location`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Onde o serviço será realizado" /></div>
        <p className="text-sm leading-5 text-neutral-600">O agendamento será criado com os dados deste orçamento e ligado ao mesmo ganho a receber.</p>
      </> : <>
        {mode === "complete" && <div className="space-y-2"><Label htmlFor={`${prefix}-payment-status`}>O pagamento à vista foi recebido?</Label><NativeSelect id={`${prefix}-payment-status`} required value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><NativeSelectOption value="">Selecione a situação</NativeSelectOption><NativeSelectOption value="recebido">Sim, pagamento integral recebido</NativeSelectOption><NativeSelectOption value="pendente">Não, manter o valor integral a receber</NativeSelectOption></NativeSelect></div>}
        {paymentStatus === "recebido" && <div className="space-y-2"><Label htmlFor={`${prefix}-payment-method`}>Forma de pagamento</Label><NativeSelect id={`${prefix}-payment-method`} required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><NativeSelectOption value="">Selecione a forma</NativeSelectOption><NativeSelectOption value="pix">Pix</NativeSelectOption><NativeSelectOption value="dinheiro">Dinheiro</NativeSelectOption><NativeSelectOption value="cartao">Cartão</NativeSelectOption><NativeSelectOption value="transferencia">Transferência</NativeSelectOption></NativeSelect></div>}
        <p className="text-sm leading-5 text-neutral-600">{mode === "complete" ? "A conclusão atualiza o ganho existente. Se o valor já foi recebido antecipadamente, ele não será lançado novamente." : "O valor sairá de A receber e entrará nos ganhos recebidos na data informada."}</p>
      </>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-[#b8000d]">{saving ? <LoaderCircle className="animate-spin" /> : <Check />}{saving ? "Salvando..." : mode === "approve" ? "Aprovar e criar agendamento" : mode === "complete" ? "Concluir e atualizar ganho" : "Confirmar recebimento"}</Button>
    </fieldset>
  </form>;
}

function FormButton({ mode, record, label, onChanged }: { mode: Mode; record: Record; label: string; onChanged: OnChanged }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-[#b8000d]">{mode === "approve" ? <CalendarPlus /> : <CircleDollarSign />}{label}</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-lg">
      <DialogHeader><DialogTitle>{mode === "approve" ? "Aprovar e agendar serviço" : mode === "complete" ? "Concluir serviço" : "Registrar recebimento"}</DialogTitle><DialogDescription>Confira os dados para atualizar a agenda e os ganhos da MS.</DialogDescription></DialogHeader>
      {open && <WorkflowForm mode={mode} record={record} onSaved={async () => { await onChanged(); setOpen(false); }} />}
    </DialogContent>
  </Dialog>;
}

function ConfirmButton({ label, title, description, payload, onChanged, method = "PATCH" }: { label: string; title: string; description: string; payload: object; onChanged: OnChanged; method?: "PATCH" | "DELETE" }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (saving) return;
    setSaving(true); setError("");
    try { await mutate(payload, method); await onChanged(); setOpen(false); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível atualizar."); }
    finally { setSaving(false); }
  }
  return <AlertDialog open={open} onOpenChange={(value) => { if (!saving) { setOpen(value); setError(""); } }}>
    <AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline">{label}</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={saving}>Voltar</AlertDialogCancel><Button type="button" variant={method === "DELETE" ? "destructive" : "default"} disabled={saving} onClick={() => void confirm()}>{saving ? "Salvando..." : method === "DELETE" ? "Excluir definitivamente" : "Confirmar"}</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}

export function QuoteWorkflowActions({ quote, onChanged }: { quote: Quote; onChanged: OnChanged }) {
  return <>
    {quote.canDeleteCancelled && <ConfirmButton label="Excluir cancelado" title={`Excluir orçamento #${quote.id} de ${quote.client}?`} description="O orçamento, o agendamento cancelado e o ganho cancelado vinculados serão excluídos definitivamente. Essa ação não pode ser desfeita. Outros registros não serão alterados. Só é permitido excluir se não houver valor a receber, pagamento recebido ou serviço realizado." payload={{ resource: "quotes", id: quote.id, action: "delete_cancelled" }} method="DELETE" onChanged={onChanged} />}
    {quote.status !== "aprovado" || !quote.appointmentId ? <FormButton mode="approve" record={quote} label={quote.status === "recusado" ? "Reaprovar" : quote.status === "aprovado" ? "Agendar serviço" : "Aprovar e agendar"} onChanged={onChanged} /> : null}
    {!quote.incomeId && quote.status === "pendente" && <ConfirmButton label="Gerar a receber" title="Integrar orçamento antigo?" description="Será criado um ganho a receber. Confira antes se esse valor já foi lançado manualmente em Ganhos para não duplicá-lo." payload={{ resource: "quotes", id: quote.id, action: "receivable" }} onChanged={onChanged} />}
    {quote.status !== "recusado" && <ConfirmButton label="Recusar" title="Recusar este orçamento?" description="O valor sairá de A receber e o agendamento vinculado será cancelado. O histórico será mantido. Pagamentos recebidos e serviços concluídos não são cancelados por esta ação." payload={{ resource: "quotes", id: quote.id, status: "recusado" }} onChanged={onChanged} />}
  </>;
}

export function AppointmentWorkflowActions({ appointment, onChanged }: { appointment: Appointment; onChanged: OnChanged }) {
  return <>
    {(appointment.status === "agendado" || (appointment.status === "concluido" && !appointment.incomeId)) && <FormButton mode="complete" record={appointment} label={appointment.status === "concluido" ? "Registrar ganho" : "Concluir"} onChanged={onChanged} />}
    {appointment.status === "agendado" && <ConfirmButton label="Cancelar" title="Cancelar este serviço?" description="O ganho a receber vinculado será cancelado e o orçamento vinculado ficará recusado. O histórico será mantido; valores já recebidos não serão apagados." payload={{ resource: "appointments", id: appointment.id, status: "cancelado" }} onChanged={onChanged} />}
  </>;
}

export function IncomeWorkflowActions({ income, onChanged }: { income: Income; onChanged: OnChanged }) {
  if (income.status === "cancelado") return null;
  return income.status === "pendente" ? <FormButton mode="receive" record={income} label="Receber" onChanged={onChanged} />
    : <ConfirmButton label="Marcar pendente" title="Voltar este ganho para A receber?" description="O valor será retirado dos ganhos recebidos e voltará a ficar pendente. O serviço realizado e seu histórico serão preservados." payload={{ resource: "incomes", id: income.id, status: "pendente" }} onChanged={onChanged} />;
}
