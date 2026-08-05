import { NextResponse } from "next/server";
import { haalSocialMediaAdmin } from "@/lib/socialMedia/admin";
import { haalSocialPostVisual } from "@/lib/socialMedia/repository";
import { renderSocialVisualSvg } from "@/lib/socialMedia/visual";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await haalSocialMediaAdmin())) return new NextResponse("Niet gevonden", { status: 404 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Ongeldig id", { status: 400 });
  const visual = await haalSocialPostVisual(id);
  if (!visual) return new NextResponse("Niet gevonden", { status: 404 });
  return new NextResponse(renderSocialVisualSvg(visual), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
