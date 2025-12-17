import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, DollarSign, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { TripStatusBadge } from "@/components/TripStatusBadge";
import { cn } from "@/lib/utils";

interface TripCardProps {
  trip: {
    id: string;
    departure_location: string;
    arrival_location: string;
    departure_datetime: string;
    total_seats: number;
    available_seats: number;
    fuel_cost: number | null;
    status?: string;
    driver: {
      full_name: string;
    };
    participants: Array<{ passenger_id: string }>;
  };
  currentUserId: string;
  onClick: () => void;
  animationDelay?: number;
}

export const TripCard = ({ trip, currentUserId, onClick, animationDelay = 0 }: TripCardProps) => {
  const isJoined = trip.participants.some((p) => p.passenger_id === currentUserId);
  const isFull = trip.available_seats === 0;
  const confirmedPassengers = trip.total_seats - trip.available_seats;
  const perPersonCost = trip.fuel_cost ? trip.fuel_cost / (confirmedPassengers + 1) : 0;

  return (
    <Card
      className={cn(
        "group transition-all duration-300 animate-fade-up cursor-pointer touch-manipulation",
        "active:scale-[0.98] md:hover:scale-[1.02]",
        isFull 
          ? "opacity-75" 
          : "border-2 hover:border-primary/30 hover:shadow-xl"
      )}
      style={{ animationDelay: `${animationDelay}s` }}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <CardTitle className="text-lg md:text-xl group-hover:text-primary transition-colors truncate">
                {trip.departure_location.split(',')[0]} → {trip.arrival_location.split(',')[0]}
              </CardTitle>
              <TripStatusBadge
                departureDateTime={trip.departure_datetime}
                status={trip.status}
              />
            </div>
            <CardDescription className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full flex-shrink-0"></div>
              <span className="truncate">{trip.driver.full_name}</span>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant={isFull ? "secondary" : "default"}
              className="flex-shrink-0 text-xs"
            >
              {trip.available_seats}/{trip.total_seats}
            </Badge>
            <ChevronRight className="w-5 h-5 text-muted-foreground md:hidden" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Date - Always visible */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50">
          <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-medium text-sm">
            {format(new Date(trip.departure_datetime), "EEE, MMM d 'at' h:mm a")}
          </span>
        </div>

        {/* Locations - Collapsed on mobile */}
        <div className="hidden md:block space-y-2">
          <div className="flex items-center gap-2 px-2">
            <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-muted-foreground text-sm truncate">
              {trip.departure_location}
            </span>
          </div>
          <div className="flex items-center gap-2 px-2">
            <MapPin className="w-4 h-4 text-success flex-shrink-0" />
            <span className="text-muted-foreground text-sm truncate">
              {trip.arrival_location}
            </span>
          </div>
        </div>

        {/* Cost */}
        {trip.fuel_cost && (
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-success/5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
              <span className="text-sm text-muted-foreground">Your share:</span>
            </div>
            <span className="text-success font-bold text-lg">
              ${perPersonCost.toFixed(2)}
            </span>
          </div>
        )}

        {/* Action button */}
        <Button
          className="w-full min-h-[44px] text-base"
          variant={isJoined ? "outline" : isFull ? "secondary" : "default"}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {isJoined ? "✓ Joined - View Details" : isFull ? "Full - View Details" : "View & Join"}
        </Button>
      </CardContent>
    </Card>
  );
};
