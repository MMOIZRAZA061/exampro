import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from "react";
import { auth } from "../services/api";
import { AuthUser } from "../types";

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    login: async () => { },
    logout: async () => { },
    hasRole: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const loadUser = useCallback(async () => {
        try {
            const res = await auth.me();
            setUser({
                id: res.data.id,
                email: res.data.email,
                role: res.data.role,
                fullName: res.data.fullName,
            });
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUser();
    }, [loadUser]);

    const login = useCallback(async (email: string, password: string) => {
        const res = await auth.login({ email, password });
        setUser({
            id: res.data.user.id,
            email: res.data.user.email,
            role: res.data.user.role,
            fullName: res.data.user.fullName,
        });
    }, []);

    const logout = useCallback(async () => {
        try {
            await auth.logout();
        } finally {
            setUser(null);
            window.location.href = "/login";
        }
    }, []);

    const hasRole = useCallback(
        (...roles: string[]) => {
            if (!user) return false;
            return roles.includes(user.role);
        },
        [user]
    );

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
