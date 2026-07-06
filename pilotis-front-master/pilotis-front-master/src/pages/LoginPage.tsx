import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, LogIn, ChevronRight, BarChart3, TrendingUp, Users, Building2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { motion } from 'framer-motion';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Swal.fire({
                icon: 'warning',
                title: 'Format invalide',
                text: 'Veuillez entrer une adresse email valide.',
                confirmButtonColor: '#003060'
            });
            return;
        }

        if (password.length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Mot de passe trop court',
                text: 'Le mot de passe doit contenir au moins 6 caractères.',
                confirmButtonColor: '#003060'
            });
            return;
        }

        setLoading(true);

        try {
            await login(email, password);

            Swal.fire({
                icon: 'success',
                title: 'Connexion réussie',
                text: 'Bienvenue sur PILOTIS !',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                navigate('/');
            });
        } catch (err: any) {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: err.message || 'Email ou mot de passe incorrect',
                confirmButtonColor: '#003060'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex w-full bg-white selection:bg-[#003060] selection:text-white">
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 lg:hidden pointer-events-none"></div>

                <div className="w-full max-w-md space-y-10 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center lg:text-left"
                    >
                        <div className="flex justify-center lg:justify-start mb-8">
                            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#003060] to-[#00509E] flex items-center justify-center shadow-xl shadow-[#003060]/30 transform -rotate-3 transition-transform hover:rotate-0">
                                <LogIn className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Connectez-vous</h1>
                        <p className="text-gray-500 text-lg">Connectez-vous pour accéder à votre espace PILOTIS.</p>
                    </motion.div>

                    <motion.form
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        onSubmit={handleSubmit}
                        className="space-y-6"
                    >
                        <div className="space-y-2.5">
                            <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email professionnel</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="votre@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] transition-all rounded-xl shadow-sm text-base"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex justify-between items-center">
                                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Mot de passe</Label>
                                <a href="#" className="text-sm font-medium text-[#003060] hover:text-[#002048] hover:underline transition-all">Oublié ?</a>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="h-12 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] transition-all pr-12 rounded-xl shadow-sm text-base"
                                    disabled={loading}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-gray-100 rounded-lg text-gray-400 focus:text-gray-600 transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 bg-[#003060] hover:bg-[#002048] text-white font-semibold text-lg rounded-xl shadow-xl shadow-[#003060]/20 transition-all hover:shadow-[#003060]/40 group"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-3">
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Connexion...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <span>Se connecter</span>
                                    <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                </div>
                            )}
                        </Button>

                        <div className="pt-4 text-center">
                            <p className="text-gray-500">
                                {" "}
                                <Link
                                    to="/register"
                                    className="font-semibold text-[#003060] hover:text-[#002048] hover:underline transition-all"
                                >

                                </Link>
                            </p>
                        </div>
                    </motion.form>
                </div>
            </div>

            <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#003060] via-[#00254D] to-[#00152B] flex-col justify-between relative overflow-hidden p-16 text-white">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>

                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 font-bold text-2xl tracking-widest text-white/90">
                        <BarChart3 className="h-8 w-8 text-blue-400" />
                        PILOTIS
                    </div>
                </div>

                <div className="relative z-10 max-w-xl">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                    >
                        <h2 className="text-5xl font-bold leading-tight mb-6">
                            Pilotez vos <span className="text-blue-400">performances</span> avec précision.
                        </h2>
                        <p className="text-xl text-blue-100/80 mb-10 leading-relaxed">
                            Une plateforme intégrée pour les commerciaux et managers, offrant une vue unifiée et en temps réel sur vos indicateurs clés.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.7, delay: 0.5 }}
                        className="grid grid-cols-2 gap-6"
                    >
                        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="p-3 bg-blue-500/20 rounded-xl">
                                <TrendingUp className="h-6 w-6 text-blue-300" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg">KPIs en direct</h4>
                                <p className="text-sm text-blue-200/70">Suivi temps réel</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors">
                            <div className="p-3 bg-teal-500/20 rounded-xl">
                                <Users className="h-6 w-6 text-teal-300" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-lg">Collaboration</h4>
                                <p className="text-sm text-blue-200/70">Équipe unifiée</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="relative z-10 flex items-center gap-4 text-sm text-blue-200/60 font-medium">
                    <span>© {new Date().getFullYear()} PILOTIS. Tous droits réservés.</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
                    <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
                    <a href="#" className="hover:text-white transition-colors">Conditions</a>
                </div>
            </div>
        </div>
    );
}
