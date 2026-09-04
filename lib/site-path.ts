export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
export function sitePath(path = "/") { return `${basePath}${path.startsWith("/") ? path : `/${path}`}`; }
export function quoteLink(token: string, origin: string) { return `${origin}${sitePath("/orcamento/")}?token=${encodeURIComponent(token)}`; }
