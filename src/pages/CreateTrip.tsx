/// <reference types="google.maps" />
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Car, Fuel } from "lucide-react";
import campLogo from "@/assets/camp-logo.png";
import { z } from "zod";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import TripRouteMap from "@/components/TripRouteMap";
import { loadGoogleMapsScript } from "@/lib/maps";
import { VEHICLE_TYPES, type VehicleType } from "@/lib/constants";

// Regional gas price averages by US state — update periodically at https://gasprices.aaa.com/state-gas-price-averages/
const STATE_GAS_PRICES: Record<string, { price: number; region: string }> = {
  // West Coast (Higher prices)
  CA: { price: 4.85, region: "California" },
  WA: { price: 4.25, region: "Washington" },
  OR: { price: 4.15, region: "Oregon" },
  HI: { price: 4.95, region: "Hawaii" },
  AK: { price: 4.20, region: "Alaska" },
  NV: { price: 4.10, region: "Nevada" },
  AZ: { price: 3.65, region: "Arizona" },
  // Mountain West
  CO: { price: 3.45, region: "Colorado" },
  UT: { price: 3.55, region: "Utah" },
  NM: { price: 3.35, region: "New Mexico" },
  WY: { price: 3.45, region: "Wyoming" },
  MT: { price: 3.50, region: "Montana" },
  ID: { price: 3.65, region: "Idaho" },
  // Midwest (Lower prices)
  TX: { price: 2.95, region: "Texas" },
  OK: { price: 2.85, region: "Oklahoma" },
  KS: { price: 2.95, region: "Kansas" },
  NE: { price: 3.15, region: "Nebraska" },
  SD: { price: 3.25, region: "South Dakota" },
  ND: { price: 3.30, region: "North Dakota" },
  MN: { price: 3.25, region: "Minnesota" },
  IA: { price: 3.10, region: "Iowa" },
  MO: { price: 2.90, region: "Missouri" },
  AR: { price: 2.95, region: "Arkansas" },
  LA: { price: 2.90, region: "Louisiana" },
  MS: { price: 2.85, region: "Mississippi" },
  // Great Lakes
  IL: { price: 3.65, region: "Illinois" },
  WI: { price: 3.25, region: "Wisconsin" },
  MI: { price: 3.45, region: "Michigan" },
  IN: { price: 3.25, region: "Indiana" },
  OH: { price: 3.30, region: "Ohio" },
  // Southeast
  FL: { price: 3.35, region: "Florida" },
  GA: { price: 3.15, region: "Georgia" },
  SC: { price: 3.05, region: "South Carolina" },
  NC: { price: 3.15, region: "North Carolina" },
  VA: { price: 3.25, region: "Virginia" },
  WV: { price: 3.35, region: "West Virginia" },
  KY: { price: 3.20, region: "Kentucky" },
  TN: { price: 3.05, region: "Tennessee" },
  AL: { price: 3.00, region: "Alabama" },
  // Northeast (Higher prices)
  NY: { price: 3.65, region: "New York" },
  PA: { price: 3.55, region: "Pennsylvania" },
  NJ: { price: 3.45, region: "New Jersey" },
  CT: { price: 3.55, region: "Connecticut" },
  MA: { price: 3.50, region: "Massachusetts" },
  RI: { price: 3.45, region: "Rhode Island" },
  VT: { price: 3.55, region: "Vermont" },
  NH: { price: 3.40, region: "New Hampshire" },
  ME: { price: 3.50, region: "Maine" },
  MD: { price: 3.45, region: "Maryland" },
  DE: { price: 3.35, region: "Delaware" },
  DC: { price: 3.55, region: "Washington D.C." },
};

const DEFAULT_GAS_PRICE = { price: 3.50, region: "National Average" };

