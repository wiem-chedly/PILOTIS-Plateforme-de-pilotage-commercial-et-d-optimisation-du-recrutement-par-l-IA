import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';
import { Eye, EyeOff, UserPlus, Mail, Lock, CheckCircle2, Building2, Rocket, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      Swal.fire({
        icon: 'warning',
        title: 'Format invalide',
        text: 'Veuillez entrer une adresse email valide.',
        confirmButtonColor: '#003060'
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Les mots de passe ne correspondent pas',
        confirmButtonColor: '#003060'
      });
      return;
    }

    if (formData.password.length < 6) {
      Swal.fire({
        icon: 'error',
        title: 'Mot de passe court',
        text: 'Le mot de passe doit contenir au moins 6 caractères',
        confirmButtonColor: '#003060'
      });
      return;
    }

    if (!formData.acceptTerms) {
      Swal.fire({
        icon: 'warning',
        title: 'Conditions requises',
        text: "Vous devez accepter les conditions d'utilisation",
        confirmButtonColor: '#003060'
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: 'commercial'
        })
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: '✔ Compte créé avec succès',
          text: 'Vous pouvez maintenant vous connecter',
          timer: 2000,
          showConfirmButton: false
        });
        setTimeout(() => navigate('/login'), 2000);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: data.error || 'Impossible de créer le compte',
          confirmButtonColor: '#003060'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur réseau',
        text: 'Erreur de connexion au serveur',
        confirmButtonColor: '#003060'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-white selection:bg-[#003060] selection:text-white">
      
      {/* Left Side: Branding */}
      <div className="hidden lg:flex w-5/12 bg-gradient-to-br from-[#003060] via-[#00254D] to-[#001020] flex-col justify-between relative overflow-hidden p-16 text-white border-r border-[#003060]/50">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10 mix-blend-overlay"></div>
          
          <div className="absolute top-[-15%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-[-5%] left-[-10%] w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 pt-4">
              <div className="flex items-center gap-3 font-bold text-2xl tracking-widest text-white/90">
                  <Building2 className="h-8 w-8 text-blue-400" />
                  PILOTIS
              </div>
          </div>

          <div className="relative z-10 max-w-sm">
              <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7, delay: 0.2 }}
              >
                  <Rocket className="h-12 w-12 text-blue-400 mb-6" />
                  <h2 className="text-4xl font-bold leading-tight mb-6">
                      Rejoignez l'élite commerciale.
                  </h2>
                  <p className="text-lg text-blue-100/70 mb-8 leading-relaxed">
                      Créez votre compte en quelques secondes et donnez un coup d'accélérateur à votre gestion de KPI.
                  </p>
              </motion.div>

              <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                  className="space-y-4"
              >
                 {[
                   "Tableaux de bord personnalisés",
                   "Suivi d'objectifs en temps réel",
                   "Génération automatique de rapports",
                   "Collaboration simplifiée"
                 ].map((feature, idx) => (
                   <div key={idx} className="flex items-center gap-3 text-blue-100/90 font-medium">
                     <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0" />
                     <span>{feature}</span>
                   </div>
                 ))}
              </motion.div>
          </div>

          <div className="relative z-10 pb-4">
              <div className="flex -space-x-3 mb-3">
                  <img src="https://i.pravatar.cc/100?img=1" alt="User" className="w-10 h-10 rounded-full border-2 border-[#003060]" />
                  <img src="https://i.pravatar.cc/100?img=2" alt="User" className="w-10 h-10 rounded-full border-2 border-[#003060]" />
                  <img src="https://i.pravatar.cc/100?img=3" alt="User" className="w-10 h-10 rounded-full border-2 border-[#003060]" />
                  <div className="w-10 h-10 rounded-full border-2 border-[#003060] bg-blue-900/50 flex items-center justify-center text-xs font-bold backdrop-blur-md">
                      +1k
                  </div>
              </div>
              <p className="text-sm text-blue-200/60">Rejoignez plus de 1000 professionnels.</p>
          </div>
      </div>

      {/* Right Side: Form */}
      <div className="w-full lg:w-7/12 flex flex-col justify-center p-8 sm:p-12 lg:p-24 relative overflow-y-auto">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 lg:hidden pointer-events-none"></div>

        <div className="w-full max-w-md mx-auto space-y-8 relative z-10">
          <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center lg:text-left"
          >
              <div className="flex justify-center lg:justify-start mb-6">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#003060] to-[#00509E] flex items-center justify-center shadow-lg shadow-[#003060]/20 lg:hidden">
                      <UserPlus className="h-6 w-6 text-white" />
                  </div>
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-2">Créer un compte</h1>
              <p className="text-gray-500 text-lg">Entrez vos détails pour créer votre espace.</p>
          </motion.div>

          <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              onSubmit={handleSubmit} 
              className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                Email professionnel <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@entreprise.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="h-12 pl-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] transition-all rounded-xl shadow-sm text-base"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                  Mot de passe <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="h-12 pl-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] transition-all pr-10 rounded-xl shadow-sm text-base"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-gray-100 rounded-lg text-gray-400"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold text-gray-700">
                  Confirmer <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                    className="h-12 pl-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] transition-all pr-10 rounded-xl shadow-sm text-base"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 hover:bg-gray-100 rounded-lg text-gray-400"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-start gap-3">
              <div className="flex items-center h-6">
                 <input
                   type="checkbox"
                   id="terms"
                   checked={formData.acceptTerms}
                   onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                   className="h-5 w-5 rounded border-gray-300 text-[#003060] focus:ring-[#003060] transition-all bg-gray-50"
                 />
              </div>
              <label htmlFor="terms" className="text-sm text-gray-600 leading-relaxed">
                En créant un compte, j'accepte les{" "}
                <a href="#" className="font-semibold text-[#003060] hover:underline">conditions d'utilisation</a>
                {" "}et la{" "}
                <a href="#" className="font-semibold text-[#003060] hover:underline">politique de confidentialité</a>
                {" "}de PILOTIS.
              </label>
            </div>

            <Button
              type="submit"
              className="w-full mt-2 h-12 bg-[#003060] hover:bg-[#002048] text-white font-semibold text-lg rounded-xl shadow-xl shadow-[#003060]/20 transition-all hover:shadow-[#003060]/40 group"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Création en cours...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>S'inscrire maintenant</span>
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </Button>

            <div className="pt-6 text-center border-t border-gray-100">
              <p className="text-gray-500">
                Déjà inscrit ?{" "}
                <Link
                  to="/login"
                  className="font-semibold text-[#003060] hover:text-[#002048] hover:underline transition-all"
                >
                  Connectez-vous à votre espace
                </Link>
              </p>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
