import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const paymentId = searchParams.get("paymentId") || `kbr_mock_${Date.now()}`;
  const reference = searchParams.get("reference") || "";
  const orderId = searchParams.get("orderId") || "";
  const amount = searchParams.get("amount") || "0";
  const method = (searchParams.get("method") || "moncash").toLowerCase();
  const course = searchParams.get("course") || "Formation";
  const auto = searchParams.get("auto");

  const returnUrl = `/api/payments/kobara/return?paymentId=${encodeURIComponent(
    paymentId
  )}&orderId=${encodeURIComponent(orderId)}&reference=${encodeURIComponent(
    reference
  )}&status=success`;

  const failUrl = `/api/payments/kobara/return?paymentId=${encodeURIComponent(
    paymentId + "_fail"
  )}&orderId=${encodeURIComponent(orderId)}&reference=${encodeURIComponent(
    reference
  )}&status=failed`;

  if (auto === "true") {
    return NextResponse.redirect(new URL(returnUrl, request.url));
  }

  const isMonCash = method === "moncash";
  const brandName = isMonCash ? "MonCash (Digicel)" : "NatCash (Natcom)";
  const brandColor = isMonCash ? "#dc2626" : "#0284c7";
  const brandBg = isMonCash ? "#fee2e2" : "#e0f2fe";

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Passerelle Kobara — Simulation</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2rem; max-width: 440px; width: 100%; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
    .logo { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.025em; color: #38bdf8; }
    .method-badge { font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: 9999px; background: ${brandBg}; color: ${brandColor}; }
    h1 { font-size: 1.15rem; margin: 0 0 0.5rem; font-weight: 600; }
    .sub { font-size: 0.85rem; color: #94a3b8; margin-bottom: 1.25rem; line-height: 1.4; }
    .summary { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; }
    .row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .row:last-child { margin-bottom: 0; padding-top: 0.5rem; border-top: 1px dashed #334155; font-weight: bold; }
    .btn { display: block; width: 100%; background: ${brandColor}; color: white; text-align: center; text-decoration: none; padding: 0.85rem; border-radius: 8px; font-weight: 600; font-size: 0.95rem; transition: filter 0.15s; }
    .btn:hover { filter: brightness(1.1); }
    .btn-fail { display: block; width: 100%; margin-top: 0.75rem; background: #334155; color: #f87171; text-align: center; text-decoration: none; padding: 0.65rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; border: 1px solid #dc2626; transition: background 0.15s; }
    .btn-fail:hover { background: #450a0a; }
    .cancel { display: block; text-align: center; margin-top: 1rem; color: #64748b; font-size: 0.8rem; text-decoration: none; }
    .cancel:hover { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="logo">Kobara.app</div>
      <div class="method-badge">${brandName}</div>
    </div>
    <h1>Confirmer votre paiement</h1>
    <div class="sub">Vous avez sélectionné <strong>${brandName}</strong> via l'infrastructure de paiement Kobara.</div>
    <div class="summary">
      <div class="row"><span>Formation</span><span>${course}</span></div>
      <div class="row"><span>Référence</span><code>${reference}</code></div>
      <div class="row"><span>Canal</span><span>${brandName}</span></div>
      <div class="row"><span>Montant total</span><span>${amount} HTG</span></div>
    </div>
    <a href="${returnUrl}" class="btn">Valider le paiement avec ${isMonCash ? "MonCash" : "NatCash"}</a>
    <a href="${failUrl}" class="btn-fail">Simuler un échec de paiement</a>
    <a href="/fr/confirmation/${orderId}?status=cancelled" class="cancel">Annuler et retourner au site</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
