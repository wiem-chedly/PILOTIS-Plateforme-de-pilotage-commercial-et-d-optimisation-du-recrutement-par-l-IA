import DashboardLayout from "@/components/DashboardLayout";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
}

const PlaceholderPage = ({ title }: PlaceholderPageProps) => (
  <DashboardLayout title={title}>
    <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
      <Construction className="h-16 w-16 mb-4 text-primary/40" />
      <h2 className="text-xl font-semibold mb-2">Bientôt disponible</h2>
      <p className="text-sm">Cette fonctionnalité sera disponible dans une prochaine version.</p>
    </div>
  </DashboardLayout>
);

export default PlaceholderPage;
