"use client";
import { useEffect, useState } from "react";
import { NativeSelectOption } from "@/components/ui/native-select";
import type { Client } from "@/lib/operations";
import { ActionForm, Field, FormDialog, SelectField, errorText, money, opsGet, opsMutate, useOperations } from "@/components/operations-shared";

export function ClientForm({ client, onSaved }: {client?:Client;onSaved:()=>Promise<void>}) {
  const [name,setName]=useState(client?.name ?? ""), [phone,setPhone]=useState(client?.phone ?? ""), [address,setAddress]=useState(client?.address ?? ""), [notes,setNotes]=useState(client?.notes ?? "");
  return <ActionForm label="Salvar cliente" onSubmit={async () => { await opsMutate({ action:"client", id:client?.id, data:{name,phone,address,notes} }); await onSaved(); }}>
    <Field label="Nome do cliente" required maxLength={200} value={name} onChange={(e)=>setName(e.target.value)} />
    <Field label="Telefone / WhatsApp" type="tel" maxLength={40} value={phone} onChange={(e)=>setPhone(e.target.value)} />
    <Field label="Endereço" maxLength={500} value={address} onChange={(e)=>setAddress(e.target.value)} />
    <Field label="Observações" maxLength={2000} value={notes} onChange={(e)=>setNotes(e.target.value)} />
  </ActionForm>;
}
type HistoryRow={resource:string;id:number;date:string;service:string;amountCents:number;status:string};
function ClientHistory({ client }: {client:Client}) {
  const { data,onChanged }=useOperations(), [records,setRecords]=useState<HistoryRow[]|null>(null), [error,setError]=useState(""), [selected,setSelected]=useState("");
  useEffect(()=>{ let active=true; opsGet<HistoryRow[]>(`action=client_history&id=${client.id}`).then((result)=>{if(active)setRecords(result);}).catch((e)=>{if(active)setError(errorText(e));}); return()=>{active=false;}; },[client.id,data]);
  const names:Record<string,string>={quotes:"Orçamento",appointments:"Agendamento",incomes:"Ganho"};
  const candidates=[...data.quotes.filter((r)=>!r.clientId).map((r)=>({resource:"quotes",...r})),...data.appointments.filter((r)=>!r.clientId&&!r.quoteId).map((r)=>({resource:"appointments",...r})),...data.incomes.filter((r)=>!r.clientId&&!r.quoteId&&!r.appointmentId).map((r)=>({resource:"incomes",...r}))];
  return <div className="space-y-5"><p className="text-sm text-neutral-500">Até 200 registros vinculados. Orçamento, agenda e ganho podem representar o mesmo serviço; estes valores não são somados.</p>
    {error ? <p role="alert" className="text-red-700">{error}</p> : records === null ? <p>Carregando histórico...</p> : records.length===0 ? <p>Nenhum registro vinculado a este cliente.</p> : <ul className="space-y-2">{records.map((r)=><li key={`${r.resource}-${r.id}`} className="rounded-xl border p-3"><p className="font-medium">{names[r.resource]} #{r.id} · {r.date.split("-").reverse().join("/")}</p><p className="mt-1 text-sm text-neutral-600">{r.service}</p><p className="mt-1 text-sm">{money(r.amountCents)} · {r.status}</p></li>)}</ul>}
    {candidates.length>0&&<ActionForm label="Vincular registro antigo" onSubmit={async()=>{const[resource,id]=selected.split(":");await opsMutate({action:"assign_client",resource,id:Number(id),clientId:client.id});setSelected("");await onChanged();}}><SelectField label="Vincular um registro já existente" required value={selected} onChange={(e)=>setSelected(e.target.value)}><NativeSelectOption value="">Selecione o registro correto</NativeSelectOption>{candidates.map((r)=><NativeSelectOption key={`${r.resource}-${r.id}`} value={`${r.resource}:${r.id}`}>{names[r.resource]} #{r.id} · {r.client} · {r.date}</NativeSelectOption>)}</SelectField><p className="text-sm text-neutral-500">O vínculo também será aplicado ao orçamento, agendamento e ganho relacionados. Os valores não mudam.</p></ActionForm>}
  </div>;
}
export function ClientsView() {
  const {clients,onChanged}=useOperations(), [query,setQuery]=useState("");
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Clientes</h1><p className="mt-1 text-sm text-neutral-500">Contatos e histórico de atendimento.</p></div><FormDialog label="Novo cliente" title="Cadastrar cliente" description="Reutilize estes dados nos próximos serviços.">{(close)=><ClientForm onSaved={async()=>{await onChanged();close();}}/>}</FormDialog></div>
    <Field label="Buscar cliente" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Nome ou telefone" />
    {clients.length===0&&<p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">Cadastre seu primeiro cliente. Registros antigos só serão vinculados quando você escolher.</p>}
    <div className="grid gap-3 md:grid-cols-2">{clients.filter((c)=>`${c.name} ${c.phone}`.toLowerCase().includes(query.toLowerCase())).map((client)=><article key={client.id} className="space-y-3 rounded-xl border bg-white p-4"><div><h2 className="font-semibold">{client.name}</h2><p className="mt-1 text-sm text-neutral-600">{client.phone||"Sem telefone"}</p><p className="mt-1 break-words text-sm text-neutral-500">{client.address}</p></div><div className="flex flex-wrap gap-2"><FormDialog label="Editar" title="Editar cliente" description="A edição não altera os dados registrados nos orçamentos antigos.">{(close)=><ClientForm client={client} onSaved={async()=>{await onChanged();close();}}/>}</FormDialog><FormDialog label="Histórico" title={client.name} description="Serviços, orçamentos e ganhos vinculados." wide>{()=> <ClientHistory client={client}/>}</FormDialog></div></article>)}</div>
  </div>;
}
