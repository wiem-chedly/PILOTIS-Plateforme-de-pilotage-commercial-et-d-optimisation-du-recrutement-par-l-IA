import React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Linkedin, Link2, Bell } from "lucide-react";

export interface LinkedInAccount {
  id: number;
  name: string;
  email?: string;
  access_token: string;
  notify_by_email?: boolean;
}

interface ShareLinkedInDialogProps {
  show: boolean;
  onShowChange: (open: boolean) => void;
  generatedContent: string;
  setGeneratedContent: (val: string) => void;
  defaultFormUrl: string;
  commercialAccounts: LinkedInAccount[];
  selectedAccounts: number[];
  setSelectedAccounts: (val: number[]) => void;
  isNotifying: boolean;
  handleNotifyCommercials: () => void;
}

export const ShareLinkedInDialog: React.FC<ShareLinkedInDialogProps> = ({
  show,
  onShowChange,
  generatedContent,
  setGeneratedContent,
  defaultFormUrl,
  commercialAccounts,
  selectedAccounts,
  setSelectedAccounts,
  isNotifying,
  handleNotifyCommercials
}) => {
  return (
    <Dialog open={show} onOpenChange={(open) => {
      onShowChange(open);
      if (!open) setSelectedAccounts([]);
    }}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#0A66C2] to-[#004182] px-5 py-4">
          <DialogTitle className="text-white font-semibold flex items-center gap-2">
            <Linkedin className="h-4 w-4" />
            Envoyer aux commerciaux
          </DialogTitle>
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          <div className="border rounded-lg overflow-hidden bg-white">
            {generatedContent ? (
              <Textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="min-h-[200px] border-0 focus-visible:ring-0 p-4 bg-transparent resize-none text-sm"
                placeholder="Votre message..."
              />
            ) : (
              <div className="min-h-[200px] flex justify-center items-center bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-[#0A66C2] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Génération en cours...</span>
                </div>
              </div>
            )}
            <div className="bg-gray-50 px-4 py-2 border-t flex justify-end">
              <span className="text-xs text-gray-500">{(generatedContent || '').length} caractères</span>
            </div>
          </div>

          {/* ── Badge lien de candidature ── */}
          {defaultFormUrl && (
            <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-[#0A66C2]/8 border border-[#0A66C2]/20">
              <Link2 className="h-3.5 w-3.5 text-[#0A66C2] shrink-0" />
              <p className="text-xs text-[#0A66C2] font-medium flex-1 truncate">
                Lien candidature inclus : <span className="font-normal opacity-80">{defaultFormUrl}</span>
              </p>
            </div>
          )}

          {/* Sélection des commerciaux */}
          {commercialAccounts.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <label className="text-sm font-medium mb-2 block">
                Sélectionner les commerciaux à notifier :
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                {commercialAccounts.map((account) => (
                  <div key={account.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`account-${account.id}`}
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedAccounts([...selectedAccounts, account.id]);
                        } else {
                          setSelectedAccounts(selectedAccounts.filter(id => id !== account.id));
                        }
                      }}
                    />
                    <label htmlFor={`account-${account.id}`} className="text-sm cursor-pointer">
                      {account.name} {account.email && `<${account.email}>`}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t bg-gray-50 flex justify-end gap-2">
          <Button
            onClick={() => onShowChange(false)}
            className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
          >
            Annuler
          </Button>
          <Button
            onClick={handleNotifyCommercials}
            disabled={isNotifying || !generatedContent || selectedAccounts.length === 0}
            className="h-8 px-4 text-xs bg-[#0A66C2] hover:bg-[#004182] text-white gap-1"
          >
            {isNotifying ? (
              <><div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Envoi...</span></>
            ) : (
              <><Bell className="h-3 w-3" /><span>Publier ({selectedAccounts.length})</span></>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
