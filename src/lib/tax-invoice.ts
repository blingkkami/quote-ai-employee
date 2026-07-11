export type IssueTaxInvoiceItem = {
  name: string;
  supplyCost: number;
  tax: number;
};

export type IssueTaxInvoiceCustomer = {
  businessNumber: string;
  name: string;
  ceoName?: string;
  email?: string;
  contactName?: string;
  address?: string;
};

export type IssueTaxInvoicePayload = {
  quoteId: string;
  projectName: string;
  writeDate: string;
  supplyCost: number;
  tax: number;
  total: number;
  items: IssueTaxInvoiceItem[];
  customer: IssueTaxInvoiceCustomer;
};

export type IssueTaxInvoiceResult = {
  ok: boolean;
  mode?: string;
  invoiceStatus: "issued" | "failed";
  popbillInvoiceId?: string;
  message?: string;
};

export async function issueTaxInvoice(payload: IssueTaxInvoicePayload): Promise<IssueTaxInvoiceResult> {
  try {
    const response = await fetch("/api/popbill/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as IssueTaxInvoiceResult;

    if (!response.ok) {
      return {
        ok: false,
        invoiceStatus: "failed",
        message: result?.message || `발행 요청 실패 (HTTP ${response.status})`
      };
    }

    return result;
  } catch (error) {
    return {
      ok: false,
      invoiceStatus: "failed",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
