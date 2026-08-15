import { NextResponse } from "next/server";

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

export async function GET() {
  return NextResponse.json({
    notifications: adminNotifications,
    unreadCount: adminNotifications.filter((n) => !n.read).length,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body) {
    const newNotif = {
      id: `notif_${Date.now()}`,
      title: body.title || "¡Nueva Cita Agendada! 💅",
      message: body.message || "",
      bookingId: body.bookingId || "",
      clientName: body.clientName || "",
      clientPhone: body.clientPhone || "",
      serviceName: body.serviceName || "",
      date: body.date || "",
      time: body.time || "",
      read: false,
      createdAt: new Date().toISOString(),
    };
    adminNotifications.unshift(newNotif);
    return NextResponse.json({ success: true, notification: newNotif });
  }
  return NextResponse.json({ success: false }, { status: 400 });
}