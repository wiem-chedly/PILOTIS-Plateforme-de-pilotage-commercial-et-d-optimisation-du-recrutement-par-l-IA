import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

interface Validation {
  id: number;
  uuid: string;
  post_content: string;
  status: string;
  opportunity: {
    id: number;
    titre: string;
    client: string;
  };
  account_email?: string;
  created_at: string;
}

export default function ValidationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [validation, setValidation] = useState<Validation | null>(null);
  const [modifiedPost, setModifiedPost] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadValidation(id);
    }
  }, [id]);

  const loadValidation = async (validationId: string) => {
    try {
      const res = await fetch(`http://localhost:5000/api/validations/${validationId}`);
      if (!res.ok) throw new Error("Erreur chargement");
      const data = await res.json();
      setValidation(data);
      setModifiedPost(data.post_content);
    } catch (err) {
      console.error(err);
      toast({
        title: "Erreur",
        description: "Impossible de charger la validation",
        variant: "destructive"
      });
    }
  };

  const handlePublish = async () => {
    setLoading(true);
    try {
      // 1. Sauvegarder les modifications
      const saveRes = await fetch(`http://localhost:5000/api/validations/${id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modified_post: modifiedPost })
      });
      if (!saveRes.ok) {
        throw new Error("Erreur lors de la sauvegarde");
      }

      // 2. Publier sur LinkedIn
      const publishRes = await fetch(`http://localhost:5000/api/validations/${id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_post: modifiedPost })
      });
      const data = await publishRes.json();
      if (data.success) {
        toast({
          title: "✅ Publié avec succès !",
          description: "Le post a été partagé sur votre LinkedIn"
        });
        setTimeout(() => navigate('/appels-offres'), 2000);
      } else {
        throw new Error(data.error || "Erreur de publication");
      }
    } catch (err) {
      toast({
        title: "❌ Erreur",
        description: err instanceof Error ? err.message : "Échec de la publication",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!validation) {
    return (
      <DashboardLayout title="Validation">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Valider le post LinkedIn">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{validation.opportunity.titre}</CardTitle>
            <p className="text-xs text-gray-500">{validation.opportunity.client}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">
                Post LinkedIn
              </label>
              <Textarea
                value={modifiedPost}
                onChange={(e) => setModifiedPost(e.target.value)}
                className="min-h-[200px] font-mono text-xs"
                placeholder="Le post généré apparaîtra ici..."
              />
            </div>

            {/* Bouton aligné à gauche */}
            <div className="flex justify-start pt-2">
              <Button
                onClick={handlePublish}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-1 h-7 px-3 text-xs"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Send className="h-3 w-3" />
                    Publier
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
