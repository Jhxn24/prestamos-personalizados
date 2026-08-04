import { PrestamoDetalle } from "./prestamo-detalle";

export default async function PrestamoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PrestamoDetalle id={id} />;
}
