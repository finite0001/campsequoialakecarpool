import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trees, Car, Shield, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <Trees className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Camp Sequoia Lake</h1>
              <p className="text-sm text-muted-foreground">Carpool Coordinator</p>
            </div>
          </div>
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            Share the Journey to Camp
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Coordinate carpools with fellow staff members for Camp Sequoia Lake training.
            Save on gas, reduce environmental impact, and make new friends on the way.
          </p>
          <Button size="lg" onClick={() => navigate("/auth")}>
            Join the Carpool
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Easy Coordination</CardTitle>
              <CardDescription>
                Browse available rides or offer your own. Simple seat claiming with no approval needed.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Verified Drivers</CardTitle>
              <CardDescription>
                All drivers submit license and insurance documentation for your peace of mind.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Secure & Organized</CardTitle>
              <CardDescription>
                Admin oversight ensures smooth coordination for all 50-70 staff members.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="max-w-3xl mx-auto bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-2xl">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium mb-1">Sign Up</h4>
                <p className="text-sm text-muted-foreground">
                  Create an account and choose your role: Driver or Passenger
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium mb-1">Get Verified (Drivers Only)</h4>
                <p className="text-sm text-muted-foreground">
                  Upload your driver's license and insurance card for instant verification
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium mb-1">Create or Join Trips</h4>
                <p className="text-sm text-muted-foreground">
                  Drivers create trips, passengers claim seats - it's that simple!
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                4
              </div>
              <div>
                <h4 className="font-medium mb-1">Coordinate & Travel</h4>
                <p className="text-sm text-muted-foreground">
                  Share fuel costs, coordinate meeting points, and enjoy the ride together
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        <p>Camp Sequoia Lake Carpool Coordinator - Making the journey together</p>
      </footer>
    </div>
  );
};

export default Index;
