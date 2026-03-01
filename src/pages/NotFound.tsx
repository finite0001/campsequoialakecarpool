import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home, AlertTriangle } from "lucide-react";
import campLogo from "@/assets/camp-logo.png";

const NotFound = () => {
  const navigate = useNavigate();


  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center shadow-xl border-2 animate-fade-in">
        <CardHeader className="space-y-4">
          <div className="mx-auto">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-16 w-auto mx-auto mb-4 opacity-50"
            />
          </div>
          <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-5xl font-bold">404</CardTitle>
          <CardDescription className="text-lg">
            Oops! This trail doesn't exist
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Looks like you've wandered off the path. Let's get you back to camp!
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => navigate("/")} 
              size="lg"
              className="hover-scale"
            >
              <Home className="w-4 h-4 mr-2" />
              Return Home
            </Button>
            <Button 
              onClick={() => navigate("/dashboard")} 
              variant="outline"
              size="lg"
              className="hover-scale"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
