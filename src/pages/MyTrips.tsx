import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Trash2 } from "lucide-react";
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
  driver_id: string;
  driver: {
    full_name: string;
  };
  participants: Array<{
    id: string;
    passenger_id: string;
    passenger: {
      full_name: string;
      email: string;
    };
  }>;
}

const MyTrips = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");

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

      // Get user roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isDriver = roles.includes("driver");
      setUserRole(isDriver ? "driver" : "passenger");

      if (isDriver) {
        // Load trips as driver
        const { data: driverTrips, error } = await supabase
          .from("trips")
          .select(`
            *,
            driver:profiles!trips_driver_id_fkey(full_name),
            participants:trip_participants(
              id,
              passenger_id,
              passenger:profiles!trip_participants_passenger_id_fkey(full_name, email)
            )
          `)
          .eq("driver_id", session.user.id)
          .order("departure_datetime", { ascending: true });

        if (error) throw error;
        setTrips(driverTrips as any);
      } else {
        // Load trips as passenger
        const { data: participantData, error } = await supabase
          .from("trip_participants")
          .select(`
            trip:trips(
              *,
              driver:profiles!trips_driver_id_fkey(full_name),
              participants:trip_participants(
                id,
                passenger_id,
                passenger:profiles!trip_participants_passenger_id_fkey(full_name, email)
              )
            )
          `)
          .eq("passenger_id", session.user.id);

        if (error) throw error;
        setTrips(participantData.map((p: any) => p.trip) as any);
      }
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading trips:", error);
      }
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveTrip = async (tripId: string, participantId: string) => {
    try {
      // Remove participant - trigger handles seat increment atomically
      const { error: deleteError } = await supabase
        .from("trip_participants")
        .delete()
        .eq("id", participantId);

      if (deleteError) throw deleteError;

      toast.success("Left the trip successfully");
      loadTrips();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error leaving trip:", error);
      }
      toast.error("Failed to leave trip");
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm("Are you sure you want to delete this trip?")) {
      return;
    }

    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);

      if (error) throw error;

      toast.success("Trip deleted successfully");
      loadTrips();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error deleting trip:", error);
      }
      toast.error("Failed to delete trip");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your trips...</p>
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
          <h1 className="text-3xl font-bold mb-2">My Trips</h1>
          <p className="text-muted-foreground">
            {userRole === "driver"
              ? "Manage trips you're driving"
              : "View trips you've joined"}
          </p>
        </div>

        {trips.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium mb-2">No trips yet</h3>
              <p className="text-muted-foreground mb-4">
                {userRole === "driver"
                  ? "Create your first trip to start carpooling"
                  : "Browse available trips to join"}
              </p>
              <Button onClick={() => navigate(userRole === "driver" ? "/create-trip" : "/trips")}>
                {userRole === "driver" ? "Create Trip" : "Browse Trips"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {trips.map((trip) => {
              const isDriver = trip.driver_id === currentUserId;
              const myParticipation = trip.participants.find(
                (p) => p.passenger_id === currentUserId
              );

              return (
                <Card key={trip.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">
                          {trip.departure_location} → {trip.arrival_location}
                        </CardTitle>
                        <CardDescription>
                          {isDriver ? "You're driving" : `Driver: ${trip.driver.full_name}`}
                        </CardDescription>
                      </div>
                      <Badge>
                        {trip.available_seats}/{trip.total_seats} seats available
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
                    </div>

                    {trip.participants.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Passengers ({trip.participants.length})
                        </h4>
                        <div className="space-y-1">
                          {trip.participants.map((participant) => (
                            <div
                              key={participant.id}
                              className="text-sm text-muted-foreground flex items-center justify-between"
                            >
                              <span>
                                {participant.passenger.full_name} ({participant.passenger.email})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {isDriver ? (
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteTrip(trip.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Trip
                        </Button>
                      ) : myParticipation ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            handleLeaveTrip(trip.id, myParticipation.id)
                          }
                        >
                          Leave Trip
                        </Button>
                      ) : null}
                    </div>
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

export default MyTrips;
