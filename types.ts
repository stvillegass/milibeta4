export interface ServiceOption {
  id: string;
  name: string;
  price: number;
  duration?: string;
  description?: string;
  includes?: string[];
}

export interface Service {
  id: string;
  category: "nails" | "lashes";
  name: string;
  description: string;
  imageUrl: string;
  options: ServiceOption[];
  order: number;
}

export interface Appointment {
  id?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  serviceId: string;
  optionId: string;
  date: string; // ISO string for the day
  time: string; // "10:00"
}