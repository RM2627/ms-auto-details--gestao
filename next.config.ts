import type { NextConfig } from "next";

const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
let keyRole = "";
try { keyRole = JSON.parse(Buffer.from(publicKey.split(".")[1] || "", "base64url").toString()).role; } catch {}
if (publicKey.startsWith("sb_secret_") || keyRole === "service_role") {
  throw new Error("Chave secreta detectada. Use somente a chave publishable ou anon do Supabase.");
}

if (process.env.REQUIRE_SUPABASE_CONFIG === "true" && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  throw new Error("Cadastre NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em Settings > Secrets and variables > Actions > Variables.");
}

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  images: { unoptimized: true },
};

export default nextConfig;
