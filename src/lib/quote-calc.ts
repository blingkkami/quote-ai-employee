import type { QuoteRecord } from "../types";

export const quoteSubtotal = (quote: QuoteRecord) => quote.items.reduce((sum, item) => sum + Number(item.price || 0), 0);
export const quoteVat = (quote: QuoteRecord) => Math.round(quoteSubtotal(quote) * 0.1);
export const quoteTotal = (quote: QuoteRecord) => quoteSubtotal(quote) + quoteVat(quote);
