import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { clearUserIdCache, clearLocalCache } from '../utils/storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';

WebBrowser.maybeCompleteAuthSession();


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
        supabase.auth.getSession()
            .then(({ data: { session: s } }) => {
                setSession(s);
                setUser(s?.user ?? null);
            })
            .catch(() => {})
            .finally(() => setLoading(false));

        // Escuchar cambios de sesión
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, s) => {
                // El id cacheado se invalida en cualquier cambio de sesión (otro usuario, logout).
                clearUserIdCache();
                if (event === 'SIGNED_OUT') clearLocalCache();
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
        await clearLocalCache();
        await supabase.auth.signOut();
    }, []);

    /** Borra la cuenta y todos sus datos (función SQL delete_own_account). */
    const deleteAccount = useCallback(async () => {
        if (!supabase) throw new Error('Sin conexión con el servidor');
        const { error } = await supabase.rpc('delete_own_account');
        if (error) throw error;
        clearUserIdCache();
        await clearLocalCache();
        await supabase.auth.signOut().catch(() => {});
    }, []);

    const resetPassword = useCallback(async (email) => {
        if (!supabase) throw new Error('Sin conexión a Supabase');
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    }, []);

    const signInWithOAuth = useCallback(async (provider) => {
        if (!supabase) throw new Error('Sin conexión a Supabase');

        const redirectUrl = AuthSession.makeRedirectUri({
            scheme: 'finance-app',
        });

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
            },
        });

        if (error) throw error;

        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (res.type === 'success' && res.url) {
            const getParamsFromUrl = (url) => {
                const params = {};
                const hashIndex = url.indexOf('#');
                const queryIndex = url.indexOf('?');
                const searchString = hashIndex !== -1 ? url.substring(hashIndex + 1) : (queryIndex !== -1 ? url.substring(queryIndex + 1) : '');
                const pairs = searchString.split('&');
                for (const pair of pairs) {
                    const [key, value] = pair.split('=');
                    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                }
                return params;
            };

            const params = getParamsFromUrl(res.url);
            const access_token = params.access_token;
            const refresh_token = params.refresh_token;

            if (access_token && refresh_token) {
                const { error: sessionError } = await supabase.auth.setSession({
                    access_token,
                    refresh_token,
                });
                if (sessionError) throw sessionError;
            }
        }
    }, []);

    const signInWithApple = useCallback(async () => {
        if (!supabase) throw new Error('Sin conexión a Supabase');
        try {
            const credential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
            });

            if (credential.identityToken) {
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: 'apple',
                    token: credential.identityToken,
                });
                if (error) throw error;
                return data;
            } else {
                throw new Error('No se pudo obtener el token de identidad de Apple.');
            }
        } catch (e) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
                return;
            }
            throw e;
        }
    }, []);

    const value = useMemo(() => ({
        user, session, loading,
        signIn, signUp, signOut, resetPassword, deleteAccount,
        signInWithOAuth, signInWithApple,
    }), [user, session, loading, signIn, signUp, signOut, resetPassword, deleteAccount, signInWithOAuth, signInWithApple]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
