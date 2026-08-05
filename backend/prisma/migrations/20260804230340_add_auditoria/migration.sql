-- CreateEnum
CREATE TYPE "EntidadAuditoria" AS ENUM ('CLIENTE', 'PRESTAMO', 'PAGO');

-- CreateEnum
CREATE TYPE "AccionAuditoria" AS ENUM ('CREAR', 'ACTUALIZAR', 'DESACTIVAR', 'RECALCULAR', 'REFINANCIAR', 'CONFIRMAR', 'RECHAZAR');

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entidad" "EntidadAuditoria" NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" "AccionAuditoria" NOT NULL,
    "detalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidad_entidadId_idx" ON "RegistroAuditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_usuarioId_idx" ON "RegistroAuditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_createdAt_idx" ON "RegistroAuditoria"("createdAt");

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
