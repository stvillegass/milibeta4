"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReservationModal from "@/components/ReservationModal";

function ReserveContent() {
  const searchParams = useSearchParams();
  const serviceId = searchParams.get("service");
  const optionId = searchParams.get("option");

  return <ReservationModal isOpen={true} initialServiceId={serviceId} initialOptionId={optionId} />;
}

export default function ReservePage() {
  return (
    <Suspense fallback={<div className="pt-24 text-center">Cargando...</div>}>
      <ReserveContent />
    </Suspense>
  );
}