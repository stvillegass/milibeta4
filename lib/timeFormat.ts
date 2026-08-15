// Convierte una hora en formato 24h ("09:00", "17:30") a formato 12h tradicional ("9:00 AM", "5:30 PM").
export function formatTime12h(time: string | null | undefined): string {
  if (!time) return "";
  const [hoursStr, minutesStr] = time.split(":");
  let hours = parseInt(hoursStr, 10);
  if (isNaN(hours)) return time;
  const minutes = minutesStr || "00";
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${suffix}`;
}