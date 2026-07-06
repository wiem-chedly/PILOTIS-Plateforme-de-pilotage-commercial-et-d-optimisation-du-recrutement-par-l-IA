import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Loader2 } from "lucide-react";
import { Candidate } from "@/pages/Candidats";

interface EmailTemplate {
  id_template: number;
  name_template: string;
  subject: string;
  body: string;
  description: string;
}

interface SendEmailDialogProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SendEmailDialog({ candidate, isOpen, onClose }: SendEmailDialogProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setSubject("");
      setBody("");
      setSelectedTemplateId("");
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/api/email-templates", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Impossible de charger les templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value;
    setSelectedTemplateId(tId === "" ? "" : Number(tId));

    if (tId === "") {
      setSubject("");
      setBody("");
    } else {
      const template = templates.find((t) => t.id_template === Number(tId));
      if (template) {
        // Fallback text if API fails
        setSubject(template.subject);
        setBody(template.body);

        if (candidate) {
          setLoadingPreview(true);
          try {
            const appIdQuery = candidate.application_id ? `&application_id=${candidate.application_id}` : "";
            const url = `http://localhost:5000/api/email-templates/${tId}/preview?candidate_id=${candidate.id}${appIdQuery}`;
            const res = await fetch(url, { credentials: "include", cache: "no-cache" });
            if (res.ok) {
              const data = await res.json();
              setSubject(data.subject);
              setBody(data.body);
            }
          } catch (err) {
            console.error("Erreur lors de l'aperçu:", err);
          } finally {
            setLoadingPreview(false);
          }
        }
      }
    }
  };

  const sendEmail = async () => {
    if (!candidate) return;
    if (!subject || !body) {
      toast({ title: "Erreur", description: "Sujet et corps requis", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const payload = {
        candidate_id: candidate.id,
        application_id: candidate.application_id || null,
        subject,
        body,
      };

      const res = await fetch("http://localhost:5000/api/email-templates/send-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        toast({ title: "Email envoyé", description: `Le mail a été envoyé à ${candidate.email}` });
        onClose();
      } else {
        const err = await res.json();
        toast({ title: "Erreur", description: err.error || "Erreur lors de l'envoi", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Erreur", description: "Erreur de connexion", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <Mail className="h-5 w-5 text-indigo-500" />
            Envoyer un email à {candidate?.first_name} {candidate?.last_name}
          </DialogTitle>
          <p className="text-sm text-gray-500">{candidate?.email}</p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Sélectionner un template</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedTemplateId}
              onChange={handleTemplateChange}
              disabled={loading}
            >
              <option value="">-- Template personnalisé --</option>
              {templates.map((t) => (
                <option key={t.id_template} value={t.id_template}>
                  {t.name_template}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Sujet</Label>
            <div className="relative">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sujet de l'email"
                disabled={loadingPreview}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Corps de l'email</Label>
            <div className="relative">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="font-mono text-sm"
                placeholder="Contenu de l'email... Utilisez les variables {{ candidate_name }}, {{ job_title }}, etc."
                disabled={loadingPreview}
              />
              {loadingPreview && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-md z-10 backdrop-blur-[1px]">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
            Variables possibles: {`{{ candidate_name }}, {{ job_title }}, {{ match_score }}, etc.`}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={sendEmail} disabled={sending || !subject || !body} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
