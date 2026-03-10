import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supabase) {
            setLoading(false);
            return;
        }

        // Obtener sesión actual
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            setLoading(false);
        });

        // Escuchar cambios de sesión
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, s) => {
                setSession(s);
                setUser(s?.user ?? null);
            },
        );

        return () => subscription.unsubscribe();
    }, []);

    const signIn = useCallback(async (email, password) => {
        if (!supabase) throw new Error('Sin conexión a Supabase');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    }, []);

    const signUp = useCallback(async (email, password) => {
        if (!supabase) throw new Error('Sin conexión a Supabase');
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Migrar datos de user_id='default' al nuevo usuario
        if (data.user) {
            try {
                await migrateDefaultData(data.user.id);
            } catch (e) {
                console.warn('[auth] Migración de datos default falló:', e.message);
            }
        }

        return data;
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
    }, []);

    const resetPassword = useCallback(async (email) => {
        if (!supabase) throw new Error('Sin conexión a Supabase');
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }, []);

    return (
        <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

/**
 * Migra datos de user_id='default' al user_id del usuario recién registrado.
 * Solo se ejecuta una vez al registrarse.
 */
async function migrateDefaultData(newUserId) {
    if (!supabase || !newUserId) return;

    const tables = ['presupuesto', 'presupuesto_mensual', 'transacciones', 'configuracion'];

    for (const table of tables) {
        const { error } = await supabase
            .from(table)
            .update({ user_id: newUserId })
            .eq('user_id', 'default');

        if (error) {
            console.warn(`[auth] Error migrando ${table}:`, error.message);
        }
    }
}
