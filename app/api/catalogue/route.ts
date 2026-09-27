import { NextResponse } from "next/server";
import type { Catalogue } from "@/types";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
  const { data, error } = await supabaseAdmin.rpc("tsh_get_catalogue");
  if (error) {
    console.error("tsh_get_catalogue failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const catalogue = (data ?? { styles: [] }) as Catalogue;
  return NextResponse.json(catalogue);
}
