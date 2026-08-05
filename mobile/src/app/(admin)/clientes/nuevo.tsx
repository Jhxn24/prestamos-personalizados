import { useState } from 'react';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { crearCliente } from '@/lib/clientes-api';

interface Campos {
  nombre: string;
  apellido: string;
  documento: string;
  telefono: string;
  direccion: string;
  email: string;
  password: string;
}

const CAMPOS_VACIOS: Campos = {
  nombre: '',
  apellido: '',
  documento: '',
  telefono: '',
  direccion: '',
  email: '',
  password: '',
};

/**
 * RF-01: alta de cliente. El acceso a la app es opcional (RF-04): si se
 * llena uno de email/password se exige el otro; si no se llena ninguno, el
 * cliente queda sin cuenta y se le puede agregar después.
 */
export default function NuevoClienteScreen() {
  const { token } = useAuth();
  const [campos, setCampos] = useState<Campos>(CAMPOS_VACIOS);
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({});
  const [enviando, setEnviando] = useState(false);

  function actualizar<K extends keyof Campos>(campo: K, valor: Campos[K]) {
    setCampos((actual) => ({ ...actual, [campo]: valor }));
  }

  function validar(): boolean {
    const nuevosErrores: Partial<Record<keyof Campos, string>> = {};
    if (!campos.nombre.trim()) nuevosErrores.nombre = 'Obligatorio';
    if (!campos.apellido.trim()) nuevosErrores.apellido = 'Obligatorio';
    if (!campos.documento.trim()) nuevosErrores.documento = 'Obligatorio';

    const email = campos.email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nuevosErrores.email = 'Email inválido';
    }
    if (campos.password && campos.password.length < 6) {
      nuevosErrores.password = 'Mínimo 6 caracteres';
    }
    if (email && !campos.password) {
      nuevosErrores.password = 'Obligatorio si se llena el email';
    }
    if (campos.password && !email) {
      nuevosErrores.email = 'Obligatorio si se llena la contraseña';
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  }

  async function guardar() {
    if (!token || !validar()) return;
    setEnviando(true);
    try {
      const email = campos.email.trim();
      const cliente = await crearCliente(token, {
        nombre: campos.nombre.trim(),
        apellido: campos.apellido.trim(),
        documento: campos.documento.trim(),
        ...(email && campos.password ? { email, password: campos.password } : {}),
        telefono: campos.telefono.trim() || undefined,
        direccion: campos.direccion.trim() || undefined,
      });
      router.replace(`/clientes/${cliente.id}`);
    } catch (error) {
      Alert.alert('No se pudo guardar el cliente', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Screen>
      <TextField label="Nombre" value={campos.nombre} onChangeText={(v) => actualizar('nombre', v)} error={errores.nombre} />
      <TextField
        label="Apellido"
        value={campos.apellido}
        onChangeText={(v) => actualizar('apellido', v)}
        error={errores.apellido}
      />
      <TextField
        label="Documento"
        value={campos.documento}
        onChangeText={(v) => actualizar('documento', v)}
        error={errores.documento}
      />
      <TextField label="Teléfono (opcional)" value={campos.telefono} onChangeText={(v) => actualizar('telefono', v)} />
      <TextField label="Dirección (opcional)" value={campos.direccion} onChangeText={(v) => actualizar('direccion', v)} />
      <TextField
        label="Email (opcional)"
        value={campos.email}
        onChangeText={(v) => actualizar('email', v)}
        autoCapitalize="none"
        keyboardType="email-address"
        error={errores.email}
      />
      <TextField
        label="Contraseña (opcional)"
        value={campos.password}
        onChangeText={(v) => actualizar('password', v)}
        secureTextEntry
        autoCapitalize="none"
        error={errores.password}
      />
      <Button title="Guardar" onPress={guardar} loading={enviando} />
    </Screen>
  );
}
