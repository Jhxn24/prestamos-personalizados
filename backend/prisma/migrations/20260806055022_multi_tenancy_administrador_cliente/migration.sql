-- Multi-tenancy: cada Cliente pasa a pertenecer a un administrador.
-- Los datos existentes se asignan al primer ADMINISTRADOR (por createdAt),
-- que hoy es el único que existe en producción.

-- 1) Columna nullable primero, para poder rellenarla antes de exigir NOT NULL.
ALTER TABLE "Cliente" ADD COLUMN "administradorId" TEXT;

-- 2) Backfill: todo lo existente queda a nombre del admin más antiguo.
UPDATE "Cliente"
SET "administradorId" = (
  SELECT "id" FROM "Usuario" WHERE "rol" = 'ADMINISTRADOR' ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "administradorId" IS NULL;

-- 3) A partir de aquí es obligatorio.
ALTER TABLE "Cliente" ALTER COLUMN "administradorId" SET NOT NULL;

-- 4) FK hacia Usuario.
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_administradorId_fkey"
  FOREIGN KEY ("administradorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5) El documento deja de ser único globalmente y pasa a serlo por cartera.
DROP INDEX "Cliente_documento_key";
CREATE UNIQUE INDEX "Cliente_documento_administradorId_key" ON "Cliente"("documento", "administradorId");

-- 6) Índice para los listados scoped por admin.
CREATE INDEX "Cliente_administradorId_idx" ON "Cliente"("administradorId");
