import popbill from "popbill";

export function getPopbillService() {
  const linkId = process.env.POPBILL_LINK_ID;
  const secretKey = process.env.POPBILL_SECRET_KEY;
  const environment = process.env.POPBILL_IS_TEST === "false" ? "production" : "test";
  const missing = ["POPBILL_LINK_ID", "POPBILL_SECRET_KEY"].filter((name) => !process.env[name]);
  if (missing.length) return { service: null, linkId, environment, missing };

  popbill.config({
    LinkID: linkId,
    SecretKey: secretKey,
    IsTest: environment === "test",
    IPRestrictOnOff: true,
    UseStaticIP: false,
    UseLocalTimeYN: true,
    defaultErrorHandler: () => {}
  });

  return { service: popbill.TaxinvoiceService(), linkId, environment, missing: [] };
}

export function callPopbill(service, method, args = [], timeoutMs = 10000) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ ok: false, error: { message: "팝빌 응답 시간이 초과되었습니다." } }), timeoutMs);
    const finish = (value) => {
      clearTimeout(timeout);
      resolve(value);
    };
    try {
      service[method](...args, (result) => finish({ ok: true, result }), (error) => finish({ ok: false, error }));
    } catch (error) {
      finish({ ok: false, error });
    }
  });
}
