Documento de Requerimientos

Sistema Inteligente de Gestión de Préstamos

Requisitos Funcionales, No Funcionales, Roles y Casos de Uso

Versión 1.0 — Julio 2026

Tabla de contenidos

1. Introducción

El presente documento describe los requerimientos funcionales, no
funcionales, roles de usuario y casos de uso del Sistema Inteligente de
Gestión de Préstamos, una aplicación web y móvil orientada a administrar
préstamos de dinero de forma flexible, permitiendo el recálculo
automático de intereses, la generación de cronogramas dinámicos, el
control de pagos y la comunicación mediante notificaciones entre el
administrador (prestamista) y sus clientes.

2. Objetivo del sistema

Desarrollar una plataforma que permita a un prestamista gestionar de
manera ordenada y automatizada el ciclo completo de sus préstamos:
registro, cálculo de intereses, generación y actualización de
cronogramas, control de pagos, notificaciones y reportes; y que a la vez
brinde a cada cliente visibilidad total sobre su propio préstamo.

3. Alcance

El sistema contempla dos aplicaciones cliente (web y móvil) conectadas a
un backend común, con dos roles principales: Administrador y Cliente. Se
contempla una primera versión (MVP) con las funciones esenciales del
negocio y una segunda fase con funciones avanzadas (firma digital,
escaneo de DNI, modo offline, refinanciamiento, notificaciones
automatizadas y reportes exportables).

4. Roles del sistema

4.1 Administrador (prestamista)

Usuario dueño o gestor del negocio de préstamos. Tiene control total
sobre clientes, préstamos, pagos, configuración de intereses y reportes.

-   Registrar y administrar clientes.

-   Registrar y configurar préstamos (capital, interés, frecuencia de
    pago).

-   Confirmar o rechazar pagos reportados por los clientes.

-   Ver reportes financieros y dashboard general del negocio.

-   Identificar clientes morosos.

-   Recalcular y refinanciar préstamos.

-   Generar recibos y comprobantes.

-   Configurar políticas de mora, interés proporcional y
    refinanciamiento.

4.2 Cliente

Usuario que recibió un préstamo. Tiene una cuenta individual desde donde
visualiza y gestiona la información relacionada únicamente a su propio
préstamo.

-   Ver su préstamo, saldo pendiente e intereses.

-   Ver su cronograma de pagos actualizado.

-   Registrar pagos y adjuntar comprobantes.

-   Ver historial de pagos realizados.

-   Recibir notificaciones sobre vencimientos y estado de pagos.

5. Requisitos funcionales (RF)

A continuación se listan los requisitos funcionales agrupados por
módulo. Cada requisito tiene un identificador único, una descripción y
el rol al que aplica.

5.1 Módulo de gestión de clientes

  --------- ------------------------------------------------- ---------------
  ID        Descripción                                       Rol

  RF-01     El sistema debe permitir al administrador         Administrador
            registrar nuevos clientes con sus datos           
            personales.                                       

  RF-02     El sistema debe permitir al administrador editar  Administrador
            o desactivar clientes existentes.                 

  RF-03     El sistema debe permitir adjuntar documentos al   Administrador
            perfil del cliente (DNI, fotos, contrato,         
            pagaré).                                          

  RF-04     El sistema debe generar automáticamente una       Sistema
            cuenta de acceso para cada cliente registrado.    
  --------- ------------------------------------------------- ---------------

5.2 Módulo de préstamos

  --------- ------------------------------------------------- ---------------
  ID        Descripción                                       Rol

  RF-05     El sistema debe permitir registrar un préstamo    Administrador
            indicando cliente, capital, fecha de desembolso,  
            porcentaje de interés, tipo de interés (diario,   
            mensual, anual) y número de cuotas.               

  RF-06     El sistema debe permitir configurar la frecuencia Administrador
            de pago del préstamo (diaria, semanal, quincenal, 
            mensual, bimestral, trimestral o personalizada).  

  RF-07     El sistema debe soportar tres modalidades de      Sistema
            préstamo: interés fijo (sobre capital inicial),   
            interés sobre saldo y cuotas fijas.               

  RF-08     El sistema debe permitir refinanciar un préstamo  Administrador
            existente, generando un nuevo cronograma en base  
            al saldo pendiente.                               

  RF-09     El sistema debe permitir recalcular manualmente   Administrador
            un préstamo ante ajustes solicitados por el       
            administrador.                                    
  --------- ------------------------------------------------- ---------------

