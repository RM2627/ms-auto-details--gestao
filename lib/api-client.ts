"use client";
import { MAX_JOB_PHOTOS, MAX_PHOTO_BYTES, photoContentType } from "./job-photos";
import { quotePricing } from "./quote-calculator";
import { sitePath } from "./site-path";

type Session = { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number };
const sessionKey = `ms_auto_details_session:${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}`;
let refreshing: Promise<Session> | null = null;
class SupabaseError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configure a URL e a chave pública do Supabase nas variáveis do GitHub e publique novamente. Consulte o README.");
  return { url, key };
}
export function getSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(sessionKey) || "null"); } catch { return null; }
}
export function saveSession(session: Session) {
  localStorage.setItem(sessionKey, JSON.stringify({ ...session, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + (session.expires_in || 3600) }));
}
export function clearSession() { localStorage.removeItem(sessionKey); }
function loginRequired(): never {
  clearSession();
  window.location.replace(sitePath("/login/"));
  throw new SupabaseError("Faça login para continuar.", 401);
}
async function rawRequest(path: string, init: RequestInit = {}, token?: string) {
  const { url, key } = configuration();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  else if (!key.startsWith("sb_publishable_")) headers.set("Authorization", `Bearer ${key}`);
  return fetch(`${url}/${path}`, { ...init, headers, cache: "no-store" });
}
async function responseError(response: Response) {
  const data = await response.json().catch(() => ({}));
  return new SupabaseError(data.message || data.msg || data.error_description || data.error || "Não foi possível concluir a operação.", response.status);
}
async function refreshSession(): Promise<Session> {
  if (!refreshing) refreshing = (async () => {
    const current = getSession();
    if (!current?.refresh_token) return loginRequired();
    const response = await rawRequest("auth/v1/token?grant_type=refresh_token", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!response.ok) {
      if (response.status < 500) return loginRequired();
      throw await responseError(response);
    }
    const session: Session = await response.json();
    saveSession(session);
    return session;
  })().finally(() => { refreshing = null; });
  return refreshing;
}
async function request(path: string, init: RequestInit = {}, authenticated = true) {
  let session = authenticated ? getSession() : null;
  if (authenticated && !session) return loginRequired();
  if (session?.expires_at && session.expires_at < Date.now() / 1000 + 30) session = await refreshSession();
  let response = await rawRequest(path, init, session?.access_token);
  if (authenticated && response.status === 401) {
    session = await refreshSession();
    response = await rawRequest(path, init, session.access_token);
  }
  if (!response.ok) throw await responseError(response);
  return response;
}
export async function rpc<T = unknown>(name: string, body: Record<string, unknown> = {}, authenticated = true): Promise<T> {
  const response = await request(`rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, authenticated);
  return response.json();
}
export async function signIn(email: string, password: string) {
  const response = await rawRequest("auth/v1/token?grant_type=password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
  if (!response.ok) throw new Error("Não foi possível entrar. Confira o e-mail e a senha.");
  saveSession(await response.json());
  try {
    if (!await rpc<boolean>("ms_is_admin")) throw new Error("Seu usuário ainda não foi liberado como administrador no Supabase. Consulte o README.");
  } catch (error) { await signOut(); throw error; }
}
export async function signOut() {
  const session = getSession();
  clearSession();
  if (session) await rawRequest("auth/v1/logout", { method: "POST", keepalive: true }, session.access_token).catch(() => {});
}
export function camelize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), key === "time" && typeof item === "string" ? item.slice(0, 5) : camelize(item)]));
  return value;
}

// Compatibility adapter: these names are local commands, never requests to GitHub /api.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    const url = new URL(input, "https://local.invalid");
    const method = (init.method || "GET").toUpperCase();
    if (url.pathname === "/api/photos") return await photos(url, method, init);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
    let result: unknown;
    if (url.pathname === "/api/data") {
      if (method === "GET") result = await rpc("ms_dashboard", { p_month: url.searchParams.get("month") });
      else {
        if (method === "POST" && body.resource === "quotes") body.data = { ...body.data, ...quotePricing(body.data) };
        const prefix = method === "POST" ? "create" : method === "PATCH" ? "update" : "delete";
        result = { record: await rpc("ms_mutate", { p_action: `${prefix}_${body.action || body.resource}`, p_data: body }) };
      }
    } else if (url.pathname === "/api/services") {
      result = method === "GET" || body.action === "initialize" ? await rpc("ms_services") : { record: await rpc("ms_mutate", { p_action: `service_${method === "POST" ? "create" : method === "PATCH" ? "update" : "delete"}`, p_data: body }) };
    } else if (url.pathname === "/api/operations") {
      result = method === "GET" ? await rpc("ms_query", { p_action: url.searchParams.get("action"), p_data: Object.fromEntries(url.searchParams) }) : { ok: true, result: await rpc("ms_mutate", { p_action: `operation_${body.action}`, p_data: body }) };
    } else throw new Error("Operação desconhecida.");
    return Response.json(camelize(result));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível conectar ao Supabase." }, { status: error instanceof SupabaseError ? error.status : 400 });
  }
}
async function photos(url: URL, method: string, init: RequestInit): Promise<Response> {
  if (method === "GET" || method === "DELETE") {
    const id = method === "GET" ? url.searchParams.get("id") : JSON.parse(String(init.body)).id;
    const photo = await rpc<{ object_key: string } | null>("ms_query", { p_action: "photo", p_data: { id } });
    if (!photo) throw new Error("Foto não encontrada.");
    if (method === "GET") return request(`storage/v1/object/authenticated/job-photos/${photo.object_key}`);
    await request(`storage/v1/object/job-photos/${photo.object_key}`, { method: "DELETE" });
    await rpc("ms_mutate", { p_action: "operation_photo_delete", p_data: { id } });
    return Response.json({ ok: true });
  }
  const form = init.body;
  if (!(form instanceof FormData)) throw new Error("Envie uma foto.");
  const appointmentId = Number(form.get("appointmentId")), stage = String(form.get("stage")), file = form.get("file");
  if (!Number.isInteger(appointmentId) || appointmentId <= 0 || !["before", "after"].includes(stage) || !(file instanceof File) || file.size > MAX_PHOTO_BYTES) throw new Error("Confira a foto e o serviço.");
  const details = await rpc<{ photos: unknown[] }>("ms_query", { p_action: "job", p_data: { id: appointmentId } });
  if (details.photos.length >= MAX_JOB_PHOTOS) throw new Error("Limite de 12 fotos por serviço atingido.");
  const bytes = new Uint8Array(await file.arrayBuffer()), contentType = photoContentType(bytes), id = crypto.randomUUID(), objectKey = `${appointmentId}/${id}`;
  await request(`storage/v1/object/job-photos/${objectKey}`, { method: "POST", headers: { "Content-Type": contentType, "x-upsert": "false" }, body: file });
  try { await rpc("ms_mutate", { p_action: "operation_photo_add", p_data: { data: { id, appointmentId, stage, objectKey, contentType, size: file.size } } }); }
  catch (error) { await request(`storage/v1/object/job-photos/${objectKey}`, { method: "DELETE" }).catch(() => {}); throw error; }
  return Response.json({ id }, { status: 201 });
}
