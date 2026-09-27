import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";

  let query = supabaseAdmin
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

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("orders fetch failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: data ?? [], count: count ?? 0 });
}