5.3 Motor de cálculo de intereses

  --------- ------------------------------------------------- ---------------
  ID        Descripción                                       Rol

  RF-10     El sistema debe mantener en todo momento el       Sistema
            capital inicial, capital pendiente, interés       
            acumulado, fecha de inicio, fecha del último pago 
            e historial de pagos de cada préstamo.            

  RF-11     El sistema debe recalcular automáticamente el     Sistema
            préstamo cada vez que se registre un pago         
            confirmado.                                       

  RF-12     El sistema debe soportar pagos que cubren solo    Sistema
            intereses, dejando el capital intacto.            

  RF-13     El sistema debe soportar pagos que cubren         Sistema
            intereses y una parte del capital, reduciendo el  
            interés del periodo siguiente si el préstamo es   
            de tipo saldo.                                    

  RF-14     Ante un pago anticipado, el sistema debe permitir Administrador
            al administrador elegir entre cobrar el interés   
            completo del periodo o el interés proporcional a  
            los días transcurridos.                           

  RF-15     El sistema debe soportar pagos parciales,         Sistema
            actualizando el saldo pendiente y el cronograma   
            restante.                                         

  RF-16     Ante la falta de pago de una cuota (especialmente Administrador
            en préstamos diarios), el sistema debe permitir   
            aplicar, según configuración: extensión de un     
            día, cobro doble al día siguiente, o aplicación   
            de mora.                                          

  RF-17     Ante un abono extraordinario, el sistema debe     Administrador
            preguntar al administrador si desea reducir el    
            plazo del préstamo o reducir el monto de las      
            cuotas restantes.                                 
  --------- ------------------------------------------------- ---------------

5.4 Cronograma dinámico

  --------- ------------------------------------------------- -----------
  ID        Descripción                                       Rol

  RF-18     El sistema debe generar un cronograma de pagos al Sistema
            momento de registrar el préstamo.                 

  RF-19     El sistema debe actualizar automáticamente el     Sistema
            cronograma ante pagos parciales, anticipados,     
            atrasados, pagos totales o refinanciamientos.     

  RF-20     El cliente y el administrador deben poder         Ambos
            visualizar en todo momento la versión vigente del 
            cronograma.                                       
  --------- ------------------------------------------------- -----------

5.5 Módulo de pagos

  --------- ------------------------------------------------- ---------------
  ID        Descripción                                       Rol

  RF-21     El cliente debe poder marcar un pago como "ya     Cliente
            pagué" adjuntando un comprobante.                 

  RF-22     El pago reportado por el cliente debe quedar en   Sistema
            estado "pendiente de confirmación" hasta que el   
            administrador lo revise.                          

  RF-23     El administrador debe poder confirmar o rechazar  Administrador
            un pago reportado por el cliente.                 

  RF-24     El sistema debe generar un recibo automático al   Sistema
            confirmar un pago.                                

  RF-25     El administrador debe poder registrar pagos       Administrador
            directamente (pagos presenciales o en efectivo).  
  --------- ------------------------------------------------- ---------------

5.6 Notificaciones

  --------- ------------------------------------------------- -----------
  ID        Descripción                                       Rol

  RF-26     El sistema debe notificar al cliente cuando falte Sistema
            una semana, un día y el mismo día del vencimiento 
            de una cuota.                                     

  RF-27     El sistema debe notificar al cliente cuando su    Sistema
            pago haya sido recibido, confirmado o rechazado.  

  RF-28     El sistema debe notificar al administrador sobre  Sistema
            los cobros del día, cobros de la semana, clientes 
            morosos y pagos pendientes de confirmar.          
  --------- ------------------------------------------------- -----------

5.7 Dashboards y reportes

  --------- ------------------------------------------------- ---------------
  ID        Descripción                                       Rol

  RF-29     El sistema debe mostrar al administrador un       Administrador
            dashboard con: total prestado, total recuperado,  
            intereses ganados, capital pendiente, clientes    
            activos, clientes morosos, préstamos vencidos,    
            próximos cobros y flujo de caja.                  

  RF-30     El sistema debe mostrar al cliente un dashboard   Cliente
            con: capital pendiente, interés pendiente,        
            próxima fecha de pago, historial, estado del      
            préstamo y cronograma.                            

  RF-31     El sistema debe generar reportes de ganancias     Administrador
            mensuales/anuales, capital prestado y recuperado, 
            clientes morosos y puntuales, historial de        
            préstamos y flujo de caja.                        

  RF-32     El sistema debe permitir exportar los reportes en Administrador
            formato Excel y PDF.                              
  --------- ------------------------------------------------- ---------------

5.8 Documentos y funciones adicionales (Fase 2)

  --------- ------------------------------------------------- ---------------
  ID        Descripción                                       Rol

  RF-33     El sistema debe permitir adjuntar a cada          Administrador
            préstamo: contrato, fotos, DNI, pagaré y          
            comprobantes.                                     

  RF-34     El sistema debe soportar firma digital de         Ambos
            documentos.                                       

  RF-35     El sistema debe permitir el escaneo de DNI para   Administrador
            autocompletar datos del cliente.                  

  RF-36     El sistema debe mantener una bitácora de cambios  Sistema
            (auditoría) de las acciones relevantes.           

  RF-37     El sistema debe soportar un modo sin conexión en  Sistema
            la aplicación móvil, sincronizando al recuperar   
            conexión.                                         
  --------- ------------------------------------------------- ---------------

