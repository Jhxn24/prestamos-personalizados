import { Suspense } from "react";
import { NuevoPrestamoForm } from "./nuevo-prestamo-form";

export default function NuevoPrestamoPage() {
  return (
    <Suspense fallback={null}>
      <NuevoPrestamoForm />
    </Suspense>
  );
}
