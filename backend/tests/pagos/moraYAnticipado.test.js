require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const Decimal = require('decimal.js');

const prisma = require('../../src/config/prisma');
const pagosService = require('../../src/modules/pagos/pagos.service');
const prestamosService = require('../../src/modules/prestamos/prestamos.service');
const { refrescarMora } = require('../../src/modules/mora/mora.service');

/**
 * RF-14 (pago anticipado) y RF-16 (mora) contra la base de datos real.
 *
 * Todas las fechas son fijas y explícitas: el atraso depende del calendario, así
 * que usar "hoy" haría que estas pruebas cambiaran de significado cada día.
 *
 * Escenario base: préstamo desembolsado el 10-mar-2026, cuotas mensuales.
 * Cuota 1 vence el 10-abr-2026 (periodo de 31 días).
 */

const SUFIJO = `test-mora-${Date.now()}`;
const DESEMBOLSO = '2026-03-10';
const VENCE_CUOTA_1 = '2026-04-10';

let admin;
let usuarioCliente;
let cliente;

const dec = (valor) => new Decimal(valor.toString());
const fecha = (iso) => new Date(`${iso}T00:00:00.000Z`);

test.before(async () => {
  admin = await prisma.usuario.create({
    data: { email: `admin-${SUFIJO}@test.local`, password: 'x', rol: 'ADMINISTRADOR' },
  });
  cliente = await prisma.cliente.create({
    data: {
      nombre: 'Test',
      apellido: 'Mora',
      documento: SUFIJO,
      usuario: { create: { email: `cliente-${SUFIJO}@test.local`, password: 'x', rol: 'CLIENTE' } },
    },
    include: { usuario: true },
  });
  usuarioCliente = cliente.usuario;
});

test.after(async () => {
  // Los pagos disparan notificaciones (RF-27/RF-28) que llegan también a
  // TODOS los administradores reales de esta base de datos, no solo al `admin`
  // de esta prueba — hay que limpiarlas por prestamoId o quedan ensuciando la
  // bandeja del administrador real entre corridas.
  const prestamosDeLaPrueba = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    select: { id: true },
  });
  await prisma.notificacion.deleteMany({
    where: { prestamoId: { in: prestamosDeLaPrueba.map((p) => p.id) } },
  });

  await prisma.recibo.deleteMany({ where: { pago: { prestamo: { clienteId: cliente.id } } } });
  await prisma.pago.deleteMany({ where: { prestamo: { clienteId: cliente.id } } });
  await prisma.prestamo.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
  await prisma.usuario.deleteMany({ where: { id: { in: [admin.id, usuarioCliente.id] } } });
  await prisma.$disconnect();
});

/** Préstamo de 1000 en 4 cuotas mensuales al 5%, con la política de mora dada. */
function crearPrestamo({ politicaMora = 'NINGUNA', tasaMora = 0, diasGracia = 0 } = {}) {
  return prestamosService.crearPrestamo({
    clienteId: cliente.id,
    capital: 1000,
    tasaInteres: 5,
    tipoInteres: 'MENSUAL',
    frecuenciaPago: 'MENSUAL',
    numeroCuotas: 4,
    modalidad: 'INTERES_SOBRE_SALDO',
    fechaDesembolso: DESEMBOLSO,
    politicaMora,
    tasaMora,
    diasGracia,
  });
}

const cuotasDe = (prestamoId) =>
  prisma.cuota.findMany({ where: { prestamoId }, orderBy: { numero: 'asc' } });

// ---------------------------------------------------------------- RF-16: mora

test('política MORA: la cuota vencida acumula mora sobre su capital pendiente', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1 });

  // 5 días después del vencimiento de la cuota 1
  await refrescarMora(prestamo.id, fecha('2026-04-15'));

  const [cuota1] = await cuotasDe(prestamo.id);
  assert.equal(cuota1.estado, 'VENCIDA');
  assert.equal(cuota1.diasAtraso, 5);
  // 250 de capital x 1% x 5 días = 12.50 (el interés de 50 no genera mora)
  assert.equal(dec(cuota1.mora).toFixed(2), '12.50');

  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(actualizado.moraAcumulada).toFixed(2), '12.50');
});

