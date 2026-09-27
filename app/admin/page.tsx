import { supabaseAdmin } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let orders: any[] = [];
  let count = 0;
  let loadError: string | null = null;

  try {
    const { data, count: c, error } = await supabaseAdmin
      .from("tsh_orders")
      .select(
        `id, order_code, order_type, company_name, customer_name, customer_email,
         total_quantity, total_paise, status, created_at,
         style:tsh_styles!inner(name),
         colour:tsh_colours!inner(name,hex),
         design_text, design_colour, design_font, design_logo_path,
         design_x, design_y, design_scale`,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    orders = (data ?? []) as any[];
    count = c ?? 0;
  } catch (e: any) {
    loadError = e?.message ?? "could not load orders";
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="mb-4 flex justify-between items-baseline">
        <h1 className="text-2xl font-bold">Shankar's Tees — orders</h1>
        <span className="text-sm text-neutral-600">{count} order(s)</span>
      </header>

      {loadError ? (
        <p className="text-red-600">{loadError}</p>
      ) : orders.length === 0 ? (
        <p className="text-neutral-600">No orders yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-100 text-left">
                <th className="p-2">Code</th>
                <th className="p-2">Type</th>
                <th className="p-2">Customer</th>
                <th className="p-2">Company</th>
                <th className="p-2">Colour</th>
                <th className="p-2">Qty</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2">Status</th>
                <th className="p-2">Design</th>
                <th className="p-2">When</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} className="border-t">
                  <td className="p-2 font-mono">{o.order_code}</td>
                  <td className="p-2 capitalize">{o.order_type}</td>
                  <td className="p-2">{o.customer_name}</td>
                  <td className="p-2">{o.company_name ?? "—"}</td>
                  <td className="p-2">{o.colour?.name ?? "—"}</td>
                  <td className="p-2">{o.total_quantity}</td>
                  <td className="p-2 text-right">{formatMoney(o.total_paise)}</td>
                  <td className="p-2 capitalize">{o.status}</td>
                  <td className="p-2">
                    {o.design_text ? (
                      <span style={{ color: o.design_colour ?? "#000" }}>{o.design_text}</span>
                    ) : o.design_logo_path ? (
                      <img
                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/tsh-logos/${o.design_logo_path}`}
                        alt="logo"
                        className="h-8 w-auto object-contain"
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-2 text-xs text-neutral-600">
                    {new Date(o.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
