import { Suspense } from "react";
import { PagosList } from "./pagos-list";

export default function PagosPage() {
  return (
    <Suspense fallback={null}>
      <PagosList />
    </Suspense>
  );
}