test('refrescar la mora dos veces el mismo día NO la duplica', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1 });

  await refrescarMora(prestamo.id, fecha('2026-04-15'));
  const [primera] = await cuotasDe(prestamo.id);

  await refrescarMora(prestamo.id, fecha('2026-04-15'));
  await refrescarMora(prestamo.id, fecha('2026-04-15'));
  const [tercera] = await cuotasDe(prestamo.id);

  assert.equal(dec(tercera.mora).toFixed(2), dec(primera.mora).toFixed(2));
});

test('la mora crece con los días y arrastra las cuotas que van venciendo', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1 });

  await refrescarMora(prestamo.id, fecha('2026-04-20')); // 10 días de atraso
  const [cuota1] = await cuotasDe(prestamo.id);
  assert.equal(dec(cuota1.mora).toFixed(2), '25.00');

  // un mes después ya vencieron las cuotas 1 y 2
  await refrescarMora(prestamo.id, fecha('2026-05-20'));
  const cuotas = await cuotasDe(prestamo.id);
  assert.equal(cuotas[0].diasAtraso, 40);
  assert.equal(cuotas[1].diasAtraso, 10);
  assert.equal(cuotas[0].estado, 'VENCIDA');
  assert.equal(cuotas[1].estado, 'VENCIDA');
  assert.equal(cuotas[2].estado, 'PENDIENTE');
});

test('los días de gracia retrasan el inicio de la mora', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1, diasGracia: 5 });

  // dentro de la gracia: ni atraso ni mora
  await refrescarMora(prestamo.id, fecha('2026-04-14'));
  let [cuota1] = await cuotasDe(prestamo.id);
  assert.equal(cuota1.diasAtraso, 0);
  assert.equal(cuota1.estado, 'PENDIENTE');
  assert.equal(dec(cuota1.mora).toFixed(2), '0.00');

  // pasada la gracia, la mora cuenta solo los días excedentes
  await refrescarMora(prestamo.id, fecha('2026-04-18'));
  [cuota1] = await cuotasDe(prestamo.id);
  assert.equal(cuota1.diasAtraso, 3);
  assert.equal(dec(cuota1.mora).toFixed(2), '7.50');
});

test('política COBRO_DOBLE: marca vencida sin añadir un solo céntimo de deuda', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'COBRO_DOBLE', tasaMora: 1 });

  await refrescarMora(prestamo.id, fecha('2026-05-15'));
  const cuotas = await cuotasDe(prestamo.id);

  assert.equal(cuotas[0].estado, 'VENCIDA');
  assert.equal(cuotas[1].estado, 'VENCIDA');
  assert.equal(dec(cuotas[0].mora).toFixed(2), '0.00');
  assert.equal(dec(cuotas[1].mora).toFixed(2), '0.00');

  // Lo que se cobra el día de la cuota 2 es la suma de ambas: el "doble"
  const aCobrar = dec(cuotas[0].total).plus(dec(cuotas[1].total));
  assert.equal(aCobrar.toFixed(2), '587.50');

  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(actualizado.moraAcumulada).toFixed(2), '0.00');
});

test('política NINGUNA: marca vencida sin cobrar nada', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'NINGUNA', tasaMora: 5 });

  await refrescarMora(prestamo.id, fecha('2026-04-30'));
  const [cuota1] = await cuotasDe(prestamo.id);

  assert.equal(cuota1.estado, 'VENCIDA');
  assert.equal(cuota1.diasAtraso, 20);
  assert.equal(dec(cuota1.mora).toFixed(2), '0.00', 'la tasa configurada no debe aplicarse');
});

