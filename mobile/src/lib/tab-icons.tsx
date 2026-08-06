import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

type NombreIcono = keyof typeof Ionicons.glyphMap;

/**
 * Ícono de pestaña con el patrón outline/relleno de Ionicons según esté
 * activa o no (ej. "people-outline" cuando no, "people" cuando sí).
 * `nombreBase` es el nombre SIN el sufijo "-outline".
 */
export function tabBarIcon(nombreBase: string) {
  function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    const nombre = (focused ? nombreBase : `${nombreBase}-outline`) as NombreIcono;
    return <Ionicons name={nombre} size={size} color={color} />;
  }
  return TabIcon;
}
