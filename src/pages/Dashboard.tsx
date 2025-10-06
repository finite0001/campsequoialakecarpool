import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Car, Users, Plus, Shield, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import campLogo from "@/assets/camp-logo.png";

interface Profile {
  id: string;
  email: string;
  full_name: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [hasVerifiedDocuments, setHasVerifiedDocuments] = useState(false);
  const [hasAcknowledgedLiability, setHasAcknowledgedLiability] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Check user roles
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = userRoles?.map(r => r.role) || [];
      setIsAdmin(roles.includes("admin"));
      setIsDriver(roles.includes("driver"));

      // Check if driver has documents
      if (roles.includes("driver")) {
        const { data: docs } = await supabase
          .from("driver_documents")
          .select("*")
          .eq("driver_id", session.user.id)
          .maybeSingle();

        setHasVerifiedDocuments(!!docs);
      }

      // Check liability acknowledgment
      const { data: liability } = await supabase
        .from("liability_acknowledgments")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();

      setHasAcknowledgedLiability(!!liability);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleAcknowledgeLiability = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) return;

      const { error } = await supabase
        .from("liability_acknowledgments")
        .insert({ user_id: session.user.id });

      if (error) throw error;

      setHasAcknowledgedLiability(true);
      toast.success("Liability release acknowledged");
    } catch (error: any) {
      console.error("Error acknowledging liability:", error);
      toast.error("Failed to acknowledge liability release");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold">Camp Sequoia Lake</h1>
              <p className="text-sm text-muted-foreground">Carpool Coordinator</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Welcome, {profile?.full_name}!</h2>
          <div className="flex items-center gap-2">
            <Badge variant={isDriver ? "default" : "secondary"}>
              {isDriver ? "Driver" : "Passenger"}
            </Badge>
            {isAdmin && (
              <Badge variant="outline" className="border-accent text-accent">
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
        </div>

        {!hasAcknowledgedLiability && (
          <Card className="mb-6 border-warning bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                Liability Release Required
              </CardTitle>
              <CardDescription>
                Before using the carpool system, please review and acknowledge the liability release.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                By participating in the carpool program, you acknowledge that Camp Sequoia Lake is not responsible for any incidents, accidents, or damages that may occur while using private vehicles for transportation to and from camp activities.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(
                      "https://example.com/liability-release",
                      "_blank"
                    )
                  }
                >
                  View Full Release
                </Button>
                <Button size="sm" onClick={handleAcknowledgeLiability}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  I Acknowledge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isDriver && !hasVerifiedDocuments && hasAcknowledgedLiability && (
          <Card className="mb-6 border-accent bg-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent" />
                Driver Verification Required
              </CardTitle>
              <CardDescription>
                Upload your driver's license and insurance card to start offering rides.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate("/verify-driver")}>
                Upload Documents
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/trips")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                Browse Trips
              </CardTitle>
              <CardDescription>Find available carpools</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all available trips and claim your seat
              </p>
            </CardContent>
          </Card>

          {isDriver && hasVerifiedDocuments && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/create-trip")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Trip
                </CardTitle>
                <CardDescription>Offer a ride to camp</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create a new carpool trip and share costs
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/my-trips")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                My Trips
              </CardTitle>
              <CardDescription>View your carpools</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {isDriver
                  ? "Manage trips you're driving"
                  : "See trips you've joined"}
              </p>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-accent" onClick={() => navigate("/admin")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Admin Dashboard
                </CardTitle>
                <CardDescription>Manage all carpools</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View and manage all users and trips
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
