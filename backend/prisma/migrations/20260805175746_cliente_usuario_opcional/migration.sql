-- AlterEnum
ALTER TYPE "AccionAuditoria" ADD VALUE 'ANULAR';

-- AlterEnum
ALTER TYPE "EstadoPago" ADD VALUE 'ANULADO';

-- AlterEnum
ALTER TYPE "ModalidadPrestamo" ADD VALUE 'CAPITAL_AL_FINAL';

-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'PAGO_ANULADO';

-- DropForeignKey
ALTER TABLE "Cliente" DROP CONSTRAINT "Cliente_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Cliente" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "anuladoPorId" TEXT,
ADD COLUMN     "fechaAnulacion" TIMESTAMP(3),
ADD COLUMN     "motivoAnulacion" TEXT;

-- CreateTable
CREATE TABLE "PagoSnapshot" (
    "id" TEXT NOT NULL,
    "pagoId" TEXT NOT NULL,
    "datos" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PagoSnapshot_pagoId_key" ON "PagoSnapshot"("pagoId");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_anuladoPorId_fkey" FOREIGN KEY ("anuladoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoSnapshot" ADD CONSTRAINT "PagoSnapshot_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
