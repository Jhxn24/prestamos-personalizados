import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { login, registrarAdmin } = useAuth();

  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const esRegistro = modo === 'registro';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [enviando, setEnviando] = useState(false);

  function cambiarModo(siguiente: 'login' | 'registro') {
    setModo(siguiente);
    setPassword('');
    setConfirmarPassword('');
  }

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu email y contraseña.');
      return;
    }
    setEnviando(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert('No se pudo iniciar sesión', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  async function handleRegistro() {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Ingresa un email y una contraseña.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmarPassword) {
      Alert.alert('Las contraseñas no coinciden', 'Revisa la confirmación.');
      return;
    }
    setEnviando(true);
    try {
      await registrarAdmin(email.trim(), password);
    } catch (error) {
      Alert.alert('No se pudo crear la cuenta', error instanceof ApiError ? error.message : 'Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Sistema de Préstamos
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {esRegistro
              ? 'Cada administrador tiene su propia cartera de clientes y préstamos.'
              : 'Inicia sesión para ver tu préstamo o gestionar el negocio.'}
          </ThemedText>

          <ThemedView style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <TextField
              label="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {esRegistro && (
              <TextField
                label="Confirmar contraseña"
                value={confirmarPassword}
                onChangeText={setConfirmarPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            )}
            <Button
              title={esRegistro ? 'Crear cuenta' : 'Ingresar'}
              onPress={esRegistro ? handleRegistro : handleLogin}
              loading={enviando}
            />
            <Button
              title={esRegistro ? 'Ya tengo una cuenta, iniciar sesión' : 'Crear una cuenta de administrador'}
              variant="ghost"
              onPress={() => cambiarModo(esRegistro ? 'login' : 'registro')}
            />
          </ThemedView>
        </ThemedView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.three,
  },
});
