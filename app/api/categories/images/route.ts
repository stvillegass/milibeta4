import { NextResponse } from "next/server";

let categoryImages = {
  nails: "https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1000&auto=format&fit=crop",
  lashes: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1000&auto=format&fit=crop",
};

export async function GET() {
  return NextResponse.json(categoryImages);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body) {
    if (body.nails) categoryImages.nails = body.nails;
    if (body.lashes) categoryImages.lashes = body.lashes;
  }
  return NextResponse.json(categoryImages);
}