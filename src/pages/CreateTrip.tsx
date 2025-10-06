import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";

const CreateTrip = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    departure_location: "",
    arrival_location: "Camp Sequoia Lake",
    route_description: "",
    departure_datetime: "",
    total_seats: 3,
    fuel_cost: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.departure_location || !formData.arrival_location || !formData.departure_datetime) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.total_seats < 1) {
      toast.error("Must have at least 1 available seat");
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

      const { error } = await supabase.from("trips").insert({
        driver_id: session.user.id,
        departure_location: formData.departure_location,
        arrival_location: formData.arrival_location,
        route_description: formData.route_description || null,
        departure_datetime: formData.departure_datetime,
        total_seats: formData.total_seats,
        available_seats: formData.total_seats,
        fuel_cost: formData.fuel_cost ? parseFloat(formData.fuel_cost) : null,
      });

      if (error) throw error;

      toast.success("Trip created successfully!");
      navigate("/my-trips");
    } catch (error: any) {
      console.error("Error creating trip:", error);
      toast.error("Failed to create trip");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Trip</CardTitle>
            <CardDescription>
              Offer a ride to Camp Sequoia Lake and share the journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="departure">Departure Location *</Label>
                <Input
                  id="departure"
                  value={formData.departure_location}
                  onChange={(e) =>
                    setFormData({ ...formData, departure_location: e.target.value })
                  }
                  placeholder="e.g., Los Angeles, CA"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="arrival">Arrival Location *</Label>
                <Input
                  id="arrival"
                  value={formData.arrival_location}
                  onChange={(e) =>
                    setFormData({ ...formData, arrival_location: e.target.value })
                  }
                  placeholder="e.g., Camp Sequoia Lake"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="route">Route Description (Optional)</Label>
                <Textarea
                  id="route"
                  value={formData.route_description}
                  onChange={(e) =>
                    setFormData({ ...formData, route_description: e.target.value })
                  }
                  placeholder="Describe your planned route, any stops, or special instructions..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="datetime">Departure Date & Time *</Label>
                <Input
                  id="datetime"
                  type="datetime-local"
                  value={formData.departure_datetime}
                  onChange={(e) =>
                    setFormData({ ...formData, departure_datetime: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats">Available Seats *</Label>
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
                />
                <p className="text-sm text-muted-foreground">
                  How many passengers can you take?
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cost">Total Fuel Cost (Optional)</Label>
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
                />
                <p className="text-sm text-muted-foreground">
                  Passengers can coordinate payment directly with you
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
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
