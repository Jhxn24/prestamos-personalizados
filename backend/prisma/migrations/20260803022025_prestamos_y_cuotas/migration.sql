-- CreateEnum
CREATE TYPE "ModalidadPrestamo" AS ENUM ('INTERES_FIJO', 'INTERES_SOBRE_SALDO', 'CUOTAS_FIJAS');

-- CreateEnum
CREATE TYPE "TipoInteres" AS ENUM ('DIARIO', 'MENSUAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "FrecuenciaPago" AS ENUM ('DIARIA', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL', 'TRIMESTRAL', 'PERSONALIZADA');

-- CreateEnum
CREATE TYPE "EstadoPrestamo" AS ENUM ('ACTIVO', 'PAGADO', 'REFINANCIADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADA', 'VENCIDA');

-- CreateTable
CREATE TABLE "Prestamo" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "capital" DECIMAL(14,2) NOT NULL,
    "tasaInteres" DECIMAL(9,6) NOT NULL,
    "tipoInteres" "TipoInteres" NOT NULL,
    "frecuenciaPago" "FrecuenciaPago" NOT NULL,
    "diasPersonalizados" INTEGER,
    "numeroCuotas" INTEGER NOT NULL,
    "modalidad" "ModalidadPrestamo" NOT NULL,
    "fechaDesembolso" TIMESTAMP(3) NOT NULL,
    "capitalPendiente" DECIMAL(14,2) NOT NULL,
    "interesAcumulado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoPrestamo" NOT NULL DEFAULT 'ACTIVO',
    "prestamoOrigenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prestamo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "prestamoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "capital" DECIMAL(14,2) NOT NULL,
    "interes" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "saldoCapital" DECIMAL(14,2) NOT NULL,
    "montoPagado" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoCuota" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prestamo_clienteId_idx" ON "Prestamo"("clienteId");

-- CreateIndex
CREATE INDEX "Cuota_prestamoId_idx" ON "Cuota"("prestamoId");

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_prestamoId_numero_key" ON "Cuota"("prestamoId", "numero");

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prestamo" ADD CONSTRAINT "Prestamo_prestamoOrigenId_fkey" FOREIGN KEY ("prestamoOrigenId") REFERENCES "Prestamo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_prestamoId_fkey" FOREIGN KEY ("prestamoId") REFERENCES "Prestamo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
