export function scoreShare(best, translate, href) {
  const score = Math.max(0, Math.floor(Number(best) || 0));
  const payload = { title: translate("\u5C0F\u5154\u5FEB\u8DD1"), text: translate("\u6211\u5728\u5C0F\u5154\u5FEB\u8DD1\u62FF\u5230\u4E86 {score} \u9897\u661F\uFF01\u6765\u6311\u6218\u6211\u7684\u6700\u597D\u6210\u7EE9\u5427\uFF01").replace("{score}", String(score)) };
  const url = new URL(href);
  if (url.protocol === "https:" && !/^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
    payload.url = url.origin + url.pathname;
  }
  return payload;
}
export async function shareScore(payload, platform) {
  if (platform.share) {
    try {
      await platform.share(payload);
      return { kind: "shared" };
    } catch (error) {
      if (error.name === "AbortError") return { kind: "cancelled" };
    }
  }
  const text = [payload.text, payload.url].filter(Boolean).join("\n");
  try {
    await platform.clipboard.writeText(text);
    return { kind: "copied" };
  } catch {
    return { kind: "manual", text };
  }
}
