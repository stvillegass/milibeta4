import { NextResponse } from "next/server";

// Shared in-memory store (module-level)
let adminNotifications: Array<{
  id: string;
  title: string;
  message: string;
  bookingId: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  date: string;
  time: string;
  read: boolean;
  createdAt: string;
}> = [];

export async function POST(request: Request) {
  const { id } = await request.json();
  if (id) {
    const notif = adminNotifications.find((n) => n.id === id);
    if (notif) notif.read = true;
  } else {
    adminNotifications.forEach((n) => (n.read = true));
  }
  return NextResponse.json({ success: true });
}