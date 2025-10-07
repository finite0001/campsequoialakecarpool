import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Car, ExternalLink, Share2, Filter } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";
import { getGoogleMapsUrl, getGoogleMapsDirectionsUrl, copyToClipboard } from "@/lib/maps";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { TripDetailsDialog } from "@/components/TripDetailsDialog";
import { SkeletonTripCard } from "@/components/SkeletonCard";
import { FilterSelect } from "@/components/FilterSelect";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [seatsFilter, setSeatsFilter] = useState("all");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

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

  // Filter trips based on search and filters
  const filteredTrips = trips.filter(trip => {
    const matchesSearch = searchQuery === "" || 
      trip.departure_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.arrival_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.driver.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeats = seatsFilter === "all" ||
      (seatsFilter === "available" && trip.available_seats > 0) ||
      (seatsFilter === "full" && trip.available_seats === 0);
    
    return matchesSearch && matchesSeats;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-nav/20 bg-nav shadow-md">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={campLogo} alt="Camp Sequoia Lake Logo" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-nav-foreground">Browse Trips</h1>
                <p className="text-sm text-nav-foreground/80">Loading...</p>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-6">
            <SkeletonTripCard />
            <SkeletonTripCard />
            <SkeletonTripCard />
            <SkeletonTripCard />
          </div>
        </main>
      </div>
    );
  }

  return (
    <>
      <TripDetailsDialog
        trip={selectedTrip}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        onJoin={() => {
          if (selectedTrip) {
            handleJoinTrip(selectedTrip.id, selectedTrip.available_seats);
          }
        }}
        isJoined={selectedTrip ? selectedTrip.participants.some(p => p.passenger_id === currentUserId) : false}
        currentUserId={currentUserId}
      />
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Available Trips</h1>
          <p className="text-muted-foreground">Browse and join upcoming carpools to Camp Sequoia Lake</p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by location or driver..."
              />
            </div>
            <FilterSelect
              value={seatsFilter}
              onChange={setSeatsFilter}
              options={[
                { value: "all", label: "All Trips" },
                { value: "available", label: "Available Seats" },
                { value: "full", label: "Full Trips" }
              ]}
              placeholder="Filter by seats"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            Showing {filteredTrips.length} of {trips.length} trips
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <EmptyState
            icon={Car}
            title={trips.length === 0 ? "No trips available yet" : "No trips match your filters"}
            description={trips.length === 0 
              ? "Check back later or create your own trip if you're a verified driver"
              : "Try adjusting your search or filter criteria"}
            actionLabel="Back to Dashboard"
            onAction={() => navigate("/dashboard")}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {filteredTrips.map((trip, index) => {
              const isJoined = trip.participants.some(
                (p) => p.passenger_id === currentUserId
              );
              const isFull = trip.available_seats === 0;

              return (
                <Card 
                  key={trip.id} 
                  className={`group hover:shadow-xl transition-all duration-300 animate-fade-up cursor-pointer ${
                    isFull ? "opacity-75" : "hover:scale-[1.02] border-2 hover:border-primary/30"
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => {
                    setSelectedTrip(trip);
                    setDetailsDialogOpen(true);
                  }}
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

                      <div className="flex items-center gap-2 p-2">
                        <MapPin className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {trip.departure_location}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 p-2">
                        <MapPin className="w-4 h-4 text-success flex-shrink-0" />
                        <span className="text-muted-foreground truncate">
                          {trip.arrival_location}
                        </span>
                      </div>

                      {trip.fuel_cost && (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-success/5">
                          <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
                          <span className="text-success font-medium">
                            ${trip.fuel_cost.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinTrip(trip.id, trip.available_seats);
                      }}
                      disabled={isFull || isJoined}
                      variant={isJoined ? "outline" : isFull ? "secondary" : "default"}
                    >
                      {isJoined ? "✓ Joined" : isFull ? "Trip Full" : "View Details"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
    </>
  );
};

export default Trips;
