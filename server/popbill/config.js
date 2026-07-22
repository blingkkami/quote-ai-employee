const text = (value) => String(value ?? "").trim();

const bundledConfig = () => {
  const raw = text(process.env.POPBILL_CONFIG);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export function getPopbillConfig() {
  const bundled = bundledConfig();
  const linkId = text(process.env.POPBILL_LINK_ID || bundled.linkId || bundled.LinkID);
  const secretKey = text(process.env.POPBILL_SECRET_KEY || bundled.secretKey || bundled.SecretKey);
  const corpNum = text(process.env.POPBILL_CORP_NUM || bundled.corpNum || bundled.CorpNum).replace(/\D/g, "");
  const testValue = process.env.POPBILL_IS_TEST ?? bundled.isTest ?? bundled.IsTest;
  const isTest = testValue === false ? false : String(testValue ?? "true").toLowerCase() !== "false";
  const missing = [];
  if (!linkId) missing.push("POPBILL_CONFIG.linkId");
  if (!secretKey) missing.push("POPBILL_CONFIG.secretKey");
  return {
    linkId,
    secretKey,
    corpNum,
    isTest,
    environment: isTest ? "test" : "production",
    missing
  };
}
