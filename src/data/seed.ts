import type { AppData } from "../types";

export const defaultData: AppData = {
  quotes: [],
  customers: [],
  vendors: [],
  sales: [],
  purchases: [],
  taxApiIntegration: {
    provider: "popbill",
    businessNumber: "",
    corpName: "",
    ceoName: "",
    address: "",
    bizType: "",
    bizClass: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    popbillUserId: "",
    isConnected: false,
    memo: ""
  },
  documentEmailSettings: {
    autoSendOnApproval: true
  },
  workspaceProfile: {
    businessName: "",
    paymentAccount: {
      bankName: "",
      accountNumber: "",
      accountHolder: "",
      showOnDocuments: false,
      showOnUnpaidNotices: true
    }
  }
};
