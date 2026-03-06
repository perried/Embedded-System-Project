/**
 * AuthContext.tsx
 * ===============
 * Provides global authentication state (user, token, login/logout)
 * to the entire React app via React Context.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE_URL } from '../constants';

interface User {
    id: number;
    full_name: string;
    email: string;
    role: 'admin' | 'operator';
}

interface AuthContextValue {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(() => localStorage.getItem('trsms_token'));
    const [isLoading, setIsLoading] = useState(true);

    // On mount, verify stored token is still valid
    useEffect(() => {
        const storedToken = localStorage.getItem('trsms_token');
        if (!storedToken) {
            setIsLoading(false);
            return;
        }
        fetch(`${API_BASE_URL}/api/users/currentuser`, {
            headers: { Authorization: `Bearer ${storedToken}` },
        })
            .then(res => (res.ok ? res.json() : null))
            .then(userData => {
                if (userData) {
                    setUser(userData);
                    setToken(storedToken);
                } else {
                    localStorage.removeItem('trsms_token');
                    setToken(null);
                }
            })
            .catch(() => {
                localStorage.removeItem('trsms_token');
                setToken(null);
            })
            .finally(() => setIsLoading(false));
    }, []);

    const login = async (email: string, password: string) => {
        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Login failed.');
        }

        const { token: newToken, user: userData } = await res.json();
        localStorage.setItem('trsms_token', newToken);
        setToken(newToken);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('trsms_token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
