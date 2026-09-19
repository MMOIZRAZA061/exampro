import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LoadingSpinner } from "./ui";

function roleHome(role: string) {
    if (role === "admin") return "/admin";
    if (role === "teacher") return "/teacher";
    return "/student";
}

export function ProtectedRoute({
    children,
    roles,
}: {
    children: ReactNode;
    roles?: string[];
}) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <LoadingSpinner text="Loading..." />;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If the user landed on "/" or "/login", send them to their role home
    // using a client-side navigation (no full-page reload).
    if (
        location.pathname === "/" ||
        location.pathname === "/login"
    ) {
        return <Navigate to={roleHome(user.role)} replace />;
    }

    if (roles && !roles.includes(user.role)) {
        return <Navigate to={roleHome(user.role)} replace />;
    }

    return <>{children}</>;
}
