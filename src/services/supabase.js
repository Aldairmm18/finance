import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL     ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Solo inicializar el cliente si las variables de entorno están presentes.
// Esto evita crashes si se corre sin .env.
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Usar AsyncStorage como adaptador de sesión en React Native
        storage: AsyncStorage,
        autoRefreshToken:  true,
        persistSession:    true,
        detectSessionInUrl: false, // Requerido en React Native (sin URL navigation)
      },
    })
  : null;
