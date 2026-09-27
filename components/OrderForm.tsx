"use client";

import { useState } from "react";
import type { Catalogue, CatalogueStyle, Design, OrderType } from "@/types";
import { DESIGN_COLOURS, FONT_OPTIONS } from "@/types";
import { formatMoney } from "@/lib/catalogue";
import { DesignCanvas } from "@/components/DesignCanvas";

export interface OrderFormProps {
  catalogue: Catalogue;
}

export function OrderForm({ catalogue }: OrderFormProps) {
  const style: CatalogueStyle = catalogue.styles[0];
  const [orderType, setOrderType] = useState<OrderType>("b2c");
  const [colourId, setColourId] = useState(style.colours[0]?.id ?? "");
  const [sizeId, setSizeId] = useState(style.sizes[0]?.id ?? "");
  const [lines, setLines] = useState<{ size_id: string; quantity: number }[]>(
    style.sizes[0] ? [{ size_id: style.sizes[0].id, quantity: 1 }] : []
  );
  const [design, setDesign] = useState<Design>({
    text: "MY SHIRT",
    colour: "#000000",
    font: "Arial",
    logo_path: null,
    x: 50,
    y: 45,
    scale: 1,
  });

  const [uploading, setUploading] = useState(false);
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyTotal = orderType === "b2c" ? 1 : lines.reduce((s, l) => s + l.quantity, 0);
  // Unit price = best applicable bulk tier (or retail for B2C).
  let unitPrice = style.retail_price_paise;
  if (orderType === "b2b") {
    for (const t of style.price_tiers) {
      if (qtyTotal >= t.min_quantity && t.unit_price_paise < unitPrice) {
        unitPrice = t.unit_price_paise;
      }
    }
  }
  const totalPaise = qtyTotal * unitPrice;
  const totalRetail = qtyTotal * style.retail_price_paise;
  const savings = totalRetail - totalPaise;

  function onTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    setDesign({ ...design, text: e.target.value });
  }
  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    fetch("/api/upload-logo", { method: "POST", body: form })
      .then((r) => r.json())
      .then((res) => {
          if (res.public_url) {
            setDesign({ ...design, logo_path: res.path, text: "" });
          } else {
            setError(res.error || "logo upload failed");
          }
      })
      .finally(() => setUploading(false));
  }
  function addLine() {
      const next = style.sizes.find(
      (s: { id: string }) => !lines.some((l) => l.size_id === s.id)
    );
    if (next) setLines([...lines, { size_id: next.id, quantity: 1 }]);
  }
  function updateLine(index: number, quantity: number) {
    const copy = [...lines];
    copy[index].quantity = Math.max(0, quantity);
    setLines(copy);
  }
  function removeLine(index: number) {
    setLines(lines.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        order_type: orderType,
        style_id: style.id,
        colour_id: colourId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        company_name: orderType === "b2b" ? customer.company : null,
        design_text: design.text || null,
        design_colour: design.colour,
        design_font: design.font,
        design_logo_path: design.logo_path,
        design_x: design.x,
        design_y: design.y,
        design_scale: design.scale,
        items:
          orderType === "b2c"
            ? [{ size_id: sizeId, quantity: 1 }]
            : lines
                .filter((l) => l.quantity > 0)
                .map((l) => ({ size_id: l.size_id, quantity: l.quantity })),
      };

      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "order failed");

      localStorage.setItem(
        "tsh_last_order",
        JSON.stringify({
          order_code: data.order_code,
          order_id: data.order_id,
          total_paise: data.total_paise,
          total_quantity: data.total_quantity,
          order_type: orderType,
          style_name: style.name,
          colour: style.colours.find((c) => c.id === colourId)?.name ?? colourId,
          design,
          created_at: new Date().toISOString(),
        })
      );
      window.location.href = "/order-confirmation";
    } catch (err: any) {
      setError(err.message || "could not place order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-6">
      {/* Left: catalogue + design */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Shirt style</label>
          <div className="text-lg font-semibold">{style.name}</div>
          <p className="text-sm text-neutral-600">{style.description}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Colour</label>
          <div className="flex gap-2 flex-wrap">
            {style.colours.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setColourId(c.id)}
                className={`w-8 h-8 rounded-full border-2 ${
                  colourId === c.id ? "border-black" : "border-neutral-300"
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Design text</label>
          <input
            type="text"
            value={design.text}
            onChange={onTextChange}
            className="w-full px-3 py-2 border rounded"
            placeholder="Type your design text…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Text colour</label>
            <div className="flex gap-1 flex-wrap">
              {DESIGN_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDesign({ ...design, colour: c })}
                  className={`w-7 h-7 rounded ${
                    design.colour === c ? "ring-2 ring-black" : "ring-1 ring-neutral-300"
                  }`}
                  style={{ backgroundColor: c === "#FFFFFF" ? "#f5f5f5" : c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Font</label>
            <select
              value={design.font}
              onChange={(e) =>
                setDesign({ ...design, font: e.target.value })
              }
              className="w-full px-3 py-2 border rounded"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Your logo (image)</label>
          <input
            type="file"
            accept="image/*"
            onChange={onUpload}
            className="w-full text-sm"
            disabled={uploading}
          />
          {uploading && <p className="text-xs text-neutral-600">uploading…</p>}
          {design.logo_path && (
            <p className="text-xs text-green-700">logo added (text disabled).</p>
          )}
        </div>

        <div className="pt-2">
          <DesignCanvas style={style} design={design} onDesignChange={setDesign} />
        </div>
      </div>

      {/* Right: order type + sizing + price + submit */}
      <div className="space-y-4">
        <fieldset className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="order_type"
              checked={orderType === "b2c"}
              onChange={() => setOrderType("b2c")}
            />{" "}
            B2C — one shirt
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="order_type"
              checked={orderType === "b2b"}
              onChange={() => setOrderType("b2b")}
            />{" "}
            B2B — bulk, many sizes
          </label>
        </fieldset>

        {orderType === "b2c" && (
          <div>
            <label className="block text-sm font-medium mb-1">Size</label>
            <select
              value={sizeId}
              onChange={(e) => setSizeId(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            >
              {style.sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {orderType === "b2b" && (
          <div>
            <label className="block text-sm font-medium mb-1">Sizes & quantities</label>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={l.size_id}
                    onChange={(e) => {
                      const copy = [...lines];
                      copy[i].size_id = e.target.value;
                      setLines(copy);
                    }}
                    className="w-1/2 px-2 py-1 border rounded"
                  >
                    {style.sizes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={l.quantity}
                    onChange={(e) => updateLine(i, parseInt(e.target.value, 10) || 0)}
                    className="w-16 px-2 py-1 border rounded"
                  />
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-red-600 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addLine}
                className="text-sm text-blue-600"
              >
                + add size
              </button>
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-1 text-base">
          <div className="flex justify-between">
            <span>Unit price</span>
            <span>{formatMoney(unitPrice)}</span>
          </div>
          {orderType === "b2b" && savings > 0 && (
            <div className="flex justify-between text-green-700">
              <span>Bulk saving vs retail</span>
              <span>-{formatMoney(savings)}</span>
            </div>
          )}
          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span>{formatMoney(totalPaise)}</span>
          </div>
          <p className="text-xs text-neutral-500">
            {orderType === "b2c"
              ? "1 × ₹499.00"
              : `${qtyTotal} shirts × ${formatMoney(unitPrice)}`}
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Your name</label>
            <input
              type="text"
              required
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone</label>
            <input
              type="tel"
              required
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          {orderType === "b2b" && (
            <div>
              <label className="block text-sm font-medium mb-1">Company name</label>
              <input
                type="text"
                required
                value={customer.company}
                onChange={(e) => setCustomer({ ...customer, company: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting || (!design.text && !design.logo_path)}
          className="w-full bg-neutral-900 text-white py-2 rounded hover:bg-black disabled:opacity-50"
        >
          {submitting ? "Placing…" : "Place order"}
        </button>
      </div>
    </form>
  );
}
