/// <reference types="google.maps" />
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Fuel } from "lucide-react";
import campLogo from "@/assets/camp-logo.png";
import { z } from "zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import TripRouteMap from "@/components/TripRouteMap";
import { loadGoogleMapsScript } from "@/lib/maps";

const VEHICLE_TYPES = {
  suv: { label: "SUV / Truck", mpg: 18, icon: "🚙" },
  sedan: { label: "Sedan / Compact", mpg: 28, icon: "🚗" },
  hybrid: { label: "Hybrid / Electric", mpg: 45, icon: "⚡" },
} as const;

type VehicleType = keyof typeof VEHICLE_TYPES;

const tripSchema = z.object({
  departure_location: z.string().trim().min(3, "Departure location must be at least 3 characters").max(200),
  arrival_location: z.string().trim().min(3, "Arrival location must be at least 3 characters").max(200),
  route_description: z.string().max(1000).optional(),
  departure_datetime: z.string().min(1, "Departure date and time is required"),
  total_seats: z.number().int().min(1, "Must have at least 1 seat").max(8, "Cannot exceed 8 seats"),
  fuel_cost: z.number().positive("Fuel cost must be positive").optional(),
});

// Convert UTC ISO string from DB to local datetime-local input value
const toLocalDatetimeInput = (isoString: string): string => {
  const date = new Date(isoString);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const EditTrip = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [confirmedPassengers, setConfirmedPassengers] = useState(0);

  const [departurePlace, setDeparturePlace] = useState<google.maps.places.PlaceResult>();
  const [arrivalPlace, setArrivalPlace] = useState<google.maps.places.PlaceResult>();
  const [tripDistance, setTripDistance] = useState<string>("");
  const [tripDuration, setTripDuration] = useState<string>("");
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("sedan");
  const [isManualFuelCost, setIsManualFuelCost] = useState(false);

  const [formData, setFormData] = useState({
    departure_location: "",
    arrival_location: "",
    route_description: "",
    departure_datetime: "",
    total_seats: 3,
    fuel_cost: "",
  });

  const loadMaps = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-google-maps-key");
      if (error || !data?.apiKey) return;
      await loadGoogleMapsScript(data.apiKey);
      setMapsLoaded(true);
    } catch {
      // Fall back to plain text inputs
    }
  }, []);

  useEffect(() => {
    const loadTrip = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          navigate("/auth");
          return;
        }

        const { data: trip, error } = await supabase
          .from("trips")
          .select("*, participants:trip_participants(passenger_id)")
          .eq("id", id)
          .eq("driver_id", session.user.id)
          .maybeSingle();

        if (error) {
          toast.error("Unable to load trip. Please try again.");
          navigate("/my-trips");
          return;
        }

        if (!trip) {
          toast.error("Trip not found or you don't have permission to edit it");
          navigate("/my-trips");
          return;
        }

        const booked = trip.total_seats - trip.available_seats;
        setConfirmedPassengers(booked);

        setFormData({
          departure_location: trip.departure_location,
          arrival_location: trip.arrival_location,
          route_description: trip.route_description ?? "",
          departure_datetime: toLocalDatetimeInput(trip.departure_datetime),
          total_seats: trip.total_seats,
          fuel_cost: trip.fuel_cost != null ? String(trip.fuel_cost) : "",
        });

        if (trip.distance_text) setTripDistance(trip.distance_text);
        if (trip.duration_text) setTripDuration(trip.duration_text);
      } catch {
        toast.error("Unable to load trip. Please try again.");
        navigate("/my-trips");
      } finally {
        setLoading(false);
      }
    };

    loadTrip();
    loadMaps();
  }, [id, navigate, loadMaps]);

  // Recalculate route when both places selected
  useEffect(() => {
    const calculateRoute = async () => {
      if (!departurePlace?.geometry?.location || !arrivalPlace?.geometry?.location || !mapsLoaded) return;

      setCalculatingRoute(true);
      try {
        const service = new google.maps.DistanceMatrixService();
        const result = await service.getDistanceMatrix({
          origins: [departurePlace.geometry.location],
          destinations: [arrivalPlace.geometry.location],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.IMPERIAL,
        });

        if (result.rows[0]?.elements[0]?.status === "OK") {
          const el = result.rows[0].elements[0];
          setTripDistance(el.distance?.text || "");
          setTripDuration(el.duration?.text || "");
        }
      } catch {
        // Keep previous values
      } finally {
        setCalculatingRoute(false);
      }
    };
    calculateRoute();
  }, [departurePlace, arrivalPlace, mapsLoaded]);

  // Auto-estimate fuel cost when distance/vehicle changes
  useEffect(() => {
    if (!tripDistance || isManualFuelCost) return;
    const miles = parseFloat(tripDistance.replace(/[^0-9.]/g, ""));
    if (!miles || isNaN(miles)) return;
    const cost = Math.round((miles / VEHICLE_TYPES[vehicleType].mpg) * 3.5 * 100) / 100;
    setFormData((prev) => ({ ...prev, fuel_cost: cost.toFixed(2) }));
  }, [tripDistance, vehicleType, isManualFuelCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = {
      departure_location: formData.departure_location,
      arrival_location: formData.arrival_location,
      route_description: formData.route_description || undefined,
      departure_datetime: formData.departure_datetime,
      total_seats: formData.total_seats,
      fuel_cost: formData.fuel_cost ? parseFloat(formData.fuel_cost) : undefined,
    };

    const validation = tripSchema.safeParse(parsed);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (parsed.total_seats < confirmedPassengers) {
      toast.error(`Can't reduce seats below ${confirmedPassengers} — that's how many passengers have already joined`);
      return;
    }

    setSaving(true);
    try {
      const newAvailableSeats = parsed.total_seats - confirmedPassengers;

      const updatePayload: Record<string, unknown> = {
        departure_location: validation.data.departure_location,
        arrival_location: validation.data.arrival_location,
        route_description: validation.data.route_description || null,
        departure_datetime: validation.data.departure_datetime,
        total_seats: validation.data.total_seats,
        available_seats: newAvailableSeats,
        fuel_cost: validation.data.fuel_cost ?? null,
      };

      if (tripDistance) updatePayload.distance_text = tripDistance;
      if (tripDuration) updatePayload.duration_text = tripDuration;

      const { error } = await supabase.from("trips").update(updatePayload).eq("id", id);

      if (error) throw error;

      toast.success("Trip updated successfully");
      navigate("/my-trips");
    } catch {
      toast.error("Unable to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="h-16 w-16 mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-lg font-semibold mb-2">Loading trip...</h3>
        </div>
      </div>
    );
  }

  const minSeats = Math.max(1, confirmedPassengers);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-nav/20 bg-nav shadow-md">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <img src={campLogo} alt="Camp Sequoia Lake Logo" className="h-8 md:h-10 w-auto" />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-nav-foreground">Edit Trip</h1>
              <p className="text-xs md:text-sm text-nav-foreground/80 hidden sm:block">Update your trip details</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/my-trips")}
            className="text-nav-foreground hover:bg-nav-foreground/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden md:inline">My Trips</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8 max-w-2xl pb-8">
        {confirmedPassengers > 0 && (
          <Alert className="mb-6 border-warning bg-warning/5">
            <AlertTitle className="text-warning">Passengers already on board</AlertTitle>
            <AlertDescription>
              {confirmedPassengers} passenger{confirmedPassengers !== 1 ? "s have" : " has"} joined this trip.
              You cannot reduce the seat count below {confirmedPassengers}.
              Consider letting passengers know via email if you make significant changes.
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-2 animate-fade-in">
          <CardHeader>
            <CardTitle className="text-2xl">Trip Details</CardTitle>
            <CardDescription>Update the information below and save your changes</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {mapsLoaded ? (
                <>
                  <LocationAutocomplete
                    id="departure"
                    label="Departure Location"
                    value={formData.departure_location}
                    onChange={(value, place) => {
                      setFormData({ ...formData, departure_location: value });
                      if (place) setDeparturePlace(place);
                    }}
                    placeholder="e.g., Los Angeles, CA"
                    required
                  />
                  <LocationAutocomplete
                    id="arrival"
                    label="Arrival Location"
                    value={formData.arrival_location}
                    onChange={(value, place) => {
                      setFormData({ ...formData, arrival_location: value });
                      if (place) setArrivalPlace(place);
                    }}
                    placeholder="e.g., Camp Sequoia Lake"
                    required
                  />
                  {(tripDistance || tripDuration || calculatingRoute) && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-6">
                        {calculatingRoute ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm">Calculating route…</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            {tripDistance && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Distance</p>
                                <p className="text-2xl font-bold text-primary">{tripDistance}</p>
                              </div>
                            )}
                            {tripDuration && (
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">Travel Time</p>
                                <p className="text-2xl font-bold text-accent">{tripDuration}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                  <TripRouteMap departureLocation={departurePlace} arrivalLocation={arrivalPlace} />
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="departure" className="text-base font-medium">Departure Location *</Label>
                    <Input
                      id="departure"
                      value={formData.departure_location}
                      onChange={(e) => setFormData({ ...formData, departure_location: e.target.value })}
                      onFocus={() => { if (!mapsLoaded) loadMaps(); }}
                      placeholder="e.g., Los Angeles, CA"
                      required
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival" className="text-base font-medium">Arrival Location *</Label>
                    <Input
                      id="arrival"
                      value={formData.arrival_location}
                      onChange={(e) => setFormData({ ...formData, arrival_location: e.target.value })}
                      onFocus={() => { if (!mapsLoaded) loadMaps(); }}
                      placeholder="e.g., Camp Sequoia Lake"
                      required
                      className="h-11"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="route" className="text-base font-medium">Route Description (Optional)</Label>
                <Textarea
                  id="route"
                  value={formData.route_description}
                  onChange={(e) => setFormData({ ...formData, route_description: e.target.value })}
                  placeholder="Describe your planned route, any stops, or special instructions…"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="datetime" className="text-base font-medium">Departure Date & Time *</Label>
                <Input
                  id="datetime"
                  type="datetime-local"
                  value={formData.departure_datetime}
                  onChange={(e) => setFormData({ ...formData, departure_datetime: e.target.value })}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-base font-medium">
                  <Fuel className="w-5 h-5 text-primary" />
                  <span>Seats & Fuel Cost</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle-type" className="text-sm font-medium">Vehicle Type</Label>
                  <Select
                    value={vehicleType}
                    onValueChange={(v: VehicleType) => { setVehicleType(v); setIsManualFuelCost(false); }}
                  >
                    <SelectTrigger id="vehicle-type" className="h-11">
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VEHICLE_TYPES) as VehicleType[]).map((type) => (
                        <SelectItem key={type} value={type}>
                          <span className="flex items-center gap-2">
                            <span>{VEHICLE_TYPES[type].icon}</span>
                            <span>{VEHICLE_TYPES[type].label}</span>
                            <span className="text-muted-foreground text-sm">({VEHICLE_TYPES[type].mpg} MPG)</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="seats" className="text-sm font-medium">Total Seats *</Label>
                    <Input
                      id="seats"
                      type="number"
                      min={minSeats}
                      max="8"
                      value={formData.total_seats}
                      onChange={(e) => setFormData({ ...formData, total_seats: parseInt(e.target.value) || minSeats })}
                      required
                      className="h-11"
                    />
                    {confirmedPassengers > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Min {minSeats} — {confirmedPassengers} seat{confirmedPassengers !== 1 ? "s" : ""} already booked
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cost" className="text-sm font-medium">Total Fuel Cost</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fuel_cost}
                      onChange={(e) => { setFormData({ ...formData, fuel_cost: e.target.value }); setIsManualFuelCost(true); }}
                      placeholder="0.00"
                      className="h-11"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-medium hover:scale-[1.02] transition-transform"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default EditTrip;
