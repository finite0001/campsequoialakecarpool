import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, DollarSign, Car, ExternalLink, Share2 } from "lucide-react";
import { format } from "date-fns";
import { getGoogleMapsUrl, getGoogleMapsDirectionsUrl, copyToClipboard } from "@/lib/maps";
import { toast } from "sonner";
import { TripStatusBadge } from "@/components/TripStatusBadge";

interface TripDetailsDialogProps {
  trip: {
    id: string;
    departure_location: string;
    arrival_location: string;
    route_description: string | null;
    departure_datetime: string;
    total_seats: number;
    available_seats: number;
    fuel_cost: number | null;
    status?: string;
    driver: {
      full_name: string;
      email: string;
    };
    participants: Array<{
      passenger_id: string;
    }>;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: () => void;
  isJoined: boolean;
  currentUserId: string;
}

export const TripDetailsDialog = ({
  trip,
  open,
  onOpenChange,
  onJoin,
  isJoined,
}: TripDetailsDialogProps) => {
  if (!trip) return null;

  const isFull = trip.available_seats === 0;
  const confirmedPassengers = trip.total_seats - trip.available_seats;
  const perPersonCost = trip.fuel_cost ? trip.fuel_cost / (confirmedPassengers + 1) : 0;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Trip Details"
      description="Review trip information before joining"
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        {/* Status badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <TripStatusBadge
            departureDateTime={trip.departure_datetime}
            status={trip.status}
          />
          <Badge variant={isFull ? "secondary" : "default"}>
            {trip.available_seats}/{trip.total_seats} seats
          </Badge>
        </div>

        {/* Locations */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm mb-1">Departure</p>
              <p className="text-muted-foreground text-sm break-words">{trip.departure_location}</p>
              <a
                href={getGoogleMapsUrl(trip.departure_location)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent hover:underline inline-flex items-center gap-1 mt-1 min-h-[44px] py-2"
              >
                View on map <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <MapPin className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm mb-1">Arrival</p>
              <p className="text-muted-foreground text-sm break-words">{trip.arrival_location}</p>
              <a
                href={getGoogleMapsUrl(trip.arrival_location)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-success hover:underline inline-flex items-center gap-1 mt-1 min-h-[44px] py-2"
              >
                View on map <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full min-h-[44px]"
            onClick={async () => {
              const directionsUrl = getGoogleMapsDirectionsUrl(
                trip.departure_location,
                trip.arrival_location
              );
              await copyToClipboard(directionsUrl);
              toast.success("Directions link copied!");
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Directions
          </Button>
        </div>

        {/* Time */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Departure Time</p>
            <p className="text-muted-foreground text-sm">
              {format(new Date(trip.departure_datetime), "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        </div>

        {/* Route description */}
        {trip.route_description && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/5">
            <Car className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-sm mb-1">Route Details</p>
              <p className="text-muted-foreground text-sm">{trip.route_description}</p>
            </div>
          </div>
        )}

        {/* Driver */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Driver</p>
            <p className="text-muted-foreground text-sm">{trip.driver.full_name}</p>
            <p className="text-xs text-muted-foreground">{trip.driver.email}</p>
          </div>
        </div>

        {/* Cost */}
        {trip.fuel_cost && (
          <div className="p-3 rounded-lg bg-success/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success flex-shrink-0" />
                <p className="font-medium text-sm">Your Share</p>
              </div>
              <p className="text-success text-xl font-bold">${perPersonCost.toFixed(2)}</p>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2">
              Total: ${trip.fuel_cost.toFixed(2)} ÷ {confirmedPassengers + 1} people
            </div>
          </div>
        )}

        {/* Passengers count */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div>
            <p className="font-medium text-sm">Passengers</p>
            <p className="text-muted-foreground text-sm">
              {trip.participants.length} of {trip.total_seats} seats filled
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2 border-t sticky bottom-0 bg-background pb-safe">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="flex-1 min-h-[48px]"
          >
            Close
          </Button>
          {isJoined ? (
            <Button 
              variant="outline" 
              className="flex-1 min-h-[48px] border-success text-success" 
              disabled
            >
              ✓ Already Joined
            </Button>
          ) : (
            <Button
              onClick={() => {
                onJoin();
                onOpenChange(false);
              }}
              disabled={isFull}
              className="flex-1 min-h-[48px]"
            >
              {isFull ? "Trip Full" : "Join Trip"}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
};
