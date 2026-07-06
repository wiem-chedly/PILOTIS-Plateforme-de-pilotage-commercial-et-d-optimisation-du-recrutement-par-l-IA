import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Swal from 'sweetalert2';
import { Building2, Globe, Phone, Users, Mail, Loader2, ArrowRight, ArrowLeft, Briefcase, Info, Sparkles, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// ── Validation helpers ──
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const isValidPhone = (v: string) => /^[\d\s\+\-().]+$/.test(v) && v.replace(/[^\d]/g, '').length >= 6;
const isValidUrl = (v: string) => /^https?:\/\/.+\..+/.test(v);
const isValidLinkedIn = (v: string) => /^https?:\/\/(www\.)?linkedin\.com\/.+/.test(v);

export default function RegisterOrganizationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState<null | 'success' | 'error'>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    website: "",
    name: "",
    sector: "TECHNOLOGY",
    num_employees: 10,
    phone: "",
    description: "",
    linkedin_url: "",
    contact_email: "",
  });

  const handleUrlBlur = async () => {
    if (!formData.website || formData.website.length < 4) return;
    
    setIsEnriching(true);
    setEnrichStatus(null);
    try {
      const res = await fetch(`http://localhost:5000/api/organization/enrich?url=${encodeURIComponent(formData.website)}`);
      if (res.ok) {
        const data = await res.json();
        
        if (data && data.name) {
          setFormData(prev => ({
            ...prev,
            name: data.name || prev.name,
            phone: data.phone || prev.phone,
            description: data.description || prev.description,
            linkedin_url: data.linkedin_url || prev.linkedin_url,
            contact_email: data.contact_email || prev.contact_email,
            sector: data.sector || prev.sector,
            num_employees: data.num_employees || prev.num_employees,
          }));
          
          setEnrichStatus('success');
          
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Magie opérée ! 🎉`,
            text: `Données trouvées pour ${data.name}`,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#ffffff',
            color: '#003060',
          });
        } else {
            setEnrichStatus('error');
        }
      } else {
         setEnrichStatus('error');
      }
    } catch (err) {
      console.log("Enrichment failed", err);
      setEnrichStatus('error');
    } finally {
      setIsEnriching(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.website.trim()) newErrors.website = 'Le site web est obligatoire.';
    else if (!isValidUrl(formData.website)) newErrors.website = 'Entrez une URL valide (ex: https://example.com).';
    if (!formData.name.trim()) newErrors.name = 'Le nom de la société est obligatoire.';
    if (!formData.sector) newErrors.sector = 'Le secteur est obligatoire.';
    if (!formData.phone.trim()) newErrors.phone = 'Le téléphone est obligatoire.';
    else if (!isValidPhone(formData.phone)) newErrors.phone = 'Le téléphone doit contenir uniquement des chiffres (min 6).';
    if (!formData.description.trim()) newErrors.description = 'La description est obligatoire.';
    if (!formData.linkedin_url.trim()) newErrors.linkedin_url = 'La page LinkedIn est obligatoire.';
    else if (!isValidLinkedIn(formData.linkedin_url)) newErrors.linkedin_url = 'Entrez un lien LinkedIn valide (ex: https://linkedin.com/company/...).';
    if (!formData.contact_email.trim()) newErrors.contact_email = "L'email de contact est obligatoire.";
    else if (!isValidEmail(formData.contact_email)) newErrors.contact_email = 'Entrez une adresse email valide (ex: contact@societe.com).';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      Swal.fire({ icon: 'warning', title: 'Champs invalides', text: 'Veuillez corriger les erreurs dans le formulaire.', confirmButtonColor: '#003060' });
      return;
    }
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5000/api/organization/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Entreprise créée !',
          text: `L'entreprise "${formData.name}" a été ajoutée avec succès.`,
          confirmButtonColor: '#003060',
          confirmButtonText: 'Aller à la configuration',
          backdrop: `rgba(0,48,96,0.4)`
        }).then(() => navigate('/config'));
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: data.error || 'Erreur lors de la création',
          confirmButtonColor: '#003060'
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Problème de connexion au serveur',
        confirmButtonColor: '#d33'
      });
    } finally {
      setLoading(false);
    }
  };

  const formVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: custom * 0.1, duration: 0.5, ease: "easeOut" }
    })
  };

  return (
    <div className="min-h-screen flex w-full bg-white selection:bg-[#003060] selection:text-white overflow-hidden">
      
      {/* ── LEFT PANEL (Form) ── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-start lg:justify-center p-6 sm:p-12 lg:p-16 relative overflow-y-auto max-h-screen scrollbar-hide">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 lg:hidden pointer-events-none"></div>

        <div className="w-full max-w-lg relative z-10 py-10">
          
          <Button 
            variant="outline" 
            className="mb-8 text-gray-600 border-gray-300 hover:bg-gray-100 hover:text-[#003060] transition-colors rounded-xl shadow-sm px-4 h-10"
            onClick={() => navigate('/config')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour à la configuration
          </Button>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10 text-left"
          >
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 mb-3">Nouvelle Entreprise</h1>
            <p className="text-gray-500 text-lg">
              Entrez l'URL du site pour remplir automatiquement les informations clés.
            </p>
          </motion.div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            
            {/* Site Web (Magic Auth-Complete) */}
            <motion.div custom={1} initial="hidden" animate="visible" variants={formVariants}>
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                Site Web Officiel <span className="text-red-500">*</span>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-[#00509E] bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-200">
                  <Sparkles className="h-3 w-3" /> Auto-complétion
                </span>
              </Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none transition-colors group-focus-within:text-[#003060]">
                  <Globe className="h-5 w-5 text-gray-400 group-focus-within:text-[#003060]" />
                </div>
                <Input 
                  required
                  type="url" 
                  className={`pl-11 h-12 text-base bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-xl shadow-sm transition-all ${errors.website ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : enrichStatus === 'success' ? 'border-green-400 focus:border-green-500 focus:ring-green-500' : ''}`}
                  placeholder="https://www.example.com"
                  value={formData.website}
                  onChange={e => {
                      setFormData({...formData, website: e.target.value});
                      setEnrichStatus(null);
                      if (errors.website) setErrors(prev => { const n = {...prev}; delete n.website; return n; });
                  }}
                  onBlur={handleUrlBlur}
                />
                
                <AnimatePresence>
                    {isEnriching && (
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <Loader2 className="h-5 w-5 text-[#003060] animate-spin" />
                    </motion.div>
                    )}
                    {enrichStatus === 'success' && !isEnriching && (
                        <motion.div initial={{opacity:0, scale:0.8}} animate={{opacity:1, scale:1}} className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>
              {errors.website && <p className="text-red-500 text-xs mt-1">{errors.website}</p>}
            </motion.div>

            <motion.div custom={2} initial="hidden" animate="visible" variants={formVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Nom de la société <span className="text-red-500">*</span></Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-4 w-4 text-gray-400 group-focus-within:text-[#003060]" />
                  </div>
                  <Input 
                    required 
                    className="pl-9 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-lg transition-all" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Secteur <span className="text-red-500">*</span></Label>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Briefcase className="h-4 w-4 text-gray-400 group-focus-within:text-[#003060]" />
                  </div>
                  <select 
                    required
                    className={`pl-9 h-11 w-full bg-gray-50/50 border border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-1 focus:ring-[#003060] rounded-lg transition-all text-sm outline-none appearance-none ${errors.sector ? 'border-red-400' : ''}`}
                    value={formData.sector}
                    onChange={e => { setFormData({...formData, sector: e.target.value}); if (errors.sector) setErrors(prev => { const n = {...prev}; delete n.sector; return n; }); }}
                  >
                    <option value="TECHNOLOGY">IT / Software</option>
                    <option value="FINANCE">Banque / Finance</option>
                    <option value="HEALTHCARE">Santé / Pharma</option>
                    <option value="EDUCATION">Education</option>
                    <option value="CONSULTING">Conseil / Consulting</option>
                    <option value="ENERGY">Énergie</option>
                    <option value="RETAIL">Commerce / Retail</option>
                    <option value="TELECOM">Télécom</option>
                    <option value="TRANSPORT">Transport / Logistique</option>
                    <option value="CONSTRUCTION">BTP / Immobilier</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                {errors.sector && <p className="text-red-500 text-xs mt-1">{errors.sector}</p>}
              </div>
            </motion.div>
            
            <motion.div custom={3} initial="hidden" animate="visible" variants={formVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Employés (Estimé) <span className="text-red-500">*</span></Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-4 w-4 text-gray-400 group-focus-within:text-[#003060]" />
                  </div>
                  <Input 
                    required
                    type="number" 
                    min={1}
                    className="pl-9 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-lg transition-all" 
                    value={formData.num_employees}
                    onChange={e => setFormData({...formData, num_employees: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Téléphone <span className="text-red-500">*</span></Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-gray-400 group-focus-within:text-[#003060]" />
                  </div>
                  <Input 
                    required
                    type="tel" 
                    className={`pl-9 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-lg transition-all ${errors.phone ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="+33 1 23 45 67 89"
                    value={formData.phone}
                    onChange={e => { setFormData({...formData, phone: e.target.value}); if (errors.phone) setErrors(prev => { const n = {...prev}; delete n.phone; return n; }); }}
                  />
                </div>
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </motion.div>

            <motion.div custom={4} initial="hidden" animate="visible" variants={formVariants} className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Description <span className="text-red-500">*</span></Label>
                <Input 
                    required
                    className={`h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-lg transition-all ${errors.description ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="Brève description de l'activité..."
                    value={formData.description}
                    onChange={e => { setFormData({...formData, description: e.target.value}); if (errors.description) setErrors(prev => { const n = {...prev}; delete n.description; return n; }); }}
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
            </motion.div>

            <motion.div custom={5} initial="hidden" animate="visible" variants={formVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Page LinkedIn <span className="text-red-500">*</span></Label>
                <Input 
                  required
                  type="url" 
                  className={`h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-lg transition-all ${errors.linkedin_url ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                  placeholder="https://linkedin.com/company/..."
                  value={formData.linkedin_url}
                  onChange={e => { setFormData({...formData, linkedin_url: e.target.value}); if (errors.linkedin_url) setErrors(prev => { const n = {...prev}; delete n.linkedin_url; return n; }); }}
                />
                {errors.linkedin_url && <p className="text-red-500 text-xs mt-1">{errors.linkedin_url}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Email de contact <span className="text-red-500">*</span></Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-[#003060]" />
                  </div>
                  <Input 
                    required
                    type="email" 
                    className={`pl-9 h-11 bg-gray-50/50 border-gray-200 focus:bg-white focus:border-[#003060] focus:ring-[#003060] rounded-lg transition-all ${errors.contact_email ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="contact@societe.com"
                    value={formData.contact_email}
                    onChange={e => { setFormData({...formData, contact_email: e.target.value}); if (errors.contact_email) setErrors(prev => { const n = {...prev}; delete n.contact_email; return n; }); }}
                  />
                </div>
                {errors.contact_email && <p className="text-red-500 text-xs mt-1">{errors.contact_email}</p>}
              </div>
            </motion.div>

            <motion.div custom={6} initial="hidden" animate="visible" variants={formVariants}>
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex gap-3 text-sm text-[#003060]">
                    <Info className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-0.5 mt-0.5">Étape suivante</p>
                        <p className="opacity-90 leading-relaxed text-xs">Pendant que l'entreprise est créée ici, elle nécessitera qu'un <strong className="font-bold underline decoration-blue-200 underline-offset-2">Manager</strong> lui soit assigné ultérieurement depuis le tableau de bord (Configuration → Utilisateurs).</p>
                    </div>
                </div>
            </motion.div>

            <motion.div custom={7} initial="hidden" animate="visible" variants={formVariants} className="pt-2 flex flex-col gap-3">
                <Button 
                type="submit" 
                className="w-full h-12 bg-[#003060] hover:bg-[#002048] text-white font-semibold text-lg rounded-xl shadow-xl shadow-[#003060]/20 transition-all hover:shadow-[#003060]/40 group"
                disabled={loading || isEnriching}
                >
                {loading ? (
                    <div className="flex items-center gap-3">
                        <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Création en cours...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <span>Créer l'entité entreprise</span>
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                )}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full h-12 text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-[#003060] font-medium rounded-xl transition-colors"
                  onClick={() => navigate('/config')}
                >
                  Annuler et retourner
                </Button>
            </motion.div>
            
          </form>
        </div>
      </div>

      {/* ── RIGHT PANEL (Marketing / Info) ── */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[#003060] via-[#00254D] to-[#00152B] flex-col justify-between relative overflow-hidden p-16 text-white shrink-0">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10 text-blue-200 text-sm font-medium mb-12"
          >
            <Sparkles className="h-4 w-4" />
            Super Administration
          </motion.div>

          <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
          >
              <h2 className="text-5xl font-bold leading-tight mb-8">
                  Intégration d'une nouvelle <span className="text-blue-400">organisation</span>.
              </h2>
              <p className="text-xl text-blue-100/80 mb-12 leading-relaxed max-w-lg">
                  Simplifiez l'onboarding de vos clients. Entrez une URL et laissez l'IA générative extraire les métadonnées de base de l'entreprise pour vous.
              </p>
          </motion.div>

          <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              className="space-y-5"
          >
              <div className="flex gap-4 items-start bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors w-fit pr-8">
                  <div className="p-3 bg-blue-500/20 rounded-xl mt-1">
                      <Globe className="h-6 w-6 text-blue-300" />
                  </div>
                  <div>
                      <h4 className="font-semibold text-lg mb-1">Enrichissement Auto</h4>
                      <p className="text-sm text-blue-200/70 leading-snug max-w-xs">Le moteur scanne le web pour préremplir les adresses, téléphones et secteurs d'activité de l'entreprise.</p>
                  </div>
              </div>
              
              <div className="flex gap-4 items-start bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors w-fit pr-8">
                  <div className="p-3 bg-teal-500/20 rounded-xl mt-1">
                      <Users className="h-6 w-6 text-teal-300" />
                  </div>
                  <div>
                      <h4 className="font-semibold text-lg mb-1">Isolation SaaS Tenant</h4>
                      <p className="text-sm text-blue-200/70 leading-snug max-w-xs">Chaque organisation dispose d'un environnement hermétique avec sa propre gestion de rôles.</p>
                  </div>
              </div>
          </motion.div>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col gap-2 font-medium text-sm text-blue-200/50">
            <span className="tracking-widest font-bold text-white/20 uppercase text-xs mb-2">Technologie Propulsée Par</span>
            <div className="flex items-center gap-4">
              <span className="bg-white/10 px-3 py-1 rounded-md border border-white/5">Qwen AI</span>
              <span className="bg-white/10 px-3 py-1 rounded-md border border-white/5">Multi-Tenant Architecture</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
