import popbill from "popbill";
import { getPopbillConfig } from "./config.js";

// Configure the SDK once per invocation, guarded by credential presence.
// popbill.config only mutates a shared configuration object, so it is safe to
// call repeatedly; the service singletons keep a reference to that object.
function configure() {
  const config = getPopbillConfig();
  if (config.missing.length) return { ok: false, ...config };

  popbill.config({
    LinkID: config.linkId,
    SecretKey: config.secretKey,
    IsTest: config.isTest,
    IPRestrictOnOff: true,
    UseStaticIP: false,
    UseLocalTimeYN: true,
    defaultErrorHandler: () => {}
  });

  return { ok: true, ...config };
}

export function getPopbillService() {
  const cfg = configure();
  if (!cfg.ok) return { service: null, linkId: cfg.linkId, environment: cfg.environment, missing: cfg.missing };
  return { service: popbill.TaxinvoiceService(), linkId: cfg.linkId, environment: cfg.environment, missing: [] };
}

export function getCashbillService() {
  const cfg = configure();
  if (!cfg.ok) return { service: null, linkId: cfg.linkId, environment: cfg.environment, missing: cfg.missing };
  return { service: popbill.CashbillService(), linkId: cfg.linkId, environment: cfg.environment, missing: [] };
}

export function getClosedownService() {
  const cfg = configure();
  if (!cfg.ok) return { service: null, linkId: cfg.linkId, environment: cfg.environment, missing: cfg.missing };
  return { service: popbill.ClosedownService(), linkId: cfg.linkId, environment: cfg.environment, missing: [] };
}

export function getBizInfoCheckService() {
  const cfg = configure();
  if (!cfg.ok) return { service: null, linkId: cfg.linkId, environment: cfg.environment, missing: cfg.missing };
  return { service: popbill.BizInfoCheckService(), linkId: cfg.linkId, environment: cfg.environment, missing: [] };
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
