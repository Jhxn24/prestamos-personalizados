-- DropForeignKey
ALTER TABLE "RegistroAuditoria" DROP CONSTRAINT "RegistroAuditoria_usuarioId_fkey";

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
