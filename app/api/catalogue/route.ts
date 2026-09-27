import { NextResponse } from "next/server";
import type { Catalogue } from "@/types";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await supabaseAdmin.rpc("tsh_get_catalogue");
  if (error) {
    console.error("tsh_get_catalogue failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const catalogue = (data ?? { styles: [] }) as Catalogue;
  return NextResponse.json(catalogue);
}
