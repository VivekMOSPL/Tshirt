import { getSupabaseAdmin } from "@/lib/supabase/server";
import { Catalogue } from "@/types";
import { OrderForm } from "@/components/OrderForm";
import { formatMoney } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

async function loadCatalogue(): Promise<Catalogue> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("tsh_get_catalogue");
  if (error) throw error;
  return (data ?? { styles: [] }) as Catalogue;
}

export default async function CustomerPage() {
  let catalogue: Catalogue | null = null;
  let loadError: string | null = null;
  try {
    catalogue = await loadCatalogue();
  } catch (e: any) {
    loadError = e?.message ?? "catalogue not available";
  }

  if (loadError || !catalogue) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <p className="text-red-600">
          Shankar's tee studio is not connected to the catalogue right now.
        </p>
        <p className="text-sm text-neutral-600 mt-2">
          {loadError} — add Supabase URL + keys to TshirtSolution/.env.local and
          run supabase/schema.sql in the SQL Editor.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Shankar's Tees — design studio</h1>
        <p className="text-sm text-neutral-600">
          Pick your tee, add a design, move and resize it, then place your order.
          No login, no payment — you pay on delivery. Retail price: {formatMoney(catalogue.styles[0]?.retail_price_paise ?? 0)} per shirt.
        </p>
      </header>

      {catalogue.styles.length === 0 ? (
        <p>No shirt styles are available right now.</p>
      ) : (
        <OrderForm catalogue={catalogue} />
      )}
    </main>
  );
}
