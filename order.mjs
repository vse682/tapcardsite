// Принимает заказ с сайта и пересылает его тебе в Telegram.
// Токен и ID берутся из переменных окружения Netlify: BOT_TOKEN и ADMIN_ID.
// Цены, скидки и остатки берутся из catalog.json на сайте, поэтому сумму нельзя подделать в браузере.

const clean = (v, max = 300) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

// Та же логика, что в index.html (функция quote)
function quote(catalog, items) {
  const lines = [];
  let total = 0;
  let onRequest = false;
  for (const p of catalog) {
    const chosen = p.variants
      .map((v) => [v, Math.floor(Number(items[`${p.id}:${v.id}`]) || 0)])
      .filter(([, n]) => n > 0);
    if (!chosen.length) continue;
    const qty = chosen.reduce((s, [, n]) => s + n, 0);

    // Проверка остатков
    if (p.stock != null && qty > p.stock) return { error: "stock" };
    for (const [v, n] of chosen) {
      if (n > 999 || (v.stock != null && n > v.stock)) return { error: "stock" };
    }

    const disc = p.bulk && qty >= p.bulk.min;
    const unit = p.price == null ? null : p.price - (disc ? p.bulk.off : 0);
    for (const [v, n] of chosen) {
      const label = p.variants.length > 1 ? `${p.name}, ${v.name}` : p.name;
      if (unit == null) {
        onRequest = true;
        lines.push(`• ${label} × ${n} = цена по запросу`);
        continue;
      }
      lines.push(`• ${label} × ${n} = ${unit * n} грн${disc ? ` (скидка, по ${unit} грн)` : ""}`);
      total += unit * n;
    }
  }
  return { lines, total, onRequest };
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // Ловушка для спам-ботов: это поле скрыто, человек его не заполняет
  if (body.website) return Response.json({ ok: true });

  const name = clean(body.name, 60);
  const phone = clean(body.phone, 20);
  const city = clean(body.city, 60);
  const branch = clean(body.branch, 80);
  if (!name || !city || !branch || phone.replace(/\D/g, "").length < 10) {
    return new Response("Missing fields", { status: 400 });
  }

  let catalog;
  try {
    catalog = await (await fetch(new URL("/catalog.json", req.url))).json();
  } catch (e) {
    console.error("catalog load failed", e);
    return new Response("Catalog error", { status: 500 });
  }

  const q = quote(catalog, body.items || {});
  if (q.error === "stock") return new Response("Not enough stock", { status: 409 });
  if (!q.lines.length) return new Response("Empty order", { status: 400 });

  const text = [
    "🛒 Новый заказ с сайта",
    "",
    ...q.lines,
    `Итого: ${q.total} грн${q.onRequest ? " + свой дизайн (цена по запросу)" : ""}`,
    "",
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `Город: ${city}`,
    `НП: ${branch}`,
    `Контакт: ${clean(body.contact, 60) || "—"}`,
    `Оплата: ${clean(body.payment, 60)}`,
    `Ссылка для карты: ${clean(body.link) || "—"}`,
    `Комментарий: ${clean(body.comment, 500) || "—"}`,
  ].join("\n");

  const res = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: process.env.ADMIN_ID, text, disable_web_page_preview: true }),
  });

  if (!res.ok) {
    console.error("Telegram error", res.status, await res.text());
    return new Response("Telegram error", { status: 502 });
  }
  return Response.json({ ok: true });
};
