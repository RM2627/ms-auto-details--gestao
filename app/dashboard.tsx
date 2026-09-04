"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, CalendarPlus, Check,
  ChevronRight, CircleDollarSign, ClipboardList, Clock3, FileText,
  LayoutDashboard, LoaderCircle, LogOut, MapPin, Menu, Plus, ReceiptText, RefreshCw,
  Search, Tags, Trash2, TrendingUp, Users, Package, WalletCards, X, type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ClientsView } from "@/components/clients";
import { ProductsView } from "@/components/products";
import { ProfitsView } from "@/components/profits";
import { WorkOrderButton } from "@/components/work-orders";
import { AppointmentCalendar } from "@/components/appointment-calendar";
import { OperationsContext, opsGet, useOperations } from "@/components/operations-shared";
import { receivedAmount, remainingAmount, type Client, type Product, type FinancialSummary } from "@/lib/operations";
import { QuoteBreakdown, QuoteCalculator } from "@/components/quote-calculator";
import { QuoteShareButton } from "@/components/quote-share";
import { loadServiceCatalog, ServiceCatalog } from "@/components/service-catalog";
import type { Service } from "@/lib/service-catalog";
import { AppointmentWorkflowActions, IncomeWorkflowActions, QuoteWorkflowActions } from "@/components/service-workflow";
import { calculateQuoteDraft, emptyQuoteDraft } from "@/lib/quote-calculator";
import type { Appointment, DashboardData, Expense, Income, Quote, ResourceName } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";
import { signOut } from "@/lib/api-client";
import { sitePath } from "@/lib/site-path";

type View = "overview" | "services" | "clients" | "products" | "profits" | ResourceName;

const emptyData: DashboardData = { incomes: [], expenses: [], appointments: [], quotes: [] };

const navItems: { id: View; label: string; shortLabel: string; icon: LucideIcon; mobileShortcut?: boolean }[] = [
  { id: "overview", label: "Visão geral", shortLabel: "Início", icon: LayoutDashboard, mobileShortcut: true },
  { id: "incomes", label: "Ganhos", shortLabel: "Ganhos", icon: CircleDollarSign, mobileShortcut: true },
  { id: "expenses", label: "Despesas", shortLabel: "Despesas", icon: ReceiptText },
  { id: "appointments", label: "Agenda", shortLabel: "Agenda", icon: CalendarDays, mobileShortcut: true },
  { id: "quotes", label: "Orçamentos", shortLabel: "Orçam.", icon: FileText, mobileShortcut: true },
  { id: "services", label: "Serviços", shortLabel: "Serviços", icon: Tags },
  { id: "clients", label: "Clientes", shortLabel: "Clientes", icon: Users },
  { id: "products", label: "Produtos e estoque", shortLabel: "Estoque", icon: Package },
  { id: "profits", label: "Lucro por serviço", shortLabel: "Lucro", icon: TrendingUp },
];

const labels: Record<ResourceName, { singular: string; plural: string; action: string }> = {
  incomes: { singular: "ganho", plural: "Ganhos", action: "Novo ganho" },
  expenses: { singular: "despesa", plural: "Despesas", action: "Nova despesa" },
  appointments: { singular: "agendamento", plural: "Agenda", action: "Novo agendamento" },
  quotes: { singular: "orçamento", plural: "Orçamentos", action: "Novo orçamento" },
};

