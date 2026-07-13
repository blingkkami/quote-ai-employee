import type { QuoteRecord } from "../types";

export const quoteRecordDate = (quote: QuoteRecord) =>
  quote.form.quoteDate || quote.approvedAt?.slice(0, 10) || quote.createdAt.slice(0, 10);
