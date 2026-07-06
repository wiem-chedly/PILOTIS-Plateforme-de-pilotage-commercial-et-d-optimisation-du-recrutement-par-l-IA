import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    id: number;
    email: string;
    role: 'super_admin' | 'manager' | 'commercial';
    first_name?: string;
    last_name?: string;
    organization_id?: number;
    organization_name?: string;
    linkedin_account_id?: number;
    has_token?: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    isSuperAdmin: () => boolean;
    isManager: () => boolean;
    isCommercial: () => boolean;
    canManageUsers: () => boolean;
    canAccessConfig: () => boolean;
    hasAccess: (pageKey: string) => boolean;
    reloadPermissions: () => Promise<void>;
    getFallbackRoute: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [permissions, setPermissions] = useState<any>(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/auth/me', {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setUser(data);
                
                // Fetch permissions if not super admin
                if (data && data.role && data.role !== 'super_admin') {
                    try {
                        const permRes = await fetch('http://localhost:5000/api/permissions', { credentials: 'include' });
                        if (permRes.ok) {
                            const params = await permRes.json();
                            setPermissions(params);
                        }
                    } catch (e) {
                         console.error('Erreur permissions', e);
                    }
                }
            }
        } catch (err) {
            console.error('Erreur vérification auth:', err);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Erreur de connexion');
        }
        setUser(data.user);
        
        // Load perm after login
        if (data.user && data.user.role !== 'super_admin') {
             try {
                const permRes = await fetch('http://localhost:5000/api/permissions', { credentials: 'include' });
                if (permRes.ok) {
                    const params = await permRes.json();
                    setPermissions(params);
                }
            } catch (e) {
                 console.error('Erreur permissions', e);
            }
        }
    };

    const logout = async () => {
        await fetch('http://localhost:5000/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        setUser(null);
    };

    const reloadPermissions = async () => {
        if (user && user.role !== 'super_admin') {
            try {
                const permRes = await fetch('http://localhost:5000/api/permissions', { credentials: 'include' });
                if (permRes.ok) {
                    const params = await permRes.json();
                    setPermissions(params);
                }
            } catch (e) {
                 console.error('Erreur permissions', e);
            }
        }
    };

    // --- Helpers de rôle ---
    const isSuperAdmin = () => user?.role === 'super_admin';
    const isManager = () => user?.role === 'manager';
    const isCommercial = () => user?.role === 'commercial';
    const canManageUsers = () => ['super_admin', 'manager'].includes(user?.role ?? '');
    const canAccessConfig = () => user?.role !== 'commercial';

    const hasAccess = (pageKey: string) => {
        if (user?.role === 'super_admin') return true;
        if (!permissions || !user?.role) return true; // Default access while loading
        const rolePerms = permissions[user.role];
        if (rolePerms && rolePerms[pageKey] === false) return false;
        return true;
    };

    const getFallbackRoute = () => {
        if (user?.role === 'super_admin') return '/';
        const routes = [
            { key: 'dashboard', url: '/' },
            { key: 'appels-offres', url: '/appels-offres' },
            { key: 'candidatures', url: '/candidats' },
            { key: 'performance', url: '/performance' },
            { key: 'clients', url: '/clients' },
            { key: 'reporting', url: '/reporting' },
            { key: 'synthese-hebdo', url: '/synthese-hebdo' },
            { key: 'intercontrats', url: '/intercontrats' },
            { key: 'kpi-annuels', url: '/kpi-annuels' },
            { key: 'logs-import', url: '/logs' },
            { key: 'configuration', url: '/config' },
        ];
        
        for (const route of routes) {
            if (hasAccess(route.key)) {
                return route.url;
            }
        }
        return null;
    };

    return (
        <AuthContext.Provider value={{
            user, loading, login, logout,
            isSuperAdmin, isManager, isCommercial, canManageUsers, canAccessConfig, hasAccess, reloadPermissions, getFallbackRoute
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
