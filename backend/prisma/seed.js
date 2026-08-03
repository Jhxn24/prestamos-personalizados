require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@prestamos.local';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    console.log(`Ya existe un usuario con el email ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.usuario.create({
    data: { email, password: passwordHash, rol: 'ADMINISTRADOR' },
  });

  console.log(`Administrador creado: ${email} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
