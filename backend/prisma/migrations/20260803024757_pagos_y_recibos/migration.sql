-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE_CONFIRMACION', 'CONFIRMADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'YAPE_PLIN', 'OTRO');

-- AlterTable
ALTER TABLE "Cuota" ADD COLUMN     "capitalPagado" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "interesPagado" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "cuotaId" TEXT,
    "monto" DECIMAL(14,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL DEFAULT 'EFECTIVO',
    "capitalAplicado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "interesAplicado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "excedente" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE_CONFIRMACION',
    "comprobanteUrl" TEXT,
    "observaciones" TEXT,
    "motivoRechazo" TEXT,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaConfirmacion" TIMESTAMP(3),
    "registradoPorId" TEXT NOT NULL,
    "confirmadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "pagoId" TEXT NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pago_prestamoId_idx" ON "Pago"("prestamoId");

-- CreateIndex
CREATE INDEX "Pago_estado_idx" ON "Pago"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_numero_key" ON "Recibo"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Recibo_pagoId_key" ON "Recibo"("pagoId");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