const chartConfig = {
  ganhos: { label: "Ganhos", color: "#171717" },
  despesas: { label: "Despesas", color: "#d9000f" },
} satisfies ChartConfig;

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function dateLabel(value: string) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function moneyToCents(value: string) {
  const parsed = Number(value.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : -1;
}

function initialForm(resource: ResourceName) {
  const common = { date: localDate(), amount: "", notes: "" };
  if (resource === "incomes") return { ...common, client: "", service: "", paymentMethod: "pix", status: "recebido" };
  if (resource === "expenses") return { ...common, description: "", category: "Produtos", paymentMethod: "pix" };
  if (resource === "appointments") return { ...common, time: "08:00", durationMinutes: "60", client: "", phone: "", location: "", service: "" };
  return { ...common, validUntil: "", client: "", phone: "", service: "" };
}

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

function StatusBadge({ status }: { status: string }) {
  const style = status === "recebido" || status === "concluido" || status === "aprovado"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "cancelado" || status === "recusado"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  const text = status === "concluido" ? "Concluído" : status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant="outline" className={style}>{text}</Badge>;
}

function EmptyState({ resource, onAdd }: { resource: ResourceName; onAdd: () => void }) {
  const Icon = resource === "appointments" ? CalendarPlus : resource === "quotes" ? ClipboardList : WalletCards;
  return <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-6 text-center">
    <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-neutral-100 text-neutral-500"><Icon className="size-5" /></span>
    <h3 className="font-semibold text-neutral-900">Nenhum {labels[resource].singular} por aqui</h3>
    <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">Comece registrando o primeiro item. Os totais serão atualizados automaticamente.</p>
    <Button className="mt-5 bg-primary text-primary-foreground hover:bg-[#b8000d]" onClick={onAdd}><Plus />{labels[resource].action}</Button>
  </div>;
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function RecordDialog({ resource, open, onOpenChange, onCreated, services, catalogLoading, catalogError, presetDate }: { resource: ResourceName; open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => Promise<void>; services: Service[]; catalogLoading: boolean; catalogError: string; presetDate?: string }) {
  const { clients } = useOperations();
  const [form, setForm] = useState<Record<string, string>>(() => ({ ...initialForm(resource), clientId: "", ...(presetDate ? { date: presetDate } : {}) }));
  const [quoteDraft, setQuoteDraft] = useState(emptyQuoteDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const calculation = resource === "quotes" ? calculateQuoteDraft(quoteDraft) : null;
      const amountCents = calculation ? calculation.totalCents : moneyToCents(form.amount);
      if (amountCents < 0) throw new Error("Informe um valor válido.");
      const response = await apiFetch("/api/data", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource, data: { ...form, amountCents, ...(calculation ? { calculation } : {}) } }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      await onCreated();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally { setSaving(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`max-h-[92vh] overflow-y-auto rounded-2xl border-neutral-200 ${resource === "quotes" ? "sm:max-w-2xl" : "sm:max-w-xl"}`}>
      <DialogHeader><DialogTitle className="text-xl">{labels[resource].action}</DialogTitle><DialogDescription>{resource === "quotes" ? "Selecione o que será feito. Ao salvar, o total também entra em Ganhos como A receber." : resource === "appointments" ? "Ao agendar, o valor também entra em Ganhos como A receber. Se já existe um orçamento, use Aprovar e agendar nele." : resource === "incomes" ? "Use para ganhos avulsos. Orçamentos e agendamentos já geram seus próprios ganhos; não é preciso lançá-los novamente aqui." : "Preencha os dados para atualizar o controle da MS."}</DialogDescription></DialogHeader>
<form onSubmit={submit} className="space-y-5 [&_[data-slot=native-select-wrapper]]:w-full">
        {resource === "expenses" ? <>
          <Field id="description" label="Descrição"><Input id="description" required value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Ex.: Trio de produtos Lotus" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="category" label="Categoria"><select id="category" className={selectClass} value={form.category} onChange={(e) => set("category", e.target.value)}><option>Produtos</option><option>Equipamentos</option><option>Combustível</option><option>Marketing</option><option>Manutenção</option><option>Ajuda de custo</option><option>Outros</option></select></Field>
            <Field id="expense-payment" label="Forma de pagamento"><select id="expense-payment" className={selectClass} value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></Field>
          </div>
        </> : <>
          <Field id="saved-client" label="Cliente cadastrado (opcional)"><NativeSelect id="saved-client" value={form.clientId} onChange={(e) => { const selected = clients.find((c) => c.id === Number(e.target.value)); setForm((previous) => ({ ...previous, clientId: e.target.value, ...(selected ? { client: selected.name, phone: selected.phone, location: selected.address } : {}) })); }}><NativeSelectOption value="">Preencher manualmente</NativeSelectOption>{clients.map((client) => <NativeSelectOption key={client.id} value={client.id}>{client.name} · {client.phone}</NativeSelectOption>)}</NativeSelect></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="client" label="Cliente"><Input id="client" required readOnly={Boolean(form.clientId)} value={form.client} onChange={(e) => set("client", e.target.value)} placeholder="Nome do cliente" /></Field>
            {(resource === "appointments" || resource === "quotes") && <Field id="phone" label="Telefone"><Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(87) 9 9999-9999" /></Field>}
          </div>
          {resource !== "quotes" && <Field id="service" label="Serviço"><Input id="service" required value={form.service} onChange={(e) => set("service", e.target.value)} placeholder="Ex.: Higienização de sofá" /></Field>}
        </>}

        <div className={`grid gap-4 ${resource === "quotes" ? "" : "sm:grid-cols-2"}`}>
          {resource !== "quotes" && <Field id="amount" label="Valor (R$)"><Input id="amount" required inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" /></Field>}
          <Field id="date" label={resource === "appointments" ? "Data do serviço" : "Data"}><Input id="date" required type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        </div>

        {resource === "incomes" && <div className="grid gap-4 sm:grid-cols-2">
          <Field id="income-payment" label="Forma de pagamento"><select id="income-payment" className={selectClass} value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option></select></Field>
          <Field id="income-status" label="Situação"><select id="income-status" className={selectClass} value={form.status} onChange={(e) => set("status", e.target.value)}><option value="recebido">Recebido</option><option value="pendente">A receber</option></select></Field>
        </div>}

        {resource === "appointments" && <div className="grid gap-4 sm:grid-cols-2">
          <Field id="time" label="Horário"><Input id="time" required type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></Field>
          <Field id="duration" label="Duração prevista (minutos)"><Input id="duration" required type="number" min={15} max={1440} step={1} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} /></Field>
          <Field id="location" label="Localidade"><Input id="location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Ex.: Assentamento Vitória 2" /></Field>
        </div>}

        {resource === "quotes" && <Field id="validUntil" label="Válido até (opcional)"><Input id="validUntil" type="date" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} /></Field>}
        {resource === "quotes" && <QuoteCalculator draft={quoteDraft} onChange={setQuoteDraft} services={services} catalogLoading={catalogLoading} catalogError={catalogError} disabled={saving} />}
        <Field id="notes" label="Observações (opcional)"><Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Detalhes importantes do serviço" /></Field>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-[#b8000d]">{saving ? <LoaderCircle className="animate-spin" /> : <Check />}{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function SummaryCard({ label, value, detail, icon: Icon, tone = "neutral" }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: "neutral" | "green" | "stone" | "red" }) {
  const tones = { neutral: "bg-neutral-100 text-neutral-700", green: "bg-emerald-100 text-emerald-700", stone: "bg-neutral-200 text-neutral-700", red: "bg-red-100 text-red-700" };
  return <Card className="gap-4 border-neutral-200 bg-white py-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)]"><CardHeader className="flex flex-row items-center justify-between px-5"><CardDescription className="font-medium text-neutral-500">{label}</CardDescription><span className={`grid size-9 place-items-center rounded-xl ${tones[tone]}`}><Icon className="size-4" /></span></CardHeader><CardContent className="px-5"><p className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">{value}</p><p className="mt-1 text-xs text-neutral-500">{detail}</p></CardContent></Card>;
}

function Overview({ data, month, setMonth, onOpen }: { data: DashboardData; month: string; setMonth: (value: string) => void; onOpen: (resource: ResourceName) => void }) {
  const [financial, setFinancial] = useState<FinancialSummary | null>(null), [financialError, setFinancialError] = useState("");
  useEffect(() => { let active = true; opsGet<FinancialSummary>(`action=financial&month=${month}`).then((value) => { if (active) { setFinancial(value); setFinancialError(""); } }).catch((error) => { if (active) { setFinancial(null); setFinancialError(error instanceof Error ? error.message : "Não foi possível carregar os totais."); } }); return () => { active = false; }; }, [data, month]);
  const received = financial?.receivedCents ?? 0, pending = financial?.pendingCents ?? 0, spent = financial?.spentCents ?? 0;
  const balance = received - spent;
  const today = localDate();
  const upcoming = data.appointments.filter((item) => item.date >= today && item.status === "agendado").sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 4);
  const openQuotes = data.quotes.filter((item) => item.status === "pendente").length;

  const chartData = financial?.chart ?? [];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-medium text-red-700">Painel da empresa</p><h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">Visão geral da MS</h1><p className="mt-1 text-sm text-neutral-500">O que entrou, saiu e está marcado.</p></div><Input aria-label="Selecionar mês" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full bg-white sm:w-44" /></div>
    {financialError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{financialError}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Ganhos recebidos" value={financial ? brl(received) : "—"} detail={`${financial?.receivedCount ?? 0} pagamento(s) à vista no mês`} icon={ArrowUpRight} tone="green" /><SummaryCard label="A receber" value={financial ? brl(pending) : "—"} detail="Valor integral dos serviços pendentes" icon={Clock3} tone="neutral" /><SummaryCard label="Despesas" value={financial ? brl(spent) : "—"} detail={`${financial?.expenseCount ?? 0} saída(s) no mês`} icon={ArrowDownRight} tone="red" /><SummaryCard label="Saldo do mês" value={financial ? brl(balance) : "—"} detail="Recebidos menos despesas, sem repetir consumo" icon={Banknote} tone={balance >= 0 ? "stone" : "red"} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <Card className="border-neutral-200 bg-white shadow-none"><CardHeader><CardTitle>Evolução financeira</CardTitle><CardDescription>Ganhos recebidos e despesas nos últimos 6 meses</CardDescription></CardHeader><CardContent><ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto"><BarChart data={chartData} margin={{ left: -18, right: 4, top: 8 }}><CartesianGrid vertical={false} strokeDasharray="3 3" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value, name) => <><span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span><span className="ml-auto font-mono font-medium">{brl(Number(value) * 100)}</span></>} />} /><Bar dataKey="ganhos" fill="var(--color-ganhos)" radius={[5, 5, 0, 0]} /><Bar dataKey="despesas" fill="var(--color-despesas)" radius={[5, 5, 0, 0]} /></BarChart></ChartContainer></CardContent></Card>
      <Card className="border-neutral-200 bg-neutral-950 text-white shadow-none"><CardHeader><CardTitle className="text-white">Ações rápidas</CardTitle><CardDescription className="text-neutral-400">Registre sem perder tempo</CardDescription></CardHeader><CardContent className="grid gap-2">
        <QuickAction icon={CircleDollarSign} label="Adicionar ganho" tone="text-emerald-300 bg-emerald-400/15" onClick={() => onOpen("incomes")} />
        <QuickAction icon={CalendarPlus} label="Agendar serviço" tone="text-red-300 bg-red-400/15" onClick={() => onOpen("appointments")} />
        <QuickAction icon={FileText} label="Calcular orçamento" tone="text-red-300 bg-red-400/15" onClick={() => onOpen("quotes")} />
        <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3"><p className="text-xs text-red-200">Orçamentos aguardando resposta</p><p className="mt-1 text-2xl font-bold text-red-300">{openQuotes}</p></div>
      </CardContent></Card>
    </div>
    <Card className="border-neutral-200 bg-white shadow-none"><CardHeader><CardTitle>Próximos serviços</CardTitle><CardDescription>Sua agenda a partir de hoje</CardDescription></CardHeader><CardContent>{upcoming.length === 0 ? <div className="rounded-xl bg-neutral-50 p-5 text-center text-sm text-neutral-500">Nenhum serviço agendado. <button onClick={() => onOpen("appointments")} className="font-semibold text-red-700 hover:underline">Adicionar agendamento</button></div> : <div className="grid gap-3 md:grid-cols-2">{upcoming.map((item) => <div key={item.id} className="flex gap-3 rounded-xl border border-neutral-200 p-4"><div className="min-w-14 rounded-lg bg-red-50 px-2 py-2 text-center"><p className="text-xs font-bold uppercase text-red-700">{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</p><p className="text-xl font-bold text-neutral-950">{item.date.slice(-2)}</p></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate font-semibold text-neutral-900">{item.client}</p><span className="text-xs font-semibold text-neutral-500">{item.time}</span></div><p className="mt-1 truncate text-sm text-neutral-500">{item.service}</p>{item.location && <p className="mt-2 flex items-center gap-1 truncate text-xs text-neutral-400"><MapPin className="size-3" />{item.location}</p>}</div></div>)}</div>}</CardContent></Card>
  </div>;
}

function QuickAction({ icon: Icon, label, tone, onClick }: { icon: LucideIcon; label: string; tone: string; onClick: () => void }) {
  return <button onClick={onClick} className="group flex items-center gap-3 rounded-xl bg-white/7 p-3 text-left transition hover:bg-white/12"><span className={`grid size-9 place-items-center rounded-lg ${tone}`}><Icon className="size-4" /></span><span className="flex-1 text-sm font-medium">{label}</span><ChevronRight className="size-4 text-neutral-500 transition group-hover:translate-x-0.5" /></button>;
}

function Actions({ resource, record, onChanged, onDelete }: { resource: ResourceName; record: Income | Expense | Appointment | Quote; onChanged: () => Promise<void>; onDelete: (resource: ResourceName, id: number) => void }) {
  const linked = ("quoteId" in record && record.quoteId) || ("appointmentId" in record && record.appointmentId) || ("incomeId" in record && record.incomeId);
  return <div className="flex flex-wrap items-center justify-end gap-2">
    {resource === "incomes" && <IncomeWorkflowActions income={record as Income} onChanged={onChanged} />}
    {resource === "appointments" && <AppointmentWorkflowActions appointment={record as Appointment} onChanged={onChanged} />}
    {resource === "appointments" && <WorkOrderButton appointment={record as Appointment} />}
    {resource === "quotes" && <QuoteWorkflowActions quote={record as Quote} onChanged={onChanged} />}
    {!linked && !(resource === "quotes" && (record as Quote).canDeleteCancelled) && <Button aria-label="Excluir registro" title="Excluir registro" variant="ghost" size="icon-sm" className="text-neutral-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(resource, record.id)}><Trash2 /></Button>}
  </div>;
}

function RecordsView({ resource, data, onOpen, onChanged, onDelete }: { resource: ResourceName; data: DashboardData; onOpen: (date?: string) => void; onChanged: () => Promise<void>; onDelete: (resource: ResourceName, id: number) => void }) {
  const [query, setQuery] = useState("");
  const [calendar, setCalendar] = useState(true);
  const records = data[resource].filter((item) => JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
  const description = resource === "incomes" ? "Orçamentos e agendamentos geram valores a receber. Confirme o pagamento para registrar a entrada." : resource === "expenses" ? "Saiba exatamente para onde o dinheiro está indo." : resource === "appointments" ? "Ao concluir o serviço, atualize o ganho e confirme se o cliente já pagou." : "Salvar gera A receber. Aprovar cria o agendamento. Concluir atualiza o ganho.";
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-1 text-sm font-medium text-red-700">Controle da MS</p><h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">{labels[resource].plural}</h1><p className="mt-1 text-sm text-neutral-500">{description}</p></div><Button onClick={() => onOpen()} className="bg-primary text-primary-foreground hover:bg-[#b8000d]"><Plus />{labels[resource].action}</Button></div>
    {resource === "appointments" && <div className="flex gap-2"><Button variant={calendar ? "default" : "outline"} onClick={() => setCalendar(true)}>Calendário</Button><Button variant={!calendar ? "default" : "outline"} onClick={() => setCalendar(false)}>Lista</Button></div>}
    {resource === "appointments" && calendar ? <AppointmentCalendar revision={data} onAdd={onOpen} renderRecord={(appointment) => <RecordCard key={appointment.id} resource="appointments" record={appointment} onChanged={onChanged} onDelete={onDelete} />} /> : data[resource].length === 0 ? <EmptyState resource={resource} onAdd={() => onOpen()} /> : <>
      <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} className="bg-white pl-9" placeholder="Buscar cliente, serviço ou local..." /></div>
      <div className="grid gap-3">{records.map((record) => <RecordCard key={record.id} resource={resource} record={record} onChanged={onChanged} onDelete={onDelete} />)}{records.length === 0 && <p className="rounded-xl border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-500">Nenhum resultado para “{query}”.</p>}</div>
    </>}
  </div>;
}

function RecordCard({ resource, record, onChanged, onDelete }: { resource: ResourceName; record: Income | Expense | Appointment | Quote; onChanged: () => Promise<void>; onDelete: (resource: ResourceName, id: number) => void }) {
  const actions = <Actions resource={resource} record={record} onChanged={onChanged} onDelete={onDelete} />;
  if (resource === "incomes") {
    const item = record as Income;
    return <Card className="gap-3 border-neutral-200 bg-white py-4 shadow-none"><CardContent className="grid gap-4 px-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex min-w-0 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><TrendingUp className="size-4" /></span><div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-neutral-900">{item.client}</p><StatusBadge status={item.status} /></div>
        <p className="mt-1 truncate text-sm text-neutral-500">{item.service} · {dateLabel(item.date)}</p><p className="mt-1 text-xs capitalize text-neutral-400">{item.paymentMethod}</p>
        {(item.quoteId || item.appointmentId) && <p className="mt-2 text-xs text-neutral-500">{[item.quoteId ? `Orçamento #${item.quoteId}` : "", item.appointmentId ? `Agendamento #${item.appointmentId}` : ""].filter(Boolean).join(" · ")}</p>}
        {item.status !== "cancelado" && <p className="mt-2 text-sm text-neutral-600">Recebido: {brl(receivedAmount(item))} · A receber: {brl(remainingAmount(item))}</p>}
      </div></div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><p className={`text-lg font-bold ${item.status === "recebido" ? "text-emerald-700" : item.status === "cancelado" ? "text-neutral-400 line-through" : "text-neutral-900"}`}>{item.status === "recebido" ? "+ " : ""}{brl(item.amountCents)}</p>{actions}</div>
    </CardContent></Card>;
  }
  if (resource === "expenses") {
    const item = record as Expense;
    return <Card className="gap-3 border-neutral-200 bg-white py-4 shadow-none"><CardContent className="grid gap-4 px-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="flex min-w-0 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><ReceiptText className="size-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-neutral-900">{item.description}</p><Badge variant="secondary" className="bg-neutral-100 text-neutral-600">{item.category}</Badge></div><p className="mt-1 text-sm text-neutral-500">{dateLabel(item.date)} · <span className="capitalize">{item.paymentMethod}</span></p></div></div><div className="flex items-center justify-between gap-4 sm:justify-end"><p className="text-lg font-bold text-red-700">− {brl(item.amountCents)}</p>{actions}</div></CardContent></Card>;
  }
  if (resource === "appointments") {
    const item = record as Appointment;
    return <Card className="gap-3 border-neutral-200 bg-white py-4 shadow-none"><CardContent className="grid gap-4 px-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex min-w-0 gap-3"><div className="w-14 shrink-0 rounded-xl bg-red-50 py-2 text-center"><p className="text-lg font-bold text-neutral-900">{item.date.slice(-2)}</p><p className="text-xs font-bold uppercase text-red-700">{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</p></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-neutral-900">{item.client}</p><StatusBadge status={item.status} /></div><p className="mt-1 truncate text-sm text-neutral-500">{item.service} · {item.time} · {brl(item.amountCents)}</p>{item.location && <p className="mt-1 flex items-center gap-1 truncate text-xs text-neutral-400"><MapPin className="size-3" />{item.location}</p>}
      {(item.quoteId || item.incomeId) && <p className="mt-2 text-xs text-neutral-500">{[item.quoteId ? `Orçamento #${item.quoteId}` : "", item.incomeId ? `Ganho #${item.incomeId}` : ""].filter(Boolean).join(" · ")}</p>}
      <p className="mt-1 text-sm text-neutral-500">Duração prevista: {item.durationMinutes ?? 60} min{item.durationMinutes == null ? " (estimada)" : ""}</p>
      {item.completedDate && <p className="mt-1 text-xs text-neutral-500">Realizado em {dateLabel(item.completedDate)}</p>}
      </div></div>{actions}</CardContent></Card>;
  }
  const item = record as Quote;
  return <Card className="gap-3 border-neutral-200 bg-white py-4 shadow-none"><CardContent className="grid gap-4 px-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="flex min-w-0 gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700"><FileText className="size-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-neutral-900">{item.client}</p><StatusBadge status={item.status} /></div><p className="mt-1 truncate text-sm text-neutral-500">{item.service} · {dateLabel(item.date)}</p>{item.validUntil && <p className="mt-1 text-xs text-neutral-400">Válido até {dateLabel(item.validUntil)}</p>}
    {(item.incomeId || item.appointmentId) && <p className="mt-2 text-xs text-neutral-500">{[item.incomeId ? `Ganho #${item.incomeId}` : "", item.appointmentId ? `Agendamento #${item.appointmentId}` : ""].filter(Boolean).join(" · ")}</p>}
    </div></div><div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end"><p className="text-lg font-bold text-neutral-900">{brl(item.amountCents)}</p><QuoteShareButton quote={item} />{actions}</div></CardContent><QuoteBreakdown quote={item} /></Card>;
}

export function Dashboard() {
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [services, setServices] = useState<Service[]>([]);
  const [operations, setOperations] = useState<{ clients: Client[]; products: Product[] }>({ clients: [], products: [] });
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogResource, setDialogResource] = useState<ResourceName>("incomes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetDate, setPresetDate] = useState<string>();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [month, setMonth] = useState(localDate().slice(0, 7));

  async function reloadServices() {
    setCatalogLoading(true); setCatalogError("");
    try { setServices(await loadServiceCatalog()); }
    catch (caught) { setCatalogError(caught instanceof Error ? caught.message : "Não foi possível carregar os serviços."); }
    finally { setCatalogLoading(false); }
  }

  useEffect(() => {
    let active = true;
    loadServiceCatalog().then((items) => { if (active) setServices(items); })
      .catch((caught: unknown) => { if (active) setCatalogError(caught instanceof Error ? caught.message : "Não foi possível carregar os serviços."); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  async function loadData() {
    void reloadServices();
    try {
      setError("");
      const [response, auxiliary] = await Promise.all([apiFetch("/api/data", { cache: "no-store" }), opsGet<{clients:Client[];products:Product[]}>("action=catalog")]);
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os dados.");
      setData(result);
      setOperations(auxiliary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    opsGet<{clients:Client[];products:Product[]}>("action=catalog").then((value) => { if (active) setOperations(value); }).catch((caught:unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar clientes e estoque."); }).finally(() => { if (active) setOperationsLoading(false); });
    apiFetch("/api/data", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, result: await response.json() as DashboardData & { error?: string } }))
      .then(({ ok, result }) => {
        if (!ok) throw new Error(result.error || "Não foi possível carregar os dados.");
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar os dados.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function openDialog(resource: ResourceName, date?: string) { if (resource === "quotes") void reloadServices(); setPresetDate(date); setDialogResource(resource); setDialogOpen(true); }

  async function deleteRecord(resource: ResourceName, id: number) {
    if (!window.confirm("Excluir este registro? Essa ação não pode ser desfeita.")) return;
    try {
      const response = await apiFetch("/api/data", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ resource, id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o registro.");
      await loadData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível excluir o registro."); }
  }

  const currentLabel = navItems.find((item) => item.id === view)?.label;

  return <OperationsContext.Provider value={{ ...operations, data, onChanged: loadData }}><div className="min-h-screen bg-[#f5f5f5] text-neutral-900">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-y-auto bg-neutral-950 px-4 py-5 text-white lg:flex">
      <div className="flex items-center gap-3 px-2"><span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-black tracking-tighter text-primary-foreground">MS</span><div><p className="text-sm font-bold tracking-wide">MS AUTO DETAILS</p><p className="text-xs text-neutral-500">Central de gestão</p></div></div>
      <Nav view={view} onChange={setView} />
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xs font-medium text-neutral-400">Negócio organizado</p><p className="mt-1 text-sm font-semibold text-white">Cada serviço conta.</p><p className="mt-2 text-xs leading-5 text-neutral-500">Registre entradas e saídas no mesmo dia para manter o saldo real.</p></div>
    </aside>

    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-neutral-200/80 bg-[#f5f5f5]/90 px-4 backdrop-blur lg:ml-64 lg:px-8"><div className="flex items-center gap-3"><Button aria-label="Abrir menu" variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenu(true)}><Menu /></Button><div><p className="text-xs text-neutral-500">MS AUTO DETAILS</p><p className="text-sm font-semibold text-neutral-900">{currentLabel}</p></div></div><div className="flex items-center gap-3"><button onClick={() => void loadData()} aria-label="Atualizar dados" title="Atualizar dados" className="grid size-9 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-900"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button><div className="hidden items-center gap-2 sm:flex"><span className="grid size-9 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-red-300">MS</span><div><p className="text-xs font-semibold">Marcelo</p><p className="text-xs text-neutral-500">Administrador</p></div></div><Button variant="ghost" size="icon" aria-label="Sair da gestão" title="Sair" onClick={()=>{void signOut();location.href=sitePath("/login/");}}><LogOut/></Button></div></header>

{mobileMenu && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-neutral-950/50" onClick={() => setMobileMenu(false)} /><div className="relative h-full w-[82%] max-w-xs overflow-y-auto bg-neutral-950 p-5 text-white shadow-2xl"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-primary text-xs font-black text-primary-foreground">MS</span><p className="text-sm font-bold">MS AUTO DETAILS</p></div><Button aria-label="Fechar" variant="ghost" size="icon" className="text-neutral-400" onClick={() => setMobileMenu(false)}><X /></Button></div><Nav view={view} onChange={(next) => { setView(next); setMobileMenu(false); }} /></div></div>}

    <main className="pb-24 lg:ml-64 lg:pb-10"><div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><Button size="sm" variant="outline" onClick={() => void loadData()}>Tentar novamente</Button></div>}
      {!operationsLoading && operations.products.some((p) => p.stockMilli <= p.minimumMilli) && view === "overview" && <button type="button" onClick={() => setView("products")} className="mb-5 w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">Estoque para repor: {operations.products.filter((p) => p.stockMilli <= p.minimumMilli).map((p) => p.name).join(" · ")} → Ver estoque</button>}
      {view === "services" ? <ServiceCatalog services={services} loading={catalogLoading} error={catalogError} onReload={reloadServices} /> : view === "clients" ? (operationsLoading ? <p>Carregando clientes...</p> : <ClientsView />) : view === "products" ? (operationsLoading ? <p>Carregando estoque...</p> : <ProductsView />) : view === "profits" ? <ProfitsView /> : loading && Object.values(data).every((items) => items.length === 0) ? <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-red-600" /><p className="mt-3 text-sm text-neutral-500">Carregando sua gestão...</p></div></div> : view === "overview" ? <Overview data={data} month={month} setMonth={setMonth} onOpen={openDialog} /> : <RecordsView resource={view} data={data} onOpen={(date) => openDialog(view, date)} onChanged={loadData} onDelete={deleteRecord} />}
    </div></main>

    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(0,0,0,.06)] lg:hidden" aria-label="Navegação móvel">{navItems.filter((item) => item.mobileShortcut).map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} type="button" aria-label={item.label} aria-current={active ? "page" : undefined} onClick={() => setView(item.id)} className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${active ? "text-red-700" : "text-neutral-500"}`}><Icon aria-hidden="true" className={`size-5 ${active ? "stroke-[2.5]" : ""}`} />{item.shortLabel}</button>; })}</nav>
    <RecordDialog key={`${dialogResource}-${dialogOpen ? "open" : "closed"}`} resource={dialogResource} open={dialogOpen} onOpenChange={setDialogOpen} onCreated={loadData} services={services} catalogLoading={catalogLoading} catalogError={catalogError} presetDate={presetDate} />
  </div></OperationsContext.Provider>;
}

function Nav({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return <nav className="mt-10 space-y-1" aria-label="Navegação principal">{navItems.map((item) => { const Icon = item.icon; const active = view === item.id; return <button key={item.id} onClick={() => onChange(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${active ? "bg-primary text-primary-foreground" : "text-neutral-400 hover:bg-white/7 hover:text-white"}`}><Icon className="size-[18px]" />{item.label}</button>; })}</nav>;
}
