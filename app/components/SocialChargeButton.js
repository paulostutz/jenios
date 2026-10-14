"use client";

import { useEffect, useState } from "react";

export default function SocialChargeButton({ productCode, label }) {
  const [state, setState] = useState({ loading: true, enabled: false, product: null, message: "" });
  useEffect(() => {
    let active = true;
    fetch("/api/jenios-pay/products", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Catálogo indisponível.");
        return body;
      })
      .then((body) => {
        if (!active) return;
        const product = (body.products || []).find((item) => item.code === productCode) || null;
        setState({
          loading: false,
          enabled: Boolean(body.paymentsEnabled && body.checkoutReady && product),
          product,
          message: !product ? "Produto ainda não configurado no catálogo JENIOS PAY." : !body.paymentsEnabled || !body.checkoutReady ? "Cobranças mantidas desativadas até homologação financeira." : "",
        });
      })
      .catch((error) => active && setState({ loading: false, enabled: false, product: null, message: error.message }));
    return () => { active = false; };
  }, [productCode]);
  const amount = state.product ? (Number(state.product.price_cents) / 100).toLocaleString("pt-BR", { style: "currency", currency: state.product.currency || "BRL" }) : null;
  return <div style={{ display: "grid", gap: 7 }}>
    <button type="button" disabled={!state.enabled} title={state.message} style={{ padding: "12px 16px", border: 0, borderRadius: 10, background: state.enabled ? "#6d28d9" : "#cbd5e1", color: state.enabled ? "white" : "#475569", fontWeight: 800, cursor: state.enabled ? "pointer" : "not-allowed" }}>
      {state.loading ? "Consultando JENIOS PAY…" : label + (amount ? " · " + amount : "")}
    </button>
    {state.message && <small role="status" style={{ color: "#64748b", lineHeight: 1.5 }}>{state.message}</small>}
  </div>;
}
