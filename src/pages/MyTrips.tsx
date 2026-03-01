import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Trash2, ExternalLink, Share2, Phone, Mail, XCircle, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";
import { getGoogleMapsUrl, getGoogleMapsDirectionsUrl, copyToClipboard } from "@/lib/maps";
import { TripStatusBadge } from "@/components/TripStatusBadge";
import { MobileNavigation } from "@/components/MobileNavigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
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
  driver_id: string;
  driver: {
    full_name: string;
    email: string;
    phone?: string;
  };
  participants: Array<{
    id: string;
    passenger_id: string;
    passenger: {
      full_name: string;
      email: string;
      phone?: string;
    };
  }>;
}

const MyTrips = () => {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasVerifiedDocuments, setHasVerifiedDocuments] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; tripId: string }>({ open: false, tripId: "" });
  const [cancelConfirm, setCancelConfirm] = useState<{ open: boolean; tripId: string }>({ open: false, tripId: "" });
  const [checkins, setCheckins] = useState<Record<string, string[]>>({});

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

      // Get user roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = userRoles?.map(r => r.role) || [];
      const isDriver = roles.includes("driver");
      setUserRole(isDriver ? "driver" : "passenger");
      setIsAdmin(roles.includes("admin"));

      if (isDriver) {
        const { data: docs } = await supabase
          .from("driver_documents")
          .select("verification_status")
          .eq("driver_id", session.user.id)
          .eq("verification_status", "approved")
          .maybeSingle();
        setHasVerifiedDocuments(!!docs);
      }

      let fetchedTrips: any[] = [];

      if (isDriver) {
        // Load trips as driver
        const { data: driverTrips, error } = await supabase
          .from("trips")
          .select(`
            *,
            driver:profiles!trips_driver_id_fkey(full_name, email, phone),
            participants:trip_participants(
              id,
              passenger_id,
              passenger:profiles!trip_participants_passenger_id_fkey(full_name, email, phone)
            )
          `)
          .eq("driver_id", session.user.id)
          .order("departure_datetime", { ascending: true });

        if (error) throw error;
        fetchedTrips = driverTrips as any;
      } else {
        // Load trips as passenger
        const { data: participantData, error } = await supabase
          .from("trip_participants")
          .select(`
            trip:trips(
              *,
              driver:profiles!trips_driver_id_fkey(full_name, email, phone),
              participants:trip_participants(
                id,
                passenger_id,
                passenger:profiles!trip_participants_passenger_id_fkey(full_name, email, phone)
              )
            )
          `)
          .eq("passenger_id", session.user.id);

        if (error) throw error;
        fetchedTrips = participantData.map((p: any) => p.trip) as any;
      }

      setTrips(fetchedTrips);

      // Fetch check-ins for all trips
      const tripIds = fetchedTrips.map((t: any) => t.id).filter(Boolean);
      if (tripIds.length > 0) {
        const { data: checkinsData } = await supabase
          .from("trip_checkins")
          .select("trip_id, user_id")
          .in("trip_id", tripIds);

        const checkinsMap: Record<string, string[]> = {};
        (checkinsData || []).forEach((c: any) => {
          if (!checkinsMap[c.trip_id]) checkinsMap[c.trip_id] = [];
          checkinsMap[c.trip_id].push(c.user_id);
        });
        setCheckins(checkinsMap);
      } else {
        setCheckins({});
      }
    } catch (error: any) {
      toast.error("Unable to load trips. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleRefresh = useCallback(async () => {
    await loadTrips(false);
    toast.success("Trips refreshed");
  }, [loadTrips]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

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
      toast.error("Unable to leave trip. Please try again.");
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    try {
      const { error } = await supabase
        .from("trips")
        .update({ status: "cancelled" })
        .eq("id", tripId);

      if (error) throw error;

      toast.success("Trip cancelled — passengers have been notified via the app");
      loadTrips();
    } catch (error: any) {
      toast.error("Unable to cancel trip. Please try again.");
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    try {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);

      if (error) throw error;

      toast.success("Trip deleted successfully");
      loadTrips();
    } catch (error: any) {
      toast.error("Unable to delete trip. Please try again.");
    }
  };

  const handleCheckIn = async (tripId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.from("trip_checkins").insert({
        trip_id: tripId,
        user_id: session.user.id,
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
      });

      if (error) throw error;

      setCheckins(prev => ({
        ...prev,
        [tripId]: [...(prev[tripId] || []), session.user.id],
      }));

      toast.success("Checked in! See you at the departure point.");
    } catch (error: any) {
      toast.error("Unable to check in. Please try again.");
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
    <>
    <ConfirmDialog
      open={cancelConfirm.open}
      onOpenChange={(open) => setCancelConfirm({ ...cancelConfirm, open })}
      onConfirm={() => handleCancelTrip(cancelConfirm.tripId)}
      title="Cancel This Trip?"
      description="This will mark the trip as cancelled. Passengers will see it as cancelled in their My Trips list. You can delete it later to remove it entirely."
      confirmText="Yes, Cancel Trip"
    />
    <ConfirmDialog
      open={deleteConfirm.open}
      onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
      onConfirm={() => handleDeleteTrip(deleteConfirm.tripId)}
      title="Delete Trip?"
      description="Are you sure you want to delete this trip? All passengers will lose their seats and this cannot be undone."
      confirmText="Delete Trip"
      variant="destructive"
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
              <h1 className="text-lg md:text-xl font-bold text-nav-foreground">My Trips</h1>
              <p className="text-xs md:text-sm text-nav-foreground/80 hidden sm:block">Your carpool schedule</p>
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
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-1 md:mb-2">My Trips</h1>
          <p className="text-sm md:text-base text-muted-foreground">
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
              const confirmedPassengers = trip.total_seats - trip.available_seats;
              const perPersonCost = trip.fuel_cost ? trip.fuel_cost / (confirmedPassengers + 1) : 0;
              const now = new Date();
              const departure = new Date(trip.departure_datetime);
              const hoursUntil = (departure.getTime() - now.getTime()) / (1000 * 60 * 60);
              const isDepartureSoon = hoursUntil <= 24 && hoursUntil >= -4 && trip.status !== "cancelled";
              const tripCheckins = new Set(checkins[trip.id] || []);
              const isCheckedIn = tripCheckins.has(currentUserId);
              const checkedInPassengerCount = trip.participants.filter(p => tripCheckins.has(p.passenger_id)).length;

              return (
                <Card 
                  key={trip.id}
                  className="hover:shadow-xl transition-all duration-300 animate-fade-up border-2 hover:border-primary/30"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <CardTitle className="text-xl">
                            {trip.departure_location} → {trip.arrival_location}
                          </CardTitle>
                          <TripStatusBadge 
                            departureDateTime={trip.departure_datetime}
                            status={trip.status}
                          />
                        </div>
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
                        <div className="space-y-1">
                          <div className="flex items-center justify-between p-3 rounded-lg bg-success/5">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-success flex-shrink-0" />
                              <span className="text-sm font-medium">Your share:</span>
                            </div>
                            <span className="text-success font-bold text-xl">
                              ${perPersonCost.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground text-right px-2">
                            Total cost: ${trip.fuel_cost.toFixed(2)} ÷ {confirmedPassengers + 1} people
                          </div>
                        </div>
                      )}
                    </div>

                    {!isDriver && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Driver Contact
                        </h4>
                        <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{trip.driver.full_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <a href={`mailto:${trip.driver.email}`} className="hover:text-primary">
                              {trip.driver.email}
                            </a>
                          </div>
                          {trip.driver.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <a href={`tel:${trip.driver.phone}`} className="hover:text-primary">
                                {trip.driver.phone}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {trip.participants.length > 0 && isDriver && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          Passengers ({trip.participants.length})
                          {isDepartureSoon && trip.participants.length > 0 && (
                            <span className="text-xs text-muted-foreground font-normal ml-auto">
                              {checkedInPassengerCount}/{trip.participants.length} checked in
                            </span>
                          )}
                        </h4>
                        <div className="space-y-2">
                          {trip.participants.map((participant) => (
                            <div
                              key={participant.id}
                              className="text-sm p-3 rounded-lg bg-muted/50"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{participant.passenger.full_name}</span>
                                {tripCheckins.has(participant.passenger_id) && (
                                  <Badge variant="outline" className="text-success border-success text-xs">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    Checked in
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mail className="w-3 h-3" />
                                <a href={`mailto:${participant.passenger.email}`} className="hover:text-primary">
                                  {participant.passenger.email}
                                </a>
                              </div>
                              {participant.passenger.phone && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <Phone className="w-3 h-3" />
                                  <a href={`tel:${participant.passenger.phone}`} className="hover:text-primary">
                                    {participant.passenger.phone}
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {isDriver ? (
                        trip.status === "cancelled" ? (
                          <Button
                            variant="destructive"
                            onClick={() => setDeleteConfirm({ open: true, tripId: trip.id })}
                            className="flex-1"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Trip
                          </Button>
                        ) : (
                          <>
                            {isDepartureSoon && !isCheckedIn && (
                              <Button
                                className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                                onClick={() => handleCheckIn(trip.id)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Check In
                              </Button>
                            )}
                            {isDepartureSoon && isCheckedIn && (
                              <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md bg-success/10 text-success text-sm font-medium">
                                <CheckCircle2 className="w-4 h-4" />
                                You're checked in
                              </div>
                            )}
                            <Button
                              variant="outline"
                              className="flex-1"
                              onClick={() => navigate(`/edit-trip/${trip.id}`)}
                            >
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 border-warning text-warning hover:bg-warning/10"
                              onClick={() => setCancelConfirm({ open: true, tripId: trip.id })}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirm({ open: true, tripId: trip.id })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )
                      ) : myParticipation ? (
                        <>
                          {isDepartureSoon && !isCheckedIn && (
                            <Button
                              className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                              onClick={() => handleCheckIn(trip.id)}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Check In
                            </Button>
                          )}
                          {isDepartureSoon && isCheckedIn && (
                            <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md bg-success/10 text-success text-sm font-medium">
                              <CheckCircle2 className="w-4 h-4" />
                              You're checked in
                            </div>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => handleLeaveTrip(trip.id, myParticipation.id)}
                            className="flex-1"
                          >
                            Leave Trip
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
      </PullToRefresh>

      <MobileNavigation
        isDriver={userRole === "driver"}
        isAdmin={isAdmin}
        hasVerifiedDocuments={hasVerifiedDocuments}
      />
    </div>
    </>
  );
};

export default MyTrips;