test('política EXTENSION_DIA: corre el vencimiento un día y solo una vez', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'EXTENSION_DIA' });

  // Un día de atraso: se extiende y la cuota deja de estar vencida
  await refrescarMora(prestamo.id, fecha('2026-04-11'));
  let [cuota1] = await cuotasDe(prestamo.id);

  assert.equal(cuota1.fechaVencimiento.toISOString().slice(0, 10), '2026-04-11');
  assert.equal(cuota1.extensionAplicada, true);
  assert.equal(cuota1.estado, 'PENDIENTE');
  assert.equal(cuota1.diasAtraso, 0);

  // Al día siguiente ya no se vuelve a extender: la deuda sí vence
  await refrescarMora(prestamo.id, fecha('2026-04-12'));
  [cuota1] = await cuotasDe(prestamo.id);

  assert.equal(cuota1.fechaVencimiento.toISOString().slice(0, 10), '2026-04-11');
  assert.equal(cuota1.estado, 'VENCIDA');
  assert.equal(cuota1.diasAtraso, 1);
});

test('el pago cubre primero la mora, luego interés y capital', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1 });

  // Paga con 5 días de atraso: mora 12.50 + interés 50 + capital 250 = 312.50
  const { pago } = await pagosService.registrarPago(
    { cuotaId: (await cuotasDe(prestamo.id))[0].id, monto: 312.5, fechaPago: '2026-04-15' },
    admin
  );

  assert.equal(dec(pago.moraAplicada).toFixed(2), '12.50');
  assert.equal(dec(pago.interesAplicado).toFixed(2), '50.00');
  assert.equal(dec(pago.capitalAplicado).toFixed(2), '250.00');

  const [cuota1] = await cuotasDe(prestamo.id);
  assert.equal(cuota1.estado, 'PAGADA');
  assert.equal(dec(cuota1.moraPagada).toFixed(2), '12.50');
});

test('pagar solo el importe de la cuota deja la mora pendiente y la cuota sin saldar', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1 });

  // Paga 300 (la cuota) pero debe 312.50 con la mora
  await pagosService.registrarPago(
    { cuotaId: (await cuotasDe(prestamo.id))[0].id, monto: 300, fechaPago: '2026-04-15' },
    admin
  );

  const [cuota1] = await cuotasDe(prestamo.id);
  assert.notEqual(cuota1.estado, 'PAGADA');
  assert.equal(dec(cuota1.moraPagada).toFixed(2), '12.50');
  // la mora se cobró primero, así que faltaron 12.50 de capital
  assert.equal(dec(cuota1.capitalPagado).toFixed(2), '237.50');
});

test('una cuota saldada deja de acumular mora aunque pase el tiempo', async () => {
  const prestamo = await crearPrestamo({ politicaMora: 'MORA', tasaMora: 1 });

  await pagosService.registrarPago(
    { cuotaId: (await cuotasDe(prestamo.id))[0].id, monto: 312.5, fechaPago: '2026-04-15' },
    admin
  );
  const [pagada] = await cuotasDe(prestamo.id);
  const moraAlPagar = dec(pagada.mora).toFixed(2);

  // dos meses después la cuota 1 no debe haber crecido
  await refrescarMora(prestamo.id, fecha('2026-06-15'));
  const [despues] = await cuotasDe(prestamo.id);

  assert.equal(despues.estado, 'PAGADA');
  assert.equal(dec(despues.mora).toFixed(2), moraAlPagar);
});

// ------------------------------------------------- RF-14: pago anticipado

test('COMPLETO: adelantar el pago no reduce el interés', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 300, fechaPago: '2026-03-25', politicaInteresAnticipado: 'COMPLETO' },
    admin
  );

  assert.equal(dec(pago.interesAplicado).toFixed(2), '50.00');
  assert.equal(dec(pago.interesCondonado).toFixed(2), '0.00');

  const [despues] = await cuotasDe(prestamo.id);
  assert.equal(despues.estado, 'PAGADA');
});

