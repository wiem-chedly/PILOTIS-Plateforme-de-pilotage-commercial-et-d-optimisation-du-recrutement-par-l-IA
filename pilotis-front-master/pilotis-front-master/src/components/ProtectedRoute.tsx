import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: string[];
    pageKey?: string;
}

export const ProtectedRoute = ({ children, allowedRoles, pageKey }: ProtectedRouteProps) => {
    const { user, loading, hasAccess, getFallbackRoute } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Si des rôles sont spécifiés, vérifier que l'utilisateur en fait partie
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    // Protection dynamique hiérarchique : vérifier globalement via RBAC (sauf super_admin)
    if (pageKey && !hasAccess(pageKey)) {
        const fallback = getFallbackRoute();
        
        // Si une route de secours est disponible et qu'elle est différente de la route actuelle, on redirige
        if (fallback && fallback !== location.pathname) {
            return <Navigate to={fallback} replace />;
        }

        return (
            <DashboardLayout title="Accès restreint">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Card className="w-full max-w-md shadow-sm border-slate-200">
                        <CardContent className="pt-8 pb-6 text-center">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
                                <XCircle className="h-8 w-8" />
                            </div>
                            <h2 className="text-xl font-semibold text-slate-800 mb-2">Accès restreint</h2>
                            <p className="text-slate-600 mb-4 px-4 text-sm leading-relaxed">
                                Vous n'avez pas l'autorisation de consulter cette page.
                            </p>
                            {hasAccess('dashboard') && (
                                <Button asChild variant="outline" className="mt-2 text-sm bg-slate-50">
                                    <a href="/">Retour au Dashboard</a>
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        );
    }

    return children;
};
