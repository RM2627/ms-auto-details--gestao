import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL: permissões, orçamento, agenda, receita, estoque e fotos", async (t) => {
  const db=new PGlite();
  const admin=randomUUID(),other=randomUUID();
  // Minimal local stand-ins. No access to a real Supabase project.
  await db.exec(`
    create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select,insert,delete on storage.objects to authenticated;
  `);
  const schema=readFileSync(new URL("../supabase/schema.sql",import.meta.url),"utf8").replace("create extension if not exists pgcrypto;","");
  await db.exec(schema);
  await db.query("insert into auth.users values($1,'admin@example.test'),($2,'other@example.test')",[admin,other]);
  await db.query("insert into ms_admin_users values($1)",[admin]);
  async function as(role,uid=""){
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
    await db.exec(`set role ${role}`);
  }
  async function call(name,args=[],casts=[]){
    return (await db.query(`select ${name}(${args.map((_,i)=>"$"+(i+1)+(casts[i]?"::"+casts[i]:"")).join(",")}) as result`,args)).rows[0].result;
  }
  const mutate=(action,data)=>call("ms_mutate",[action,JSON.stringify(data)],["text","jsonb"]);
  const query=(action,data={})=>call("ms_query",[action,JSON.stringify(data)],["text","jsonb"]);
  const dashboard=()=>call("ms_dashboard");
  let qid,token,aid;

  await t.test("anon e usuário sem autorização não conseguem acessar a gestão",async()=>{
    await as("anon");
    for(const fn of ["ms_services","ms_dashboard"])await assert.rejects(call(fn),/permission denied/);
    await assert.rejects(db.query("select * from quotes"),/permission denied/);
    await as("authenticated",other);
    assert.equal(await call("ms_is_admin"),false);
    for(const action of [()=>call("ms_services"),dashboard,()=>query("catalog"),()=>mutate("operation_client",{data:{name:"Intruso"}})]) await assert.rejects(action(),/administrador/);
    await assert.rejects(db.query("insert into ms_admin_users values($1)",[other]),/permission denied/);
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name)values('job-photos','bad')"),/row-level security/);
  });
  await t.test("administrador pode cadastrar cliente, serviços e orçamento recalculado",async()=>{
    await as("authenticated",admin);
    assert.equal(await call("ms_is_admin"),true);
    assert.equal((await call("ms_services")).services.length,26);
    const client=await mutate("operation_client",{data:{name:"Cliente teste",phone:"000",notes:"INTERNO"}});
    const quote=await mutate("create_quotes",{data:{clientId:client.id,date:"2026-09-02",validUntil:"2099-12-31",notes:"INTERNO",service:"TOTAL FALSO",amountCents:1,calculation:{items:[{description:"Lavagem",quantity:2,unitPriceCents:10000}],travelCents:1000,extraCents:0,discount:{type:"percent",value:1000},totalCents:1}}});
    qid=quote.id;const data=await dashboard();const q=data.quotes.find(q=>q.id===qid);token=q.public_token;
    assert.equal(q.amount_cents,18900);
    assert.equal(data.incomes.find(i=>i.quote_id===qid).status,"pendente");
    assert.equal((await query("financial",{month:"2026-09"})).received_cents,0);
  });
  await t.test("link público mostra só um orçamento e aceita uma resposta",async()=>{
    await as("anon");
    const q=await call("ms_public_quote",[token],["uuid"]);
    assert.equal(q.id,qid);assert.equal(q.amount_cents,18900);
    assert.equal(q.phone,undefined);assert.equal(q.notes,undefined);
    assert.equal(await call("ms_public_quote",[randomUUID()],["uuid"]),null);
    assert.equal((await call("ms_respond_quote",[token,"aprovado"],["uuid","text"])).status,"aprovado");
    await assert.rejects(call("ms_respond_quote",[token,"recusado"],["uuid","text"]),/já foi respondido/);
  });
  await t.test("aprovação agenda sem duplicar ganho; conclusão recebe o valor inteiro",async()=>{
    await as("authenticated",admin);
    const payload={id:qid,status:"aprovado",data:{date:"2026-09-03",time:"10:00",durationMinutes:60}};
    await mutate("update_quotes",payload);await mutate("update_quotes",payload);
    let data=await dashboard();aid=data.appointments.find(a=>a.quote_id===qid).id;
    assert.equal(data.incomes.filter(i=>i.quote_id===qid).length,1);
    await assert.rejects(mutate("create_appointments",{data:{date:"2026-09-03",time:"10:30",client:"Conflito",service:"Lavagem",amountCents:1000}}),/Conflito/);
    await mutate("update_appointments",{id:aid,status:"concluido",data:{date:"2026-09-03",paymentStatus:"recebido",paymentMethod:"pix"}});
    await mutate("update_appointments",{id:aid,status:"concluido",data:{date:"2026-09-04",paymentStatus:"recebido",paymentMethod:"pix"}});
    data=await dashboard();
    assert.equal(data.incomes.find(i=>i.appointment_id===aid).status,"recebido");
    assert.equal((await query("financial",{month:"2026-09"})).received_cents,18900);
    await assert.rejects(mutate("operation_payment",{}),/Operação inválida/);
  });
  await t.test("compra cria uma despesa, consumo não duplica e estorno aceita UUID",async()=>{
    const product=await mutate("operation_product",{data:{name:"Produto teste",unit:"ml",minimumMilli:100}});
    const purchase={data:{operationId:randomUUID(),productId:product.id,quantityMilli:1000000,costCents:10000,date:"2026-09-02",mode:"purchase",method:"pix"}};
    await mutate("operation_stock",purchase);await mutate("operation_stock",purchase);
    const usage=randomUUID();await mutate("operation_consume",{data:{operationId:usage,productId:product.id,appointmentId:aid,quantityMilli:100000,date:"2026-09-03"}});
    assert.equal((await dashboard()).expenses.length,1);
    assert.equal((await query("job",{id:aid})).usage[0].cost_cents,1000);
    assert.equal((await query("catalog")).products[0].stock_milli,900000);
    await mutate("operation_reverse_usage",{id:usage});await mutate("operation_reverse_usage",{id:usage});
    assert.equal((await query("catalog")).products[0].stock_milli,1000000);
    assert.equal((await dashboard()).expenses.length,1);
  });
  await t.test("cancelamento permite reagendar e depois excluir sem histórico",async()=>{
    const q=await mutate("create_quotes",{data:{date:"2026-09-02",client:"Cancelamento",service:"Lavagem",amountCents:10000}});
    const payload={id:q.id,status:"aprovado",data:{date:"2026-09-04",time:"10:00",durationMinutes:60}};
    await mutate("update_quotes",payload);
    let a=(await dashboard()).appointments.find(a=>a.quote_id===q.id);
    await mutate("update_appointments",{id:a.id,status:"cancelado"});
    await assert.rejects(mutate("update_appointments",{id:a.id,status:"concluido",data:{date:"2026-09-04",paymentStatus:"recebido",paymentMethod:"pix"}}),/cancelado/);
    await mutate("update_quotes",payload);
    assert.equal((await dashboard()).appointments.filter(a=>a.quote_id===q.id).length,1);
    await mutate("update_appointments",{id:a.id,status:"cancelado"});
    await mutate("delete_delete_cancelled",{id:q.id});
    assert.equal((await dashboard()).quotes.some(row=>row.id===q.id),false);
  });
  await t.test("metadados de foto aceitam UUID e bucket privado respeita autorização",async()=>{
    const id=randomUUID(),key=`${aid}/${id}`;
    await db.query("insert into storage.objects(bucket_id,name)values('job-photos',$1)",[key]);
    await mutate("operation_photo_add",{data:{id,appointmentId:aid,stage:"before",objectKey:key,contentType:"image/jpeg",size:100}});
    assert.equal((await query("photo",{id})).object_key,key);
    await as("authenticated",other);
    assert.equal((await db.query("select * from storage.objects")).rows.length,0);
    await as("authenticated",admin);
    await mutate("operation_photo_delete",{id});
    assert.equal(await query("photo",{id}),null);
  });
  await t.test("esquema pode ser reaplicado sem perder os dados",async()=>{
    await db.exec("reset role");
    await db.exec(schema);
    await as("authenticated",admin);
    assert.equal((await dashboard()).quotes.some(q=>q.id===qid),true);
  });
  await t.test("recebimento antecipado não é zerado ao agendar ou concluir",async()=>{
    const q=await mutate("create_quotes",{data:{date:"2026-08-15",client:"Antecipado",service:"Limpeza",amountCents:9000}});
    let income=(await dashboard()).incomes.find(i=>i.quote_id===q.id);
    await mutate("update_incomes",{id:income.id,status:"recebido",data:{date:"2026-08-15",paymentMethod:"pix"}});
    await mutate("update_quotes",{id:q.id,status:"aprovado",data:{date:"2026-09-10",time:"10:00"}});
    let a=(await dashboard()).appointments.find(a=>a.quote_id===q.id);
    await mutate("update_appointments",{id:a.id,status:"concluido",data:{date:"2026-09-10",paymentStatus:"recebido",paymentMethod:"dinheiro"}});
    income=(await dashboard()).incomes.find(i=>i.quote_id===q.id);
    assert.equal(income.status,"recebido");assert.equal(income.date,"2026-08-15");assert.equal(income.payment_method,"pix");
  });
  await t.test("orçamento recusado cancela recebível e vencido não aceita resposta",async()=>{
    const q=await mutate("create_quotes",{data:{date:"2026-09-02",client:"Recusa",service:"Limpeza",amountCents:9000}});
    const expired=await mutate("create_quotes",{data:{date:"2020-01-01",validUntil:"2020-01-02",client:"Vencido",service:"Limpeza",amountCents:1000}});
    const data=await dashboard();
    await as("anon");
    await call("ms_respond_quote",[data.quotes.find(row=>row.id===q.id).public_token,"recusado"],["uuid","text"]);
    await assert.rejects(call("ms_respond_quote",[data.quotes.find(row=>row.id===expired.id).public_token,"aprovado"],["uuid","text"]),/venceu/);
    await as("authenticated",admin);
    assert.equal((await dashboard()).incomes.find(i=>i.quote_id===q.id).status,"cancelado");
  });
  await db.close();
});
