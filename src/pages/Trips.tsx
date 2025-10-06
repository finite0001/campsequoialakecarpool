import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Car } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";

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

      // Check if already joined
      const { data: existing } = await supabase
        .from("trip_participants")
        .select("*")
        .eq("trip_id", tripId)
        .eq("passenger_id", session.user.id)
        .maybeSingle();

      if (existing) {
        toast.error("You've already joined this trip");
        return;
      }

      // Add participant
      const { error: participantError } = await supabase
        .from("trip_participants")
        .insert({
          trip_id: tripId,
          passenger_id: session.user.id,
        });

      if (participantError) throw participantError;

      // Update available seats
      const { error: updateError } = await supabase
        .from("trips")
        .update({ available_seats: availableSeats - 1 })
        .eq("id", tripId);

      if (updateError) throw updateError;

      toast.success("Successfully joined the trip!");
      loadTrips();
    } catch (error: any) {
      console.error("Error joining trip:", error);
      toast.error("Failed to join trip");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading trips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-10 w-auto"
            />
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Available Trips</h1>
          <p className="text-muted-foreground">Browse and join upcoming carpools to Camp Sequoia Lake</p>
        </div>

        {trips.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Car className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No trips available</h3>
              <p className="text-muted-foreground">Check back later or create your own trip if you're a driver</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {trips.map((trip) => {
              const isJoined = trip.participants.some(
                (p) => p.passenger_id === currentUserId
              );
              const isFull = trip.available_seats === 0;

              return (
                <Card key={trip.id} className={isFull ? "opacity-75" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">
                          {trip.departure_location} → {trip.arrival_location}
                        </CardTitle>
                        <CardDescription>Driven by {trip.driver.full_name}</CardDescription>
                      </div>
                      <Badge variant={isFull ? "secondary" : "default"}>
                        {trip.available_seats}/{trip.total_seats} seats
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(trip.departure_datetime), "PPP 'at' p")}
                        </span>
                      </div>

                      {trip.route_description && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>{trip.route_description}</span>
                        </div>
                      )}

                      {trip.fuel_cost && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          <span>Total fuel cost: ${trip.fuel_cost.toFixed(2)}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{trip.participants.length} passenger(s) joined</span>
                      </div>
                    </div>

                    {isJoined ? (
                      <Badge variant="outline" className="w-full justify-center py-2">
                        You've joined this trip
                      </Badge>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => handleJoinTrip(trip.id, trip.available_seats)}
                        disabled={isFull}
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
