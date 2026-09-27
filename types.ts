export type ShirtSize = "S" | "M" | "L" | "XL" | "XXL";
export type OrderType = "b2c" | "b2b";

export interface CatalogueColor {
  id: string;
  name: string;
  hex: string;
}
export interface CatalogueSize {
  id: string;
  code: string;
  label: string;
}
export interface CatalogueTier {
  min_quantity: number;
  unit_price_paise: number;
}
export interface CatalogueStyle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  print_area_width_px: number;
  print_area_height_px: number;
  retail_price_paise: number;
  colours: CatalogueColor[];
  sizes: CatalogueSize[];
  price_tiers: CatalogueTier[];
}
export interface Catalogue {
  styles: CatalogueStyle[];
}

export interface Design {
  text: string;
  colour: string;
  font: string;
  logo_path: string | null;
  x: number;
  y: number;
  scale: number;
}

export interface OrderLineInput {
  size_id: string;
  quantity: number;
}
export interface PlaceOrderInput {
  order_type: OrderType;
  style_id: string;
  colour_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  company_name?: string | null;
  design_text: string | null;
  design_colour: string;
  design_font: string;
  design_logo_path: string | null;
  design_x: number;
  design_y: number;
  design_scale: number;
  items: OrderLineInput[];
}
export interface PlaceOrderResult {
  order_id: string;
  order_code: string;
  total_quantity: number;
  total_paise: number;
}

export const FONT_OPTIONS = ["Inter", "Arial", "Helvetica", "Courier New"] as const;
export const DESIGN_COLOURS = ["#000000", "#FFFFFF", "#DC2626", "#2563EB", "#15803D", "#992599"];
export const SHIRT_BASE_PAIRS = 49900; // Classic Cotton Tee retail, paise — for live price calc on the client
