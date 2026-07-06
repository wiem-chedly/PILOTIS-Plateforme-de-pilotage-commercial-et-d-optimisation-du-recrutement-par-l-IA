import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle, XCircle, Clock, ChevronRight, ChevronLeft, Send } from "lucide-react";

const API = "http://localhost:5000/api";

interface Question {
  num: number;
  text: string;
  choices: Record<string, string>;
}

interface QuizData {
  questions: Question[];
  total: number;
  job_title: string;
  candidate_name: string;
}

export default function QuizPage() {
  const { token } = useParams<{ token: string }>();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/quiz/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.already_done) { setAlreadyDone(true); return; }
        if (data.error) { setError(data.error); return; }
        setQuiz(data);
      })
      .catch(() => setError("Impossible de charger le quiz. Vérifiez votre connexion."))
      .finally(() => setLoading(false));
  }, [token]);

  const selectAnswer = (num: number, choice: string) => {
    setAnswers(prev => ({ ...prev, [String(num)]: choice }));
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const unanswered = quiz.questions.filter(q => !answers[String(q.num)]);
    if (unanswered.length > 0) {
      alert(`Veuillez répondre à toutes les questions (${unanswered.length} restante${unanswered.length > 1 ? "s" : ""}).`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/quiz/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) setSubmitted(true);
      else {
        const d = await res.json();
        if (d.already_done) setAlreadyDone(true);
        else setError(d.error || "Erreur lors de la soumission.");
      }
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── States de rendu ─────────────────────────────────────────────────────────

  if (loading) return (
    <PageWrapper>
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400">Chargement du quiz…</p>
      </div>
    </PageWrapper>
  );

  if (alreadyDone) return (
    <PageWrapper>
      <StatusCard icon={<CheckCircle className="w-16 h-16 text-emerald-400" />}
        title="Quiz déjà soumis" color="emerald"
        message="Vous avez déjà répondu à ce test. Vous recevrez un email si votre candidature est retenue." />
    </PageWrapper>
  );

  if (error) return (
    <PageWrapper>
      <StatusCard icon={<XCircle className="w-16 h-16 text-red-400" />}
        title="Lien invalide" color="red" message={error} />
    </PageWrapper>
  );

  if (submitted) return (
    <PageWrapper>
      <StatusCard
        icon={<CheckCircle className="w-16 h-16 text-emerald-400" />}
        title="Test soumis avec succès !"
        color="emerald"
        message="Merci d'avoir complété le test. Vos réponses ont été enregistrées. Vous recevrez un email si votre candidature est retenue pour un entretien."
      />
    </PageWrapper>
  );

  if (!quiz) return null;

  const q = quiz.questions[currentQ];
  const answered = answers[String(q.num)];
  const progress = ((currentQ + 1) / quiz.total) * 100;
  const isLast = currentQ === quiz.total - 1;

  return (
    <PageWrapper>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-4">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span className="text-indigo-300 text-sm font-medium">Test de présélection</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{quiz.job_title}</h1>
        {quiz.candidate_name && (
          <p className="text-slate-400 text-sm">Bonjour {quiz.candidate_name}</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Question {currentQ + 1} / {quiz.total}</span>
          <span>{Object.keys(answers).length}/{quiz.total} répondues</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-2xl p-6 mb-5 shadow-xl">
        <p className="text-white font-semibold text-lg leading-relaxed mb-6">
          {currentQ + 1}. {q.text}
        </p>
        <div className="space-y-3">
          {Object.entries(q.choices).map(([letter, text]) => {
            const isSelected = answered === letter;
            return (
              <button
                key={letter}
                onClick={() => selectAnswer(q.num, letter)}
                className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 group
                  ${isSelected
                    ? "border-indigo-500 bg-indigo-500/20 shadow-[0_0_0_1px] shadow-indigo-500/30"
                    : "border-slate-600/50 bg-slate-700/30 hover:border-slate-500 hover:bg-slate-700/60"
                  }`}
              >
                <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors
                  ${isSelected
                    ? "bg-indigo-500 border-indigo-400 text-white"
                    : "border-slate-500 text-slate-400 group-hover:border-slate-400"
                  }`}>
                  {letter}
                </span>
                <span className={`text-sm leading-relaxed pt-0.5 ${isSelected ? "text-white" : "text-slate-300"}`}>
                  {text}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
          disabled={currentQ === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600/50 text-slate-300 hover:bg-slate-700/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Précédent
        </button>

        {!isLast ? (
          <button
            onClick={() => setCurrentQ(q => Math.min(quiz.total - 1, q + 1))}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all"
          >
            Suivant <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length < quiz.total}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-all"
          >
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi…</>
              : <><Send className="w-4 h-4" /> Soumettre le test</>
            }
          </button>
        )}
      </div>

      {/* Dots navigation */}
      <div className="flex justify-center gap-1.5 mt-5">
        {quiz.questions.map((q2, i) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
              i === currentQ ? "bg-indigo-500 w-6" :
              answers[String(q2.num)] ? "bg-emerald-500/70" : "bg-slate-600"
            }`}
          />
        ))}
      </div>
    </PageWrapper>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-black bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            Pilotis
          </span>
          <p className="text-slate-500 text-xs mt-1">Plateforme de recrutement</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusCard({ icon, title, message, color }: {
  icon: React.ReactNode; title: string; message: string; color: "emerald" | "red";
}) {
  const ring = color === "emerald" ? "ring-emerald-500/20" : "ring-red-500/20";
  return (
    <div className={`bg-slate-800/60 border border-slate-700/50 rounded-2xl p-10 text-center ring-1 ${ring}`}>
      <div className="flex justify-center mb-5">{icon}</div>
      <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
      <p className="text-slate-400 leading-relaxed">{message}</p>
    </div>
  );
}
