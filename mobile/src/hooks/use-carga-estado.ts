import { useCallback, useState } from 'react';

/**
 * Estado de carga común a todas las pantallas: distingue la carga inicial
 * (bloquea la pantalla) del pull-to-refresh (no la bloquea), para no repetir
 * el mismo par de flags en cada screen.
 */
export function useCargaEstado() {
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const ejecutar = useCallback(async (esRefresco: boolean, tarea: () => Promise<void>) => {
    if (esRefresco) {
      setRefrescando(true);
    } else {
      setCargando(true);
    }
    try {
      await tarea();
    } finally {
      if (esRefresco) {
        setRefrescando(false);
      } else {
        setCargando(false);
      }
    }
  }, []);

  return { cargando, refrescando, ejecutar };
}
