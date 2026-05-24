import { motion } from "framer-motion";
import { BikeRoute } from "@/lib/routes-data";
import { useI18n } from "@/lib/i18n";
import { MapPin, Flag, FlagTriangleRight } from "lucide-react";

const RouteInstructions = ({ route }: { route: BikeRoute }) => {
  const { t } = useI18n();

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <div className="space-y-0">
        {route.points.map((point, i) => {
          const isFirst = i === 0;
          const isLast = i === route.points.length - 1;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4"
            >
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isFirst ? "bg-olive text-olive-foreground" :
                  isLast ? "bg-terracotta text-terracotta-foreground" :
                  "bg-primary text-primary-foreground"
                }`}>
                  {isFirst ? <Flag className="w-4 h-4" /> :
                   isLast ? <FlagTriangleRight className="w-4 h-4" /> :
                   <MapPin className="w-4 h-4" />}
                </div>
                {!isLast && <div className="w-0.5 h-full min-h-[40px] bg-border" />}
              </div>

              <div className="pb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {isFirst ? t("start") : isLast ? t("arrival") : `${t("step")} ${i}`}
                </p>
                <p className="text-foreground font-medium mt-0.5">
                  {point.instruction || `${t("point")} ${i + 1}`}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteInstructions;
