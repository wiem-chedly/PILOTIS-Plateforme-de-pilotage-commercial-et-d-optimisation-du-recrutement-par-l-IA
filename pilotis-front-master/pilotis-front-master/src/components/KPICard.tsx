import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface KPICardProps {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  up?: boolean;
  icon: LucideIcon;
  index?: number;
}

const KPICard = ({ title, value, trend, trendLabel, up, icon: Icon, index = 0 }: KPICardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className="border-none shadow-md hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-3xl font-bold text-foreground">{value}</p>
              {trend !== undefined && (
                <div className={`flex items-center gap-1 text-sm font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
                  {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{up ? "+" : ""}{trendLabel || `${trend}%`}</span>
                </div>
              )}
            </div>
            <div className="rounded-xl bg-primary/10 p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default KPICard;