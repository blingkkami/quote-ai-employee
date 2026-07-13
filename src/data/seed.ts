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
    contactEmail: "",
    isConnected: false,
    memo: ""
  }
};
