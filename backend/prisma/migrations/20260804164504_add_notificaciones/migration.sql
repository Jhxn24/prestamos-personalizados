-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CUOTA_POR_VENCER_SEMANA', 'CUOTA_POR_VENCER_DIA', 'CUOTA_VENCE_HOY', 'PAGO_REPORTADO', 'PAGO_CONFIRMADO', 'PAGO_RECHAZADO', 'RESUMEN_DIARIO_ADMIN');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "leida" BOOLEAN NOT NULL DEFAULT false,
    "prestamoId" TEXT,
    "cuotaId" TEXT,
    "pagoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_leida_idx" ON "Notificacion"("usuarioId", "leida");

-- CreateIndex
CREATE INDEX "Notificacion_tipo_createdAt_idx" ON "Notificacion"("tipo", "createdAt");

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
