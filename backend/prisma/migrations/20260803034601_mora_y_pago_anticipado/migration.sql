-- CreateEnum
CREATE TYPE "PoliticaMora" AS ENUM ('NINGUNA', 'EXTENSION_DIA', 'COBRO_DOBLE', 'MORA');

-- CreateEnum
CREATE TYPE "PoliticaInteresAnticipado" AS ENUM ('COMPLETO', 'PROPORCIONAL');

-- AlterTable
ALTER TABLE "Cuota" ADD COLUMN     "diasAtraso" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "extensionAplicada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mora" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "moraCalculadaEn" TIMESTAMP(3),
ADD COLUMN     "moraPagada" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "interesCondonado" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "moraAplicada" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "politicaInteresAnticipado" "PoliticaInteresAnticipado" NOT NULL DEFAULT 'COMPLETO';

-- AlterTable
ALTER TABLE "Prestamo" ADD COLUMN     "diasGracia" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "moraAcumulada" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "politicaMora" "PoliticaMora" NOT NULL DEFAULT 'NINGUNA',
ADD COLUMN     "tasaMora" DECIMAL(9,6) NOT NULL DEFAULT 0;
