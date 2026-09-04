import type { QuoteCalculation } from "./quote-calculator";

export type Income = {
  id: number;
  clientId?: number | null;
  paidCents?: number;
  hasPayments?: boolean;
  quoteId?: number | null;
  appointmentId?: number | null;
  date: string;
  client: string;
  service: string;
  amountCents: number;
  paymentMethod: string;
  status: "recebido" | "pendente" | "cancelado";
  notes: string;
  createdAt: string;
};

export type Expense = {
  id: number;
  date: string;
  description: string;
  category: string;
  amountCents: number;
  paymentMethod: string;
  notes: string;
  createdAt: string;
};

export type Appointment = {
  id: number;
  clientId?: number | null;
  durationMinutes?: number | null;
  incomeId?: number | null;
  quoteId?: number | null;
  completedDate?: string | null;
  date: string;
  time: string;
  client: string;
  phone: string;
  location: string;
  service: string;
  amountCents: number;
  status: "agendado" | "concluido" | "cancelado";
  notes: string;
  createdAt: string;
};

export type Quote = {
  id: number;
  clientId?: number | null;
  canDeleteCancelled?: boolean;
  incomeId?: number | null;
  appointmentId?: number | null;
  publicToken?: string;
  publicRespondedAt?: string | null;
  date: string;
  validUntil: string | null;
  client: string;
  phone: string;
  service: string;
  amountCents: number;
  calculation?: QuoteCalculation | null;
  status: "pendente" | "aprovado" | "recusado";
  notes: string;
  createdAt: string;
};

export type DashboardData = {
  incomes: Income[];
  expenses: Expense[];
  appointments: Appointment[];
  quotes: Quote[];
};

export type ResourceName = keyof DashboardData;
