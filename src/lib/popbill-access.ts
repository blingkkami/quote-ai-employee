const POPBILL_ACCESS_KEY = "blingbill:popbill-access-token";

export const getPopbillAccessToken = () => {
  try {
    return sessionStorage.getItem(POPBILL_ACCESS_KEY) ?? "";
  } catch {
    return "";
  }
};

export const setPopbillAccessToken = (value: string) => {
  try {
    if (value) sessionStorage.setItem(POPBILL_ACCESS_KEY, value);
    else sessionStorage.removeItem(POPBILL_ACCESS_KEY);
  } catch {
    // The API will reject the request and show the user a connection error.
  }
};

export const popbillAccessHeaders = () => ({ "X-Blingbill-Token": getPopbillAccessToken() });
