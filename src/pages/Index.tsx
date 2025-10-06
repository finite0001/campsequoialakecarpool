import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, Shield, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import campLogo from "@/assets/camp-logo.png";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background overflow-hidden">
      <header className="container mx-auto px-4 py-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-12 w-auto hover-scale"
            />
            <div>
              <h1 className="text-2xl font-bold">Camp Sequoia Lake</h1>
              <p className="text-sm text-muted-foreground">Carpool Coordinator</p>
            </div>
          </div>
          <Button onClick={() => navigate("/auth")} className="hover-scale">
            <Sparkles className="w-4 h-4 mr-2" />
            Get Started
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero Section with Image */}
        <div className="max-w-6xl mx-auto mb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left animate-fade-in">
              <h2 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Share the Journey to Camp
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Coordinate carpools with fellow staff members for Camp Sequoia Lake training.
                Save on gas, reduce environmental impact, and make new friends on the way! 🌲
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")}
                  className="hover-scale"
                >
                  <Car className="w-5 h-5 mr-2" />
                  Join the Carpool
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="hover-scale"
                >
                  Learn More
                </Button>
              </div>
            </div>
            
            <div className="relative animate-scale-in flex items-center justify-center">
              <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-2xl animate-pulse"></div>
              <img 
                src={campLogo} 
                alt="Camp Sequoia Lake Logo" 
                className="relative w-full max-w-md h-auto hover-scale drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          <Card className="hover-scale animate-fade-in border-2 hover:border-primary/50 transition-all duration-300">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Easy Coordination</CardTitle>
              <CardDescription>
                Browse available rides or offer your own. Simple seat claiming with no approval needed.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-scale animate-fade-in border-2 hover:border-success/50 transition-all duration-300" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <CardTitle>Verified Drivers</CardTitle>
              <CardDescription>
                All drivers submit license and insurance documentation for your peace of mind.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="hover-scale animate-fade-in border-2 hover:border-accent/50 transition-all duration-300" style={{ animationDelay: "0.2s" }}>
            <CardHeader>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Secure & Organized</CardTitle>
              <CardDescription>
                Admin oversight ensures smooth coordination for all 50-70 staff members.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card id="how-it-works" className="max-w-3xl mx-auto bg-gradient-to-br from-card to-card/50 backdrop-blur border-2 hover:border-primary/30 transition-all duration-300 shadow-xl animate-fade-in">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl mb-2">How It Works</CardTitle>
            <CardDescription className="text-base">Four simple steps to start carpooling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-4 hover:translate-x-2 transition-transform duration-300">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg">
                1
              </div>
              <div>
                <h4 className="font-bold mb-1 text-lg">Sign Up</h4>
                <p className="text-sm text-muted-foreground">
                  Create an account and choose your role: Driver or Passenger 🚗
                </p>
              </div>
            </div>

            <div className="flex gap-4 hover:translate-x-2 transition-transform duration-300">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-success to-success/70 rounded-full flex items-center justify-center text-success-foreground font-bold text-lg shadow-lg">
                2
              </div>
              <div>
                <h4 className="font-bold mb-1 text-lg">Get Verified (Drivers Only)</h4>
                <p className="text-sm text-muted-foreground">
                  Upload your driver's license and insurance card for instant verification ✅
                </p>
              </div>
            </div>

            <div className="flex gap-4 hover:translate-x-2 transition-transform duration-300">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-accent to-accent/70 rounded-full flex items-center justify-center text-accent-foreground font-bold text-lg shadow-lg">
                3
              </div>
              <div>
                <h4 className="font-bold mb-1 text-lg">Create or Join Trips</h4>
                <p className="text-sm text-muted-foreground">
                  Drivers create trips, passengers claim seats - it's that simple! 🎯
                </p>
              </div>
            </div>

            <div className="flex gap-4 hover:translate-x-2 transition-transform duration-300">
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-secondary to-secondary/70 rounded-full flex items-center justify-center text-secondary-foreground font-bold text-lg shadow-lg">
                4
              </div>
              <div>
                <h4 className="font-bold mb-1 text-lg">Coordinate & Travel</h4>
                <p className="text-sm text-muted-foreground">
                  Share fuel costs, coordinate meeting points, and enjoy the ride together 🌲
                </p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t text-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="hover-scale"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Start Your Journey
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground mt-20">
        <div className="flex items-center justify-center gap-3 mb-2">
          <img src={campLogo} alt="Camp Logo" className="h-6 w-auto" />
          <p className="font-medium">Camp Sequoia Lake Carpool Coordinator</p>
        </div>
        <p>Making the journey together, one carpool at a time 🚗💨</p>
      </footer>
    </div>
  );
};

export default Index;