// Helper to extract state from Google Places result
const getStateFromPlace = (place: google.maps.places.PlaceResult | undefined): { price: number; region: string } => {
  if (!place?.address_components) return DEFAULT_GAS_PRICE;
  
  const stateComponent = place.address_components.find(
    (component) => component.types.includes("administrative_area_level_1")
  );
  
  if (stateComponent?.short_name && STATE_GAS_PRICES[stateComponent.short_name]) {
    return STATE_GAS_PRICES[stateComponent.short_name];
  }
  
  return DEFAULT_GAS_PRICE;
};

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
  const [tripDistance, setTripDistance] = useState<string>("");
  const [tripDuration, setTripDuration] = useState<string>("");
  const [calculatingRoute, setCalculatingRoute] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>("sedan");
  const [estimatedFuelCost, setEstimatedFuelCost] = useState<number | null>(null);
  const [isManualFuelCost, setIsManualFuelCost] = useState(false);
  const [gasPriceInfo, setGasPriceInfo] = useState(DEFAULT_GAS_PRICE);
  const [formData, setFormData] = useState({
    departure_location: "",
    arrival_location: "Camp Sequoia Lake",
    route_description: "",
    departure_datetime: "",
    total_seats: 3,
    fuel_cost: "",
  });

  // Load Google Maps API
  const loadMaps = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-google-maps-key');
      if (error) {
        toast.error("Failed to load maps configuration");
        return;
      }
      if (data?.apiKey) {
        await loadGoogleMapsScript(data.apiKey);
        setMapsLoaded(true);
        toast.success("Google Maps loaded");
      } else {
        toast.error("Google Maps API key not configured");
      }
    } catch (error) {
      toast.error("Failed to load maps. Using basic location input.");
    }
  }, []);

  useEffect(() => {
    loadMaps();
  }, [loadMaps]);

  // Calculate distance and duration when both locations are selected
  useEffect(() => {
    const calculateRoute = async () => {
      if (!departurePlace?.geometry?.location || !arrivalPlace?.geometry?.location || !mapsLoaded) {
        setTripDistance("");
        setTripDuration("");
        return;
      }

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
          const element = result.rows[0].elements[0];
          setTripDistance(element.distance?.text || "");
          setTripDuration(element.duration?.text || "");
        } else {
          setTripDistance("");
          setTripDuration("");
        }
      } catch (error) {
        setTripDistance("");
        setTripDuration("");
      } finally {
        setCalculatingRoute(false);
      }
    };

    calculateRoute();
  }, [departurePlace, arrivalPlace, mapsLoaded]);

  // Calculate estimated fuel cost when distance, vehicle type, or departure location changes
  useEffect(() => {
    // Update gas price based on departure location
    const priceInfo = getStateFromPlace(departurePlace);
    setGasPriceInfo(priceInfo);
    
    if (!tripDistance || isManualFuelCost) return;
    
    const distanceMiles = parseFloat(tripDistance.replace(/[^0-9.]/g, ''));
    if (!distanceMiles || isNaN(distanceMiles)) {
      setEstimatedFuelCost(null);
      return;
    }
    
    const mpg = VEHICLE_TYPES[vehicleType].mpg;
    const gallonsNeeded = distanceMiles / mpg;
    const cost = gallonsNeeded * priceInfo.price;
    const roundedCost = Math.round(cost * 100) / 100;
    
    setEstimatedFuelCost(roundedCost);
    setFormData(prev => ({ ...prev, fuel_cost: roundedCost.toFixed(2) }));
  }, [tripDistance, vehicleType, isManualFuelCost, departurePlace]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate distance data if not already calculated
    let distanceData: any = {};
    if (tripDistance && tripDuration) {
      const distanceMiles = parseFloat(tripDistance.replace(/[^0-9.]/g, ''));
      const durationMinutes = parseInt(tripDuration.replace(/[^0-9]/g, ''));
      
      distanceData = {
        distance_text: tripDistance,
        duration_text: tripDuration,
        distance_miles: distanceMiles || null,
        duration_minutes: durationMinutes || null,
      };
    }

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
        ...distanceData,
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

                  {(tripDistance || tripDuration || calculatingRoute) && (
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="pt-6">
                        {calculatingRoute ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm">Calculating route...</span>
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

                  <TripRouteMap
                    departureLocation={departurePlace}
                    arrivalLocation={arrivalPlace}
                  />
                </>
              ) : (
                <>
                  <Alert>
                    <AlertTitle>Google Maps not active</AlertTitle>
                    <AlertDescription>
                      Autocomplete and map will appear once Google Maps loads.
                      <Button type="button" size="sm" variant="outline" className="ml-2" onClick={loadMaps}>
                        Retry loading Maps
                      </Button>
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label htmlFor="departure" className="text-base font-medium">Departure Location *</Label>
                    <Input
                      id="departure"
                      value={formData.departure_location}
                      onChange={(e) =>
                        setFormData({ ...formData, departure_location: e.target.value })
                      }
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
                      onChange={(e) =>
                        setFormData({ ...formData, arrival_location: e.target.value })
                      }
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

              {/* Vehicle Type & Fuel Cost Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-base font-medium">
                  <Fuel className="w-5 h-5 text-primary" />
                  <span>Fuel Cost Estimation</span>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vehicle-type" className="text-sm font-medium">Vehicle Type</Label>
                  <Select
                    value={vehicleType}
                    onValueChange={(value: VehicleType) => {
                      setVehicleType(value);
                      setIsManualFuelCost(false);
                    }}
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
                    <Label htmlFor="seats" className="text-sm font-medium">Available Seats *</Label>
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
                    <p className="text-xs text-muted-foreground">
                      How many passengers can you take?
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="cost" className="text-sm font-medium">Total Fuel Cost</Label>
                      {estimatedFuelCost !== null && !isManualFuelCost && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Estimated
                        </span>
                      )}
                    </div>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fuel_cost}
                      onChange={(e) => {
                        setFormData({ ...formData, fuel_cost: e.target.value });
                        setIsManualFuelCost(true);
                      }}
                      placeholder="0.00"
                      className="h-11"
                    />
                    {tripDistance && estimatedFuelCost !== null && (
                      <p className="text-xs text-muted-foreground">
                        Based on {tripDistance} at {VEHICLE_TYPES[vehicleType].mpg} MPG × ${gasPriceInfo.price.toFixed(2)}/gal ({gasPriceInfo.region})
                      </p>
                    )}
                  </div>
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
