import { useState, FormEvent, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui";
import { auth } from "../services/api";

function roleHome(role: string) {
    if (role === "admin") return "/admin";
    if (role === "teacher") return "/teacher";
    return "/student";
}

export default function LoginPage() {
    const { user, login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [showRegister, setShowRegister] = useState(false);
    const [regForm, setRegForm] = useState({
        fullName: "",
        email: "",
        password: "",
        studentId: "",
        phone: "",
    });
    const [regLoading, setRegLoading] = useState(false);
    const [regError, setRegError] = useState("");
    const { showToast, toastComponent } = useToast();

    // If already logged in, redirect to their home (client-side, no reload)
    useEffect(() => {
        if (user) {
            window.location.replace(roleHome(user.role));
        }
    }, [user]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            // The `user` state in context updates after this resolves,
            // which triggers the redirect above.
            await login(email, password);
            showToast("Logged in successfully");
        } catch (err: any) {
            setError(err.response?.data?.error || "Login failed. Check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();
        setRegError("");
        setRegLoading(true);
        try {
            await auth.registerStudent({
                fullName: regForm.fullName,
                email: regForm.email,
                password: regForm.password,
                studentId: regForm.studentId || undefined,
                phone: regForm.phone || undefined,
            });
            showToast("Account created! Signing you in...");
            // Auto-login with the credentials just used for registration.
            await login(regForm.email, regForm.password);
            // The redirect to /student is handled by the `user` effect above.
        } catch (err: any) {
            setRegError(err.response?.data?.error || "Registration failed. Try again.");
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            {toastComponent}
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center bg-blue-600 rounded-2xl p-4 text-white shadow-lg">
                        <Shield size={40} />
                    </div>
                    <h1 className="mt-4 text-3xl font-bold text-gray-900">ProExam</h1>
                    <p className="mt-2 text-gray-500">
                        Secure Exam Management Platform
                    </p>
                </div>

                <div className="card p-8">
                    {showRegister ? (
                        <>
                            <h2 className="text-xl font-semibold text-gray-900 mb-6">
                                Register as a student
                            </h2>

                            {regError && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                                    {regError}
                                </div>
                            )}

                            <form onSubmit={handleRegister} className="space-y-4">
                                <div>
                                    <label className="label">Full Name</label>
                                    <input
                                        className="input"
                                        value={regForm.fullName}
                                        onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                                        placeholder="Your full name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={regForm.email}
                                        onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={regForm.password}
                                        onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div>
                                    <label className="label">Student ID (optional)</label>
                                    <input
                                        className="input"
                                        value={regForm.studentId}
                                        onChange={(e) => setRegForm({ ...regForm, studentId: e.target.value })}
                                        placeholder="e.g. S-1234"
                                    />
                                </div>
                                <div>
                                    <label className="label">Phone (optional)</label>
                                    <input
                                        className="input"
                                        value={regForm.phone}
                                        onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                                        placeholder="+92-..."
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="submit"
                                        disabled={regLoading}
                                        className="btn-primary w-full"
                                    >
                                        <UserPlus size={18} />
                                        {regLoading ? "Creating account..." : "Create Account"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowRegister(false)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Already have an account? Sign in
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <>
                            <h2 className="text-xl font-semibold text-gray-900 mb-6">
                                Sign in to your account
                            </h2>

                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="label">Email</label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">Password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary w-full"
                                >
                                    <LogIn size={18} />
                                    {loading ? "Signing in..." : "Sign In"}
                                </button>
                            </form>

                            <button
                                type="button"
                                onClick={() => setShowRegister(true)}
                                className="mt-4 w-full text-sm text-blue-600 hover:underline"
                            >
                                New student? Register here
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
