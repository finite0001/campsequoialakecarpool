import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Car, Users, Plus, Shield, CheckCircle2, AlertCircle, Upload } from "lucide-react";
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
      if (import.meta.env.DEV) {
        console.error("Error loading profile:", error);
      }
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
      if (import.meta.env.DEV) {
        console.error("Error acknowledging liability:", error);
      }
      toast.error("Failed to acknowledge liability release");
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
          <h3 className="text-lg font-semibold mb-2">Loading your dashboard...</h3>
          <p className="text-sm text-muted-foreground">Please wait a moment</p>
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
        <div className="mb-8 animate-fade-in">
          <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Welcome, {profile?.full_name}!
          </h2>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isDriver ? "default" : "secondary"}
              className="text-sm px-3 py-1"
            >
              {isDriver ? "🚗 Driver" : "🎒 Passenger"}
            </Badge>
            {isAdmin && (
              <Badge 
                variant="outline" 
                className="border-secondary text-secondary text-sm px-3 py-1 bg-secondary/5"
              >
                <Shield className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
        </div>

        {!hasAcknowledgedLiability && (
          <Card className="mb-6 border-2 border-warning bg-gradient-to-br from-warning/5 to-warning/10 animate-fade-in shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-warning" />
                </div>
                Liability Release Required
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Before using the carpool system, please review and acknowledge the liability release.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">
                By participating in the carpool program, you acknowledge that Camp Sequoia Lake is not responsible for any incidents, accidents, or damages that may occur while using private vehicles for transportation to and from camp activities.
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  size="default"
                  onClick={() =>
                    window.open(
                      "https://example.com/liability-release",
                      "_blank"
                    )
                  }
                >
                  View Full Release
                </Button>
                <Button 
                  size="default" 
                  onClick={handleAcknowledgeLiability}
                  className="hover:scale-105 transition-transform"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  I Acknowledge
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isDriver && !hasVerifiedDocuments && hasAcknowledgedLiability && (
          <Card className="mb-6 border-2 border-accent bg-gradient-to-br from-accent/5 to-accent/10 animate-fade-in shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-accent" />
                </div>
                Driver Verification Required
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Upload your driver's license and insurance card to start offering rides.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/verify-driver")}
                size="lg"
                className="hover:scale-105 transition-transform"
              >
                <Upload className="w-5 h-5 mr-2" />
                Upload Documents
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-primary/50 animate-fade-up" 
            onClick={() => navigate("/trips")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Browse Trips</CardTitle>
              <CardDescription>Find available carpools</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all available trips and claim your seat
              </p>
            </CardContent>
          </Card>

          {isDriver && hasVerifiedDocuments && (
            <Card 
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-success/50 animate-fade-up" 
              style={{ animationDelay: "0.1s" }}
              onClick={() => navigate("/create-trip")}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6 text-success" />
                </div>
                <CardTitle className="text-xl">Create Trip</CardTitle>
                <CardDescription>Offer a ride to camp</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Create a new carpool trip and share costs
                </p>
              </CardContent>
            </Card>
          )}

          <Card 
            className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 hover:border-accent/50 animate-fade-up" 
            style={{ animationDelay: "0.2s" }}
            onClick={() => navigate("/my-trips")}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <CardTitle className="text-xl">My Trips</CardTitle>
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
            <Card 
              className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2 border-secondary/30 hover:border-secondary animate-fade-up bg-gradient-to-br from-card to-secondary/5" 
              style={{ animationDelay: "0.3s" }}
              onClick={() => navigate("/admin")}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-secondary" />
                </div>
                <CardTitle className="text-xl flex items-center gap-2">
                  Admin Dashboard
                  <Badge variant="outline" className="border-secondary text-secondary">Admin</Badge>
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
