import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import test from "node:test";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const sql=read("supabase/schema.sql"),share=read("components/quote-share.tsx"),workflow=read("components/service-workflow.tsx"),client=read("lib/api-client.ts");
test("exportação estática com caminhos e workflow do GitHub Pages",()=>{
  assert.match(read("next.config.ts"),/output: "export"/);
  assert.match(read("next.config.ts"),/trailingSlash: true/);
  assert.match(read(".github/workflows/pages.yml"),/path: out/);
  assert.match(read(".github/workflows/pages.yml"),/outputs.base_path/);
  assert.match(read("lib/site-path.ts"),/orcamento\/.*\?token=/);
  assert.ok(existsSync(new URL("../app/orcamento/page.tsx",import.meta.url)));
});
test("nenhuma rota de servidor é enviada ao Pages",()=>{
  function scan(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?scan(new URL(f.name+"/",dir)):[new URL(f.name,dir)]);}
  assert.equal(scan(new URL("../app/",import.meta.url)).filter(p=>p.pathname.endsWith("/route.ts")).length,0);
  assert.doesNotMatch(client,/fetch\(["'`]\/api/);
});
test("todas as tabelas da gestão têm RLS e acesso direto revogado",()=>{
  for(const table of ["clients","services","quotes","appointments","incomes","expenses","products","stock_entries","product_usage","job_costs","work_orders","job_photos","ms_admin_users","service_catalog_state"])
    assert.match(sql,new RegExp(`alter table ${table} enable row level security`));
  assert.match(sql,/revoke all on table clients,services/);
});
test("sessão é validada pelo banco e chaves secretas não são usadas",()=>{
  assert.match(sql,/user_id=auth.uid\(\)/);
  for(const fn of ["ms_services","ms_dashboard","ms_query","ms_mutate"]){
    const body=sql.slice(sql.indexOf(`create or replace function ${fn}(`)).split("end$$;")[0];
    assert.match(body,/perform ms_require_admin\(\)/);
  }
  assert.doesNotMatch(client,/SERVICE_ROLE|sb_secret/);
  assert.doesNotMatch(read(".env.example"),/SERVICE_ROLE|ADMIN_EMAIL/);
});
test("orçamento público não expõe telefone nem notas internas",()=>{
  const body=sql.match(/create or replace function ms_public_quote[\s\S]*?\$\$;/)[0];
  assert.doesNotMatch(body,/phone|notes/);
  assert.match(sql,/public_token uuid not null default gen_random_uuid\(\) unique/);
  assert.match(sql,/public_responded_at is not null or q.status<>'pendente'/);
});
test("compartilhamento por texto e por link preservados",()=>{
  for(const label of ["Link para aprovar ou recusar","Copiar link","Enviar link no WhatsApp","Ou envie o orçamento como texto"]) assert.ok(share.includes(label));
});
test("pagamento integral, sem interface para sinal ou parcela",()=>{
  assert.doesNotMatch(workflow,/PaymentButton|parcialmente|Receber \/ sinal/);
  assert.match(workflow,/pagamento integral recebido/);
  assert.match(workflow,/valor integral a receber/);
});
test("guia contém liberação administrativa e variáveis públicas",()=>{
  assert.match(read("README.md"),/GitHub Pages/);
  assert.match(read("README.md"),/autorizar-admin.sql/);
  assert.match(read(".gitignore"),/!\.env\.example/);
});
