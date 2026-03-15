import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { clearUserIdCache } from '../utils/storage';

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
            (event, s) => {
                if (event === 'SIGNED_OUT') clearUserIdCache();
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
        // Cerrar sesión inmediatamente para que el usuario inicie sesión manualmente
        await supabase.auth.signOut();
        return data;
    }, []);

    const signOut = useCallback(async () => {
        if (!supabase) return;
        clearUserIdCache();
        await supabase.auth.signOut();
    }, []);

    const resetPassword = useCallback(async (email) => {
        if (!supabase) throw new Error('Sin conexión a Supabase');
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }, []);

    /**
     * Migra datos de user_id='default' al usuario autenticado actual.
     * Solo funciona si existen filas con user_id='default' (primera vez).
     * Después de migrar, elimina las filas 'default' restantes para que
     * ningún otro usuario las reciba.
     * @returns {{ migrated: boolean, counts: object }}
     */
    const claimDefaultData = useCallback(async () => {
        if (!supabase || !user) throw new Error('No autenticado');
        return migrateDefaultData(user.id);
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user, session, loading,
            signIn, signUp, signOut, resetPassword,
            claimDefaultData,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

/**
 * Migra datos de user_id='default' al nuevo user_id UNA SOLA VEZ.
 *
 * 1. Verifica si existen filas con user_id='default' (canary: tabla presupuesto)
 * 2. Si existen, cambia user_id 'default' → newUserId en todas las tablas
 * 3. Elimina cualquier fila 'default' residual para que no se re-migre
 *
 * Si no hay datos 'default', retorna { migrated: false } sin hacer nada.
 */
async function migrateDefaultData(newUserId) {
    if (!supabase || !newUserId) return { migrated: false };

    // 1. Verificar si hay datos default (usar presupuesto como canary)
    const { data: check } = await supabase
        .from('presupuesto')
        .select('user_id')
        .eq('user_id', 'default')
        .limit(1);

    if (!check || check.length === 0) {
        console.log('[auth] No hay datos con user_id=default. Usuario nuevo inicia vacío.');
        return { migrated: false };
    }

    // 2. Migrar: cambiar user_id='default' → newUserId en cada tabla
    const tables = ['presupuesto', 'presupuesto_mensual', 'transacciones', 'configuracion'];
    const counts = {};

    for (const table of tables) {
        const { data: updated, error } = await supabase
            .from(table)
            .update({ user_id: newUserId })
            .eq('user_id', 'default')
            .select('id');

        if (error) {
            console.warn(`[auth] Error migrando ${table}:`, error.message);
            counts[table] = 0;
        } else {
            counts[table] = updated?.length || 0;
        }
    }

    // 3. Limpiar: eliminar cualquier fila residual con user_id='default'
    //    (por si alguna tabla no tenía columna id o la update falló parcialmente)
    for (const table of tables) {
        await supabase
            .from(table)
            .delete()
            .eq('user_id', 'default');
    }

    console.log('[auth] Migración completada:', counts);
    return { migrated: true, counts };
}
