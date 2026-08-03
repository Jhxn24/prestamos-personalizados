-- CreateEnum
CREATE TYPE "PoliticaAbonoExtraordinario" AS ENUM ('REDUCIR_CUOTA', 'REDUCIR_PLAZO');

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "cuotasEliminadas" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "politicaAbonoExtraordinario" "PoliticaAbonoExtraordinario" NOT NULL DEFAULT 'REDUCIR_CUOTA';
