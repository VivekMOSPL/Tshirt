import { NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Accepts multipart/form-data with a file field named "file".
// Uploads to the tsh-logos bucket (not browser-visible key). Returns
// { path, public_url } so the caller can save the path on the order.
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "no file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const ext = (file.type.split("/")[1] || "png").toLowerCase();
  const path = `uploads/${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(path, Buffer.from(arrayBuffer), {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (error) {
    console.error("logo upload failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: pub } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({ path, public_url: pub.publicUrl });
}
