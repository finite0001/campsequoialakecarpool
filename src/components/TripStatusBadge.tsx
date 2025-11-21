import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";

interface TripStatusBadgeProps {
  departureDateTime: string;
  status?: string;
  className?: string;
}

export const TripStatusBadge = ({ departureDateTime, status = "upcoming", className = "" }: TripStatusBadgeProps) => {
  const departureDate = new Date(departureDateTime);
  const now = new Date();
  const isToday = departureDate.toDateString() === now.toDateString();
  const isPast = departureDate < now;

  // Determine status
  let displayStatus = status;
  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let icon = <Clock className="w-3 h-3 mr-1" />;
  let label = "Upcoming";

  if (status === "cancelled") {
    displayStatus = "cancelled";
    variant = "destructive";
    icon = <XCircle className="w-3 h-3 mr-1" />;
    label = "Cancelled";
  } else if (isPast && status === "completed") {
    displayStatus = "completed";
    variant = "secondary";
    icon = <CheckCircle className="w-3 h-3 mr-1" />;
    label = "Completed";
  } else if (isToday) {
    displayStatus = "today";
    variant = "default";
    icon = <Clock className="w-3 h-3 mr-1" />;
    label = "Today";
  }

  return (
    <Badge variant={variant} className={`flex items-center ${className}`}>
      {icon}
      {label}
    </Badge>
  );
};
