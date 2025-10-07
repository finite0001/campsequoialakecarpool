import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Trash2, ExternalLink, Share2 } from "lucide-react";
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="relative">
            <div className="h-16 w-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Loading your trips...</h3>
          <p className="text-sm text-muted-foreground">Gathering your carpool information</p>
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
              <h1 className="text-xl font-bold text-nav-foreground">My Trips</h1>
              <p className="text-sm text-nav-foreground/80">Your carpool schedule</p>
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
          <h1 className="text-3xl font-bold mb-2">My Trips</h1>
          <p className="text-muted-foreground">
            {userRole === "driver"
              ? "Manage trips you're driving"
              : "View trips you've joined"}
          </p>
        </div>

        {trips.length === 0 ? (
          <Card className="border-2 border-dashed animate-fade-in">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No trips yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {userRole === "driver"
                  ? "Ready to start carpooling? Create your first trip and help others get to camp!"
                  : "Join a trip to start your carpooling journey with fellow staff members"}
              </p>
              <Button 
                onClick={() => navigate(userRole === "driver" ? "/create-trip" : "/trips")}
                size="lg"
                className="hover:scale-105 transition-transform"
              >
                {userRole === "driver" ? "Create Your First Trip" : "Browse Available Trips"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {trips.map((trip, index) => {
              const isDriver = trip.driver_id === currentUserId;
              const myParticipation = trip.participants.find(
                (p) => p.passenger_id === currentUserId
              );

              return (
                <Card 
                  key={trip.id}
                  className="hover:shadow-xl transition-all duration-300 animate-fade-up border-2 hover:border-primary/30"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">
                          {trip.departure_location} → {trip.arrival_location}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          {isDriver ? (
                            <>
                              <div className="w-2 h-2 bg-primary rounded-full"></div>
                              You're driving this trip
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-accent rounded-full"></div>
                              Driver: {trip.driver.full_name}
                            </>
                          )}
                        </CardDescription>
                      </div>
                      <Badge className={isDriver ? "bg-primary" : ""}>
                        {trip.available_seats}/{trip.total_seats} seats available
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
                    </div>

                    {trip.participants.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Passengers ({trip.participants.length})
                        </h4>
                        <div className="space-y-2">
                          {trip.participants.map((participant) => (
                            <div
                              key={participant.id}
                              className="text-sm flex items-center justify-between p-2 rounded-lg bg-muted/50"
                            >
                              <div>
                                <span className="font-medium">{participant.passenger.full_name}</span>
                                <span className="text-muted-foreground ml-2">({participant.passenger.email})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      {isDriver ? (
                        <Button
                          variant="destructive"
                          onClick={() => handleDeleteTrip(trip.id)}
                          className="flex-1"
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
                          className="flex-1"
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
