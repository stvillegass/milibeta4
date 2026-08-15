import { NextResponse } from "next/server";

let siteConfig = {
  studioName: "Milibeauty",
  studioSubtitle: "Estudio de lujo especializado en el cuidado y diseño de tus manos y mirada.",
  nailsTag: "Especialidad",
  nailsTitle: "Manicure",
  nailsDescription: "Manicura, pedicura y cuidado de uñas",
  lashesTag: "Especialidad",
  lashesTitle: "Cejas y Pestañas",
  lashesDescription: "Lifting, diseño y realce de mirada",
  badge1: "Productos Premium",
  badge2: "Citas Flexibles",
  badge3: "Higiene Estricta",
  studioAddress: "Av. Principal Las Mercedes, Edificio Centro Empresarial, Piso 3, Local 302",
  mapsUrl: "https://www.google.com/maps/search/?api=1&query=Milibeauty+Studio",
};

export async function GET() {
  return NextResponse.json(siteConfig);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body) {
    siteConfig = { ...siteConfig, ...body };
  }
  return NextResponse.json(siteConfig);
}