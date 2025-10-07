import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Car, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";
import { getGoogleMapsUrl, getGoogleMapsDirectionsUrl, copyToClipboard } from "@/lib/maps";

interface Trip {
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
}

const Trips = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: tripsData, error } = await supabase
        .from("trips")
        .select(`
          *,
          driver:profiles!trips_driver_id_fkey(full_name, email),
          participants:trip_participants(passenger_id)
        `)
        .gte("departure_datetime", new Date().toISOString())
        .order("departure_datetime", { ascending: true });

      if (error) throw error;

      setTrips(tripsData as any);
    } catch (error: any) {
      console.error("Error loading trips:", error);
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTrip = async (tripId: string, availableSeats: number) => {
    if (availableSeats === 0) {
      toast.error("This trip is full");
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // Add participant - trigger handles seat decrement atomically
      const { error: participantError } = await supabase
        .from("trip_participants")
        .insert({
          trip_id: tripId,
          passenger_id: session.user.id,
        });

      if (participantError) {
        if (participantError.message?.includes('Trip is full')) {
          toast.error("This trip is full");
        } else if (participantError.message?.includes('unique_passenger_trip')) {
          toast.error("You've already joined this trip");
        } else {
          toast.error("Failed to join trip");
        }
        return;
      }

      toast.success("Successfully joined the trip!");
      loadTrips();
    } catch (error: any) {
      console.error("Error joining trip:", error);
      toast.error("Failed to join trip");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="h-16 w-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Loading trips...</h3>
          <p className="text-sm text-muted-foreground">Finding available carpools</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-nav/20 bg-nav shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold text-nav-foreground">Browse Trips</h1>
              <p className="text-sm text-nav-foreground/80">Find your carpool</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-nav-foreground hover:bg-nav-foreground/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Available Trips</h1>
          <p className="text-muted-foreground">Browse and join upcoming carpools to Camp Sequoia Lake</p>
        </div>

        {trips.length === 0 ? (
          <Card className="border-2 border-dashed animate-fade-in">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
                <Car className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No trips available yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Check back later or create your own trip if you're a verified driver
              </p>
              <Button onClick={() => navigate("/dashboard")} variant="outline">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {trips.map((trip, index) => {
              const isJoined = trip.participants.some(
                (p) => p.passenger_id === currentUserId
              );
              const isFull = trip.available_seats === 0;

              return (
                <Card 
                  key={trip.id} 
                  className={`group hover:shadow-xl transition-all duration-300 animate-fade-up ${
                    isFull ? "opacity-75" : "hover:scale-[1.02] border-2 hover:border-primary/30"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2 group-hover:text-primary transition-colors">
                          {trip.departure_location} → {trip.arrival_location}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-success rounded-full"></div>
                          Driven by {trip.driver.full_name}
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={isFull ? "secondary" : "default"}
                        className="flex-shrink-0"
                      >
                        {trip.available_seats}/{trip.total_seats} seats
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                        <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="font-medium">
                          {format(new Date(trip.departure_datetime), "PPP 'at' p")}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={getGoogleMapsUrl(trip.departure_location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/10 transition-colors flex-1 group/link"
                          >
                            <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                            <span className="text-muted-foreground group-hover/link:text-accent transition-colors">
                              From: {trip.departure_location}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={getGoogleMapsUrl(trip.arrival_location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-success/10 transition-colors flex-1 group/link"
                          >
                            <MapPin className="w-4 h-4 text-success flex-shrink-0" />
                            <span className="text-muted-foreground group-hover/link:text-success transition-colors">
                              To: {trip.arrival_location}
                            </span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                          </a>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={async () => {
                            const directionsUrl = getGoogleMapsDirectionsUrl(
                              trip.departure_location,
                              trip.arrival_location
                            );
                            await copyToClipboard(directionsUrl);
                            toast.success("Directions link copied to clipboard!");
                          }}
                        >
                          <Share2 className="w-3 h-3 mr-2" />
                          Share Directions
                        </Button>
                      </div>

                      {trip.route_description && (
                        <div className="flex items-start gap-3 p-2 border-t pt-3">
                          <MapPin className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{trip.route_description}</span>
                        </div>
                      )}

                      {trip.fuel_cost && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-success/5">
                          <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
                          <span className="text-success font-medium">
                            Total fuel cost: ${trip.fuel_cost.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 p-2">
                        <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">
                          {trip.participants.length} passenger(s) joined
                        </span>
                      </div>
                    </div>

                    {isJoined ? (
                      <Badge variant="outline" className="w-full justify-center py-3 border-success text-success">
                        ✓ You've joined this trip
                      </Badge>
                    ) : (
                      <Button
                        className="w-full group-hover:scale-[1.02] transition-transform"
                        onClick={() => handleJoinTrip(trip.id, trip.available_seats)}
                        disabled={isFull}
                        variant={isFull ? "secondary" : "default"}
                      >
                        {isFull ? "Trip Full" : "Join This Trip"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Trips;
