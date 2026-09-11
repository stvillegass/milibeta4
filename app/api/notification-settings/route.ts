import { NextResponse } from "next/server";

let adminNotificationSettings = {
  webhookUrl: "",
  whatsappNumber: "+584120574955",
  soundEnabled: true,
  pushEnabled: true,
};

export async function GET() {
  return NextResponse.json(adminNotificationSettings);
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body) {
    adminNotificationSettings = { ...adminNotificationSettings, ...body };
  }
  return NextResponse.json({ success: true, settings: adminNotificationSettings });
}