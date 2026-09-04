import { z } from "zod";

export type Service = { id: number; name: string; category: string; priceCents: number | null };

export const initialServiceCategories = [
  { name: "Lavagem e estética automotiva", services: ["Lavagem externa", "Limpeza interna", "Lavagem completa", "Lavagem detalhada", "Proteção e acabamento", "Higienização de bancos automotivos", "Revitalização de faróis"] },
  { name: "Higienização de sofás", services: ["Sofá 2 lugares", "Sofá 3 lugares", "Sofá 4 lugares", "Sofá 5 lugares", "Sofá de canto", "Sofá retrátil", "Sofá modular", "Sofá-cama"] },
  { name: "Poltronas e cadeiras", services: ["Higienização de poltrona", "Higienização de cadeira estofada", "Higienização de puff", "Higienização de banco estofado"] },
  { name: "Colchões", services: ["Higienização de colchão solteiro", "Higienização de colchão casal", "Higienização de colchão queen", "Higienização de colchão king"] },
  { name: "Outros estofados", services: ["Higienização de almofadas", "Higienização de cabeceira estofada", "Higienização de bancos automotivos avulsos"] },
];

const serviceSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do serviço.").max(200, "Use até 200 caracteres no nome."),
  category: z.string().trim().min(1, "Informe a categoria.").max(100, "Use até 100 caracteres na categoria."),
  priceCents: z.number().int("Informe um preço válido.").min(0, "O preço não pode ser negativo.").max(100_000_000, "O preço informado é muito alto."),
});

export function serviceInput(input: unknown) {
  const result = serviceSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0].message);
  return result.data;
}

export function serviceId(input: unknown) {
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input <= 0) throw new Error("Serviço inválido.");
  return input;
}

export function groupServices(services: Service[]) {
  const names = [...new Set([...initialServiceCategories.map((group) => group.name), ...services.map((service) => service.category)])];
  return names.map((name) => ({ name, services: services.filter((service) => service.category === name) })).filter((group) => group.services.length);
}
