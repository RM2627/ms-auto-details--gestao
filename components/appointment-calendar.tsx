"use client";
import { useEffect,useState,type ReactNode } from "react";
import { ChevronLeft,ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Appointment } from "@/lib/types";
import { scheduleConflicts,weekDates } from "@/lib/operations";
import { errorText,opsGet,today } from "@/components/operations-shared";

export function AppointmentCalendar({revision,onAdd,renderRecord}:{revision:unknown;onAdd:(date:string)=>void;renderRecord:(appointment:Appointment)=>ReactNode}) {
  const[selected,setSelected]=useState(today),[rows,setRows]=useState<Appointment[]|null>(null),[error,setError]=useState("");
  const dates=weekDates(selected),start=dates[0],end=new Date(Date.parse(`${dates[6]}T12:00:00Z`)+86400000).toISOString().slice(0,10);
  useEffect(()=>{let active=true;opsGet<Appointment[]>(`action=calendar&start=${start}&end=${end}`).then((r)=>{if(active){setRows(r);setError("");}}).catch((e)=>{if(active)setError(errorText(e));});return()=>{active=false;};},[start,end,revision]);
  const selectedRows=(rows??[]).filter((r)=>r.date===selected).sort((a,b)=>a.time.localeCompare(b.time));
  const clashes=selectedRows.some((a,index)=>a.status!=="cancelado"&&selectedRows.slice(index+1).some((b)=>b.status!=="cancelado"&&scheduleConflicts(a,b)));
  const shift=(days:number)=>{setRows(null);setError("");setSelected(new Date(Date.parse(`${selected}T12:00:00Z`)+days*86400000).toISOString().slice(0,10));};
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">{new Date(`${start}T12:00:00Z`).toLocaleDateString("pt-BR",{month:"long",year:"numeric",timeZone:"UTC"})}</p><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Semana anterior" onClick={()=>shift(-7)}><ChevronLeft/></Button><Button variant="outline" onClick={()=>setSelected(today())}>Hoje</Button><Button variant="outline" size="icon" aria-label="Próxima semana" onClick={()=>shift(7)}><ChevronRight/></Button></div></div>
    <div className="grid grid-cols-7 gap-1 rounded-xl border bg-white p-2">{dates.map((date,index)=>{const count=(rows??[]).filter((r)=>r.date===date&&r.status!=="cancelado").length;return <button key={date} type="button" aria-pressed={selected===date} aria-label={`${date.split("-").reverse().join("/")}, ${count} serviço(s)`} onClick={()=>setSelected(date)} className={`flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-sm ${selected===date?"bg-red-700 text-white":"text-neutral-600 hover:bg-neutral-100"}`}><span className="text-xs">{["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"][index]}</span><span className="text-lg font-bold">{Number(date.slice(-2))}</span><span className="text-xs">{count||"—"}</span></button>;})}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{selected.split("-").reverse().join("/")}</h2><Button onClick={()=>onAdd(selected)}>Agendar neste dia</Button></div>
    <p className="text-sm text-neutral-500">O horário considera a duração informada. Agendamentos antigos sem duração reservam 60 minutos para verificar conflitos.</p>
    {clashes&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Há serviços antigos com horários sobrepostos neste dia. Confira a agenda.</p>}
    {error?<p role="alert" className="text-red-700">{error}</p>:rows===null?<p>Carregando semana...</p>:selectedRows.length===0?<p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">Nenhum serviço neste dia.</p>:<div className="grid gap-3">{selectedRows.map(renderRecord)}</div>}
  </section>;
}
