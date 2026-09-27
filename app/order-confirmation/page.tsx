"use client";

import { useEffect, useState } from "react";

export default function OrderConfirmationPage() {
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem("tsh_last_order");
    if (raw) setOrder(JSON.parse(raw));
  }, []);

  if (!order) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-xl font-bold">No order found</h1>
        <p className="mt-2">
          Visit the{" "}
          <a href="/" className="underline">
            design studio
          </a>{" "}
          to place an order.
        </p>
      </main>
    );
  }

  const paise = order.total_paise;
  const rupees = paise / 100;

  return (
    <main className="max-w-2xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Order placed — thank you!</h1>
        <p className="text-sm text-neutral-600">
          Confirmation code {order.order_code}
        </p>
      </header>

      <section className="border rounded p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-neutral-600">Order</span>
          <span>{order.order_code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">Type</span>
          <span className="capitalize">{order.order_type}</span>
        </div>
        {order.order_type === "b2b" && order.company_name ? (
          <div className="flex justify-between">
            <span className="text-neutral-600">Company</span>
            <span>{order.company_name}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="text-neutral-600">Shirt</span>
          <span>{order.style_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">Colour</span>
          <span>{order.colour}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">Quantity</span>
          <span>{order.total_quantity}</span>
        </div>
        <div className="flex justify-between text-xl font-bold border-t pt-2">
          <span>Total</span>
          <span>₹{rupees.toFixed(2)}</span>
        </div>
      </section>

      <p className="mt-6 text-sm text-neutral-600">
        Shankar will print exactly what you designed. We'll email you when it is
        in production.
      </p>

      <p className="mt-8 text-xs text-neutral-500">
        Saved design:{" "}
        {order.design?.text ? `text "${order.design.text}"` : "logo upload"}, at{" "}
        {new Date(order.created_at).toLocaleString()}.
      </p>
    </main>
  );
}
