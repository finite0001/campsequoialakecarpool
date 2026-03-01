import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Car, Filter } from "lucide-react";
import { toast } from "sonner";
import campLogo from "@/assets/camp-logo.png";
import { SearchBar } from "@/components/SearchBar";
import { EmptyState } from "@/components/EmptyState";
import { TripDetailsDialog } from "@/components/TripDetailsDialog";
import { SkeletonTripCard } from "@/components/SkeletonCard";
import { FilterSelect } from "@/components/FilterSelect";
import { TripCard } from "@/components/TripCard";
import { MobileNavigation } from "@/components/MobileNavigation";
import { PullToRefresh } from "@/components/PullToRefresh";

interface Trip {
  id: string;
  departure_location: string;
  arrival_location: string;
  route_description: string | null;
  departure_datetime: string;
  total_seats: number;
  available_seats: number;
  fuel_cost: number | null;
  status?: string;
  distance_text?: string;
  duration_text?: string;
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
  const [isDriver, setIsDriver] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasVerifiedDocuments, setHasVerifiedDocuments] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [seatsFilter, setSeatsFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  useEffect(() => {
    loadTrips();
  }, []);

  const loadTrips = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const driverRole = roles.includes("driver");
      setIsDriver(driverRole);
      setIsAdmin(roles.includes("admin"));

      if (driverRole) {
        const { data: docs } = await supabase
          .from("driver_documents")
          .select("verification_status")
          .eq("driver_id", session.user.id)
          .eq("verification_status", "approved")
          .maybeSingle();
        setHasVerifiedDocuments(!!docs);
      }

      const { data: tripsData, error } = await supabase
        .from("trips")
        .select(`
          *,
          driver:profiles!trips_driver_id_fkey(full_name, email),
          participants:trip_participants(passenger_id)
        `)
        .gte("departure_datetime", new Date().toISOString())
        .neq("status", "cancelled")
        .order("departure_datetime", { ascending: true });

      if (error) throw error;

      setTrips(tripsData as any);
    } catch (error: any) {
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleTripClick = useCallback((trip: Trip) => {
    setSelectedTrip(trip);
    setDetailsDialogOpen(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    await loadTrips(false);
    toast.success("Trips refreshed");
  }, [loadTrips]);

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
      toast.error("Failed to join trip");
    }
  };

  // Filter trips based on search and filters
  const filteredTrips = useMemo(() => trips.filter(trip => {
    const matchesSearch = searchQuery === "" ||
      trip.departure_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.arrival_location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trip.driver.full_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeats = seatsFilter === "all" ||
      (seatsFilter === "available" && trip.available_seats > 0) ||
      (seatsFilter === "full" && trip.available_seats === 0);

    const tripDate = new Date(trip.departure_datetime);
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const matchesDate = dateFilter === "all" ||
      (dateFilter === "today" && tripDate < todayEnd) ||
      (dateFilter === "week" && tripDate < weekEnd);

    return matchesSearch && matchesSeats && matchesDate;
  }), [trips, searchQuery, seatsFilter, dateFilter]);

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
      />
    <div className="min-h-screen bg-background">
      <header className="border-b border-nav/20 bg-nav shadow-md">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-8 md:h-10 w-auto"
            />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-nav-foreground">Browse Trips</h1>
              <p className="text-xs md:text-sm text-nav-foreground/80 hidden sm:block">Find your carpool</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-nav-foreground hover:bg-nav-foreground/10 hidden md:flex">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <PullToRefresh onRefresh={handleRefresh} className="min-h-[calc(100vh-4rem)]">
        <main className="container mx-auto px-4 py-4 md:py-8 pb-mobile-nav">
          <div className="mb-4 md:mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">Available Trips</h1>
            <p className="text-sm md:text-base text-muted-foreground">Pull down to refresh • Browse and join carpools</p>
          </div>

          <div className="mb-6 space-y-4">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by location or driver..."
            />
            <div className="grid grid-cols-2 gap-3">
              <FilterSelect
                value={dateFilter}
                onChange={setDateFilter}
                options={[
                  { value: "all", label: "All Dates" },
                  { value: "today", label: "Today" },
                  { value: "week", label: "This Week" }
                ]}
                placeholder="Filter by date"
              />
              <FilterSelect
                value={seatsFilter}
                onChange={setSeatsFilter}
                options={[
                  { value: "all", label: "All Trips" },
                  { value: "available", label: "Has Seats" },
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
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              {filteredTrips.map((trip, index) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  currentUserId={currentUserId}
                  onClick={() => handleTripClick(trip)}
                  animationDelay={index * 0.05}
                />
              ))}
            </div>
          )}
        </main>
      </PullToRefresh>

      <MobileNavigation
        isDriver={isDriver}
        isAdmin={isAdmin}
        hasVerifiedDocuments={hasVerifiedDocuments}
      />
    </div>
    </>
  );
};

export default Trips;
