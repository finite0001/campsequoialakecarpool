/// <reference types="google.maps" />
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import campLogo from "@/assets/camp-logo.png";
import { z } from "zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import TripRouteMap from "@/components/TripRouteMap";
import { loadGoogleMapsScript } from "@/lib/maps";

// Validation schema for trip creation
const tripSchema = z.object({
  departure_location: z.string().trim().min(3, "Departure location must be at least 3 characters").max(200, "Departure location must be less than 200 characters"),
  arrival_location: z.string().trim().min(3, "Arrival location must be at least 3 characters").max(200, "Arrival location must be less than 200 characters"),
  route_description: z.string().max(1000, "Route description must be less than 1000 characters").optional(),
  departure_datetime: z.string().min(1, "Departure date and time is required"),
  total_seats: z.number().int().min(1, "Must have at least 1 seat").max(8, "Cannot exceed 8 seats"),
  fuel_cost: z.number().positive("Fuel cost must be positive").optional(),
});

const CreateTrip = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [departurePlace, setDeparturePlace] = useState<google.maps.places.PlaceResult>();
  const [arrivalPlace, setArrivalPlace] = useState<google.maps.places.PlaceResult>();
  const [formData, setFormData] = useState({
    departure_location: "",
    arrival_location: "Camp Sequoia Lake",
    route_description: "",
    departure_datetime: "",
    total_seats: 3,
    fuel_cost: "",
  });

  // Load Google Maps API
  useEffect(() => {
    const loadMaps = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-google-maps-key');
        if (error) throw error;
        
        if (data?.apiKey) {
          await loadGoogleMapsScript(data.apiKey);
          setMapsLoaded(true);
        } else {
          toast.error("Google Maps configuration missing");
        }
      } catch (error) {
        console.error("Failed to load Google Maps:", error);
        toast.error("Failed to load maps. Location features may be limited.");
      }
    };

    loadMaps();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare data for validation
    const tripData = {
      departure_location: formData.departure_location,
      arrival_location: formData.arrival_location,
      route_description: formData.route_description || undefined,
      departure_datetime: formData.departure_datetime,
      total_seats: formData.total_seats,
      fuel_cost: formData.fuel_cost ? parseFloat(formData.fuel_cost) : undefined,
    };

    // Validate with zod
    const validation = tripSchema.safeParse(tripData);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      const validatedData = validation.data;

      const { error } = await supabase.from("trips").insert({
        driver_id: session.user.id,
        departure_location: validatedData.departure_location,
        arrival_location: validatedData.arrival_location,
        route_description: validatedData.route_description || null,
        departure_datetime: validatedData.departure_datetime,
        total_seats: validatedData.total_seats,
        available_seats: validatedData.total_seats,
        fuel_cost: validatedData.fuel_cost || null,
      });

      if (error) {
        if (error.message?.includes('driver_documents') || error.message?.includes('verification')) {
          toast.error("You must upload and get approved for driver documents before creating trips");
          navigate("/dashboard");
        } else {
          toast.error("Unable to create trip. Please try again.");
        }
        return;
      }

      toast.success("Trip created successfully!");
      navigate("/my-trips");
    } catch (error: any) {
      toast.error("Unable to create trip. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
              <h1 className="text-xl font-bold text-nav-foreground">Create Trip</h1>
              <p className="text-sm text-nav-foreground/80">Offer a ride to camp</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-nav-foreground hover:bg-nav-foreground/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="border-2 hover:shadow-xl transition-all duration-300 animate-fade-in">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl">Create New Trip</CardTitle>
            <CardDescription className="text-base">
              Offer a ride to Camp Sequoia Lake and share the journey with fellow staff members
            </CardDescription>
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

                  <TripRouteMap
                    departureLocation={departurePlace}
                    arrivalLocation={arrivalPlace}
                  />
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="departure" className="text-base font-medium">Departure Location *</Label>
                    <Input
                      id="departure"
                      value={formData.departure_location}
                      onChange={(e) =>
                        setFormData({ ...formData, departure_location: e.target.value })
                      }
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
                      onChange={(e) =>
                        setFormData({ ...formData, arrival_location: e.target.value })
                      }
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
                  onChange={(e) =>
                    setFormData({ ...formData, route_description: e.target.value })
                  }
                  placeholder="Describe your planned route, any stops, or special instructions..."
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
                  onChange={(e) =>
                    setFormData({ ...formData, departure_datetime: e.target.value })
                  }
                  required
                  className="h-11"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="seats" className="text-base font-medium">Available Seats *</Label>
                  <Input
                    id="seats"
                    type="number"
                    min="1"
                    max="8"
                    value={formData.total_seats}
                    onChange={(e) =>
                      setFormData({ ...formData, total_seats: parseInt(e.target.value) })
                    }
                    required
                    className="h-11"
                  />
                  <p className="text-sm text-muted-foreground">
                    How many passengers can you take?
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cost" className="text-base font-medium">Total Fuel Cost (Optional)</Label>
                  <Input
                    id="cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.fuel_cost}
                    onChange={(e) =>
                      setFormData({ ...formData, fuel_cost: e.target.value })
                    }
                    placeholder="0.00"
                    className="h-11"
                  />
                  <p className="text-sm text-muted-foreground">
                    Passengers coordinate payment
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium hover:scale-[1.02] transition-transform" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Trip...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Create Trip
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

export default CreateTrip;
