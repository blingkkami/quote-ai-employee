import type { QuoteRecord } from "../types";

export const quoteSubtotal = (quote: QuoteRecord) => quote.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
export const quoteVat = (quote: QuoteRecord) => Math.round(quoteSubtotal(quote) * 0.1);
export const quoteTotal = (quote: QuoteRecord) => quoteSubtotal(quote) + quoteVat(quote);

export const quoteHasContent = (quote: QuoteRecord) =>
  Object.values(quote.form).some((value) => String(value).trim())
  || quote.items.some((item) => item.category.trim() || item.description.trim() || Number(item.price) > 0);