test('PROPORCIONAL: se cobra solo el interés devengado hasta la fecha del pago', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  // Periodo 10-mar a 10-abr = 31 días. Paga el 25-mar = 15 días devengados.
  // interés = 50 * 15/31 = 24.19
  const { pago } = await pagosService.registrarPago(
    {
      cuotaId: cuota1.id,
      monto: 274.19,
      fechaPago: '2026-03-25',
      politicaInteresAnticipado: 'PROPORCIONAL',
    },
    admin
  );

  assert.equal(dec(pago.interesAplicado).toFixed(2), '24.19');
  assert.equal(dec(pago.capitalAplicado).toFixed(2), '250.00');
  assert.equal(dec(pago.interesCondonado).toFixed(2), '25.81');

  const [despues] = await cuotasDe(prestamo.id);
  assert.equal(dec(despues.interes).toFixed(2), '24.19', 'la cuota debe reflejar el interés real cobrado');
  assert.equal(dec(despues.total).toFixed(2), '274.19');
  assert.equal(despues.estado, 'PAGADA');

  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(dec(actualizado.interesAcumulado).toFixed(2), '24.19');
});

test('PROPORCIONAL no da descuento si se paga el día del vencimiento o después', async () => {
  const prestamo = await crearPrestamo();

  const { pago } = await pagosService.registrarPago(
    {
      cuotaId: (await cuotasDe(prestamo.id))[0].id,
      monto: 300,
      fechaPago: VENCE_CUOTA_1,
      politicaInteresAnticipado: 'PROPORCIONAL',
    },
    admin
  );

  assert.equal(dec(pago.interesAplicado).toFixed(2), '50.00');
  assert.equal(dec(pago.interesCondonado).toFixed(2), '0.00');
});

test('RF-14: el cliente NO puede condonarse interés a sí mismo', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    {
      cuotaId: cuota1.id,
      monto: 274.19,
      fechaPago: '2026-03-25',
      politicaInteresAnticipado: 'PROPORCIONAL',
    },
    usuarioCliente
  );

  assert.equal(pago.politicaInteresAnticipado, 'COMPLETO', 'la política del cliente debe ignorarse');
});

test('el administrador decide el prorrateo al confirmar el pago reportado', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  const { pago } = await pagosService.registrarPago(
    { cuotaId: cuota1.id, monto: 274.19, fechaPago: '2026-03-25' },
    usuarioCliente
  );

  const { pago: confirmado } = await pagosService.confirmarPago(pago.id, admin.id, {
    politicaInteresAnticipado: 'PROPORCIONAL',
  });

  assert.equal(dec(confirmado.interesAplicado).toFixed(2), '24.19');
  assert.equal(dec(confirmado.interesCondonado).toFixed(2), '25.81');
});

test('no se puede prorratear una cuota que ya tiene pagos aplicados', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago({ cuotaId: cuota1.id, monto: 100, fechaPago: '2026-03-20' }, admin);

  await assert.rejects(
    () =>
      pagosService.registrarPago(
        {
          cuotaId: cuota1.id,
          monto: 100,
          fechaPago: '2026-03-25',
          politicaInteresAnticipado: 'PROPORCIONAL',
        },
        admin
      ),
    /ya tiene pagos aplicados/
  );
});

test('el interés condonado no reaparece como deuda en el cronograma futuro', async () => {
  const prestamo = await crearPrestamo();
  const [cuota1] = await cuotasDe(prestamo.id);

  await pagosService.registrarPago(
    {
      cuotaId: cuota1.id,
      monto: 274.19,
      fechaPago: '2026-03-25',
      politicaInteresAnticipado: 'PROPORCIONAL',
    },
    admin
  );

  const cuotas = await cuotasDe(prestamo.id);
  const capitalPorCobrar = cuotas.reduce((acumulado, cuota) => {
    const porCobrar = dec(cuota.capital).minus(dec(cuota.capitalPagado));
    return porCobrar.gt(0) ? acumulado.plus(porCobrar) : acumulado;
  }, new Decimal(0));

  const actualizado = await prisma.prestamo.findUnique({ where: { id: prestamo.id } });
  assert.equal(capitalPorCobrar.toFixed(2), dec(actualizado.capitalPendiente).toFixed(2));
  assert.equal(dec(actualizado.capitalPendiente).toFixed(2), '750.00');
});