6. Requisitos no funcionales (RNF)

  -------- ---------------- ------------------------------------------------
  ID       Categoría        Descripción

  RNF-01   Rendimiento      El sistema debe responder a operaciones de
                            consulta (dashboard, cronograma) en menos de 2
                            segundos bajo condiciones normales de uso.

  RNF-02   Disponibilidad   El sistema debe estar disponible al menos el 99%
                            del tiempo mensual (excluyendo mantenimientos
                            programados).

  RNF-03   Seguridad        El acceso al sistema debe requerir
                            autenticación, y las contraseñas deben
                            almacenarse cifradas (hash).

  RNF-04   Seguridad        Los datos financieros y personales deben
                            transmitirse mediante conexión cifrada
                            (HTTPS/TLS).

  RNF-05   Seguridad        El sistema debe implementar control de acceso
                            por rol (administrador / cliente), impidiendo
                            que un cliente acceda a información de otro.

  RNF-06   Escalabilidad    La arquitectura debe soportar el crecimiento en
                            número de clientes y préstamos sin degradar el
                            rendimiento (diseño multi-tenant recomendado).

  RNF-07   Usabilidad       La interfaz debe ser simple e intuitiva,
                            priorizando el uso desde dispositivos móviles.

  RNF-08   Compatibilidad   La aplicación móvil debe funcionar en Android
                            (mínimo Android 8+) y ser distribuible mediante
                            Google Play Store o APK directo.

  RNF-09   Mantenibilidad   El código debe estar modularizado, especialmente
                            el motor de cálculo de intereses, para facilitar
                            pruebas y cambios futuros.

  RNF-10   Confiabilidad    Los cálculos de interés y saldo deben ser
                            exactos y verificables mediante pruebas
                            automatizadas, dado que un error afecta
                            directamente el dinero del negocio.

  RNF-11   Respaldo de      El sistema debe realizar copias de seguridad
           datos            automáticas periódicas de la base de datos.

  RNF-12   Auditoría        Todo cambio relevante (edición de préstamo,
                            confirmación de pago, recalculo) debe quedar
                            registrado con usuario, fecha y hora.
  -------- ---------------- ------------------------------------------------

7. Casos de uso principales

Caso de uso 1: Registrar préstamo

Actor: Administrador. El administrador ingresa los datos del cliente,
capital, tasa de interés, tipo de interés y frecuencia de pago. El
sistema genera automáticamente el cronograma inicial.

Caso de uso 2: Registrar y confirmar un pago

Actores: Cliente, Administrador. El cliente marca un pago como realizado
y adjunta comprobante. El sistema notifica al administrador. El
administrador confirma o rechaza el pago; el sistema recalcula el
préstamo y notifica al cliente el resultado.

Caso de uso 3: Pago anticipado

Actor: Administrador. Ante un pago realizado antes de la fecha de
vencimiento, el sistema solicita al administrador definir si se cobra el
interés completo del periodo o el proporcional a los días transcurridos.

Caso de uso 4: Abono extraordinario

Actor: Administrador. Ante un abono superior a la cuota programada, el
sistema solicita si se desea reducir el plazo del préstamo o el monto de
las cuotas restantes, y recalcula el cronograma en consecuencia.

Caso de uso 5: Refinanciar préstamo

Actor: Administrador. El administrador solicita refinanciar un préstamo
con saldo pendiente; el sistema genera un nuevo cronograma en base a las
nuevas condiciones definidas.

8. Tipos de préstamo soportados

  --------------- -------------------------------------------------------
  Tipo            Descripción

  Interés fijo    El interés se calcula siempre sobre el capital inicial
                  del préstamo, sin importar los abonos a capital
                  realizados.

  Interés sobre   El interés se recalcula sobre el capital pendiente;
  saldo           cada abono a capital reduce el interés del periodo
                  siguiente.

  Cuotas fijas    El sistema calcula cuotas de monto igual durante toda
                  la duración del préstamo (amortización tipo francés).
  --------------- -------------------------------------------------------

9. Priorización sugerida (MVP vs. Fase 2)

9.1 MVP (primera entrega)

-   Autenticación de administrador y cliente.

-   Registro de clientes y préstamos.

-   Motor de cálculo: interés fijo y sobre saldo.

-   Cronograma dinámico básico.

-   Registro y confirmación de pagos.

-   Dashboard básico para ambos roles.

9.2 Fase 2 (mejoras posteriores)

-   Refinanciamiento completo y cuotas fijas (amortización francesa).

-   Notificaciones automáticas (push/email).

-   Reportes exportables en Excel y PDF.

-   Firma digital y escaneo de DNI.

-   Modo sin conexión en la app móvil.

-   Bitácora de cambios y roles/permisos avanzados.

10. Glosario

  ------------------ -----------------------------------------------------
  Término            Definición

  Capital            Monto de dinero originalmente prestado al cliente.

  Cronograma         Calendario de pagos esperados de un préstamo, con
                     montos e intereses por periodo.

  Mora               Recargo aplicado por incumplimiento en la fecha de
                     pago.

  Refinanciamiento   Proceso de generar nuevas condiciones de pago sobre
                     un saldo pendiente.

  MVP                Producto mínimo viable: primera versión funcional con
                     lo esencial del negocio.
  ------------------ -----------------------------------------------------
