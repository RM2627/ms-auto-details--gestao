"use client";

import { useId, useRef, useState } from "react";
import { Check, Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copyQuoteText, formatQuoteMessage, whatsappQuoteUrl } from "@/lib/quote-sharing";
import { quoteLink } from "@/lib/site-path";
import type { Quote } from "@/lib/types";

export function QuoteShareContent({ quote }: { quote: Quote }) {
  const id = useId();
  const preview = useRef<HTMLTextAreaElement>(null);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "manual">("idle");
  const [linkCopied, setLinkCopied] = useState(false);
  const message = formatQuoteMessage(quote, includeNotes);
  const link = quote.publicToken ? quoteLink(quote.publicToken, typeof window === "undefined" ? "" : window.location.origin) : "";

  async function copy() {
    setCopyStatus("copying");
    const copied = await copyQuoteText(message, navigator.clipboard);
    setCopyStatus(copied ? "copied" : "manual");
    if (!copied) {
      preview.current?.focus();
      preview.current?.select();
    }
  }

  return <div className="min-w-0 space-y-4">
    {link && <section className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4"><div><p className="font-semibold text-red-900">Link para aprovar ou recusar</p><p className="mt-1 break-all text-sm text-neutral-600">{link}</p></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={async()=>{const copied=await copyQuoteText(link,navigator.clipboard);setLinkCopied(copied);}}><Link2/>{linkCopied?"Link copiado":"Copiar link"}</Button><Button asChild className="bg-primary text-white hover:bg-red-800"><a href={whatsappQuoteUrl(`${message}\n\nAbra o orçamento e responda aqui:\n${link}`)} target="_blank" rel="noopener noreferrer"><MessageCircle/>Enviar link no WhatsApp</a></Button></div><p className="text-xs text-neutral-600">Quem receber este link verá somente este orçamento. Não publique o link em redes sociais.</p></section>}
    <p className="font-semibold">Ou envie o orçamento como texto</p>
    {quote.notes.trim() && <div className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
      <Checkbox id={`${id}-notes`} checked={includeNotes} disabled={copyStatus === "copying"} onCheckedChange={(checked) => { setIncludeNotes(checked === true); setCopyStatus("idle"); }} />
      <Label htmlFor={`${id}-notes`} className="text-sm leading-5">Incluir as observações neste envio</Label>
    </div>}
    <div className="space-y-2">
      <Label htmlFor={`${id}-message`}>Mensagem para o cliente</Label>
      <Textarea ref={preview} id={`${id}-message`} value={message} readOnly spellCheck={false} className="h-64 resize-y bg-white text-base leading-6 md:text-base" />
    </div>
    <p className="text-sm leading-5 text-neutral-600">No WhatsApp, escolha o contato e confirme o envio. Seu painel de gestão não será compartilhado.</p>
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => void copy()} disabled={copyStatus === "copying"}>
        {copyStatus === "copied" ? <Check /> : <Copy />}{copyStatus === "copying" ? "Copiando..." : copyStatus === "copied" ? "Texto copiado" : "Copiar texto"}
      </Button>
      <Button asChild className="bg-primary text-primary-foreground hover:bg-[#b8000d]">
        <a href={whatsappQuoteUrl(message)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><MessageCircle />Abrir WhatsApp</a>
      </Button>
    </div>
    <p role="status" className="text-sm leading-5 text-neutral-600">
      {copyStatus === "copied" ? "Texto copiado. Agora é só colar na conversa com o cliente." : copyStatus === "manual" ? "A cópia automática não foi permitida. O texto está selecionado; use a opção Copiar do seu aparelho." : ""}
    </p>
  </div>;
}

export function QuoteShareButton({ quote }: { quote: Quote }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="border-red-200 text-red-700 hover:bg-red-50" aria-label={`Compartilhar orçamento de ${quote.client}`}><Share2 />Compartilhar</Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-neutral-200 sm:max-w-xl">
      <DialogHeader><DialogTitle>Compartilhar orçamento</DialogTitle><DialogDescription>Confira os serviços e valores antes de enviar ao cliente.</DialogDescription></DialogHeader>
      {open && <QuoteShareContent quote={quote} />}
    </DialogContent>
  </Dialog>;
}
