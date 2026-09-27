import { NextResponse } from "next/server";
import type { PlaceOrderInput, PlaceOrderResult } from "@/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// All validation/pricing happens in the database via tsh_place_order().
// The client sends the design placement verbatim; the server does not trust
// any price — prices are recomputed server-side from the catalogue.
export async function POST(request: Request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  let payload: PlaceOrderInput;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rpcPayload = {
    order_type: payload.order_type,
    style_id: payload.style_id,
    colour_id: payload.colour_id,
    customer_name: payload.customer_name,
    customer_email: payload.customer_email,
    customer_phone: payload.customer_phone,
    company_name: payload.company_name ?? null,
    design_text: payload.design_text ?? null,
    design_colour: payload.design_colour ?? null,
    design_font: payload.design_font ?? null,
    design_logo_path: payload.design_logo_path ?? null,
    design_x: payload.design_x,
    design_y: payload.design_y,
    design_scale: payload.design_scale,
    items: payload.items.map((i) => ({
      size_id: i.size_id,
      quantity: i.quantity,
    })),
  };

  const { data, error } = await (supabaseAdmin as any).rpc("tsh_place_order", {
    payload: rpcPayload as unknown as any,
  });

  if (error) {
    const msg =
      error?.message?.includes("(") && error.message.includes(")")
        ? error.message.replace(/\([^()]*\)/g, "").trim()
        : error.message;
    return NextResponse.json({ error: msg || "order could not be placed" }, { status: 400 });
  }

  const row = (data as unknown as any[] | null)?.[0] ?? null;
  const result: PlaceOrderResult = row
    ? {
        order_id: row.order_id,
        order_code: row.order_code,
        total_quantity: row.total_quantity,
        total_paise: row.total_paise,
      }
    : {
        order_id: "",
        order_code: "",
        total_quantity: 0,
        total_paise: 0,
      };

  return NextResponse.json(result);
}
