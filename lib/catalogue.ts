import type { Catalogue, CatalogueStyle, OrderType } from "@/types";

export async function fetchCatalogue(): Promise<Catalogue> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/catalogue`, {
    // This runs at build time and on the client; keep it fresh for the admin too.
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`catalogue fetch failed: ${res.status}`);
  }
  return (await res.json()) as Catalogue;
}

export function priceFor(
  style: CatalogueStyle,
  orderType: OrderType,
  quantity: number
): number {
  if (orderType === "b2c") {
    return style.retail_price_paise;
  }
  // B2B: pick the best bulk tier whose min_quantity <= total quantity.
  let unit = style.retail_price_paise;
  for (const t of style.price_tiers) {
    if (quantity >= t.min_quantity && t.unit_price_paise < unit) {
      unit = t.unit_price_paise;
    }
  }
  return unit * quantity;
}

export function formatMoney(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}
