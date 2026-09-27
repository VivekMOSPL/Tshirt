import { CatalogueStyle, OrderType } from "@/types";

export function computeTotal(
  style: CatalogueStyle,
  orderType: OrderType,
  lines: { quantity: number }[]
): number {
  if (orderType === "b2c") {
    return style.retail_price_paise;
  }
  const qty = Math.max(1, lines.reduce((sum, l) => sum + l.quantity, 0));
  let unit = style.retail_price_paise;
  for (const t of style.price_tiers) {
    if (qty >= t.min_quantity && t.unit_price_paise < unit) {
      unit = t.unit_price_paise;
    }
  }
  return unit * qty;
}
