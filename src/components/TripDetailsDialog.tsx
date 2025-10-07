import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, DollarSign, Car, ExternalLink, Share2 } from "lucide-react";
import { format } from "date-fns";
import { getGoogleMapsUrl, getGoogleMapsDirectionsUrl, copyToClipboard } from "@/lib/maps";
import { toast } from "sonner";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center justify-between">
            <span>Trip Details</span>
            <Badge variant={isFull ? "secondary" : "default"}>
              {trip.available_seats}/{trip.total_seats} seats
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review trip information before joining
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <MapPin className="w-5 h-5 text-accent mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium mb-1">Departure</p>
                <p className="text-muted-foreground">{trip.departure_location}</p>
                <a
                  href={getGoogleMapsUrl(trip.departure_location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-accent hover:underline inline-flex items-center gap-1 mt-1"
                >
                  View on map <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <MapPin className="w-5 h-5 text-success mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium mb-1">Arrival</p>
                <p className="text-muted-foreground">{trip.arrival_location}</p>
                <a
                  href={getGoogleMapsUrl(trip.arrival_location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-success hover:underline inline-flex items-center gap-1 mt-1"
                >
                  View on map <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
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

          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5">
            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium">Departure Time</p>
              <p className="text-muted-foreground">
                {format(new Date(trip.departure_datetime), "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          {trip.route_description && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/5">
              <Car className="w-5 h-5 text-accent mt-1 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">Route Details</p>
                <p className="text-muted-foreground">{trip.route_description}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Driver</p>
              <p className="text-muted-foreground">{trip.driver.full_name}</p>
              <p className="text-sm text-muted-foreground">{trip.driver.email}</p>
            </div>
          </div>

          {trip.fuel_cost && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-success/5">
              <DollarSign className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="font-medium">Total Fuel Cost</p>
                <p className="text-success text-lg">${trip.fuel_cost.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">
                  Cost per passenger: ${(trip.fuel_cost / (trip.total_seats - trip.available_seats + 1)).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-medium">Passengers</p>
              <p className="text-muted-foreground">
                {trip.participants.length} of {trip.total_seats} seats filled
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Close
          </Button>
          {isJoined ? (
            <Button variant="outline" className="flex-1 border-success text-success" disabled>
              ✓ Already Joined
            </Button>
          ) : (
            <Button
              onClick={() => {
                onJoin();
                onOpenChange(false);
              }}
              disabled={isFull}
              className="flex-1"
            >
              {isFull ? "Trip Full" : "Join This Trip"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
