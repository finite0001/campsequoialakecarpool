import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import VerifyDriver from "./pages/VerifyDriver";
import Trips from "./pages/Trips";
import CreateTrip from "./pages/CreateTrip";
import MyTrips from "./pages/MyTrips";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
              </AuthGuard>
            }
          />
          <Route
            path="/verify-driver"
            element={
              <AuthGuard>
                <VerifyDriver />
              </AuthGuard>
            }
          />
          <Route
            path="/trips"
            element={
              <AuthGuard>
                <Trips />
              </AuthGuard>
            }
          />
          <Route
            path="/create-trip"
            element={
              <AuthGuard>
                <CreateTrip />
              </AuthGuard>
            }
          />
          <Route
            path="/my-trips"
            element={
              <AuthGuard>
                <MyTrips />
              </AuthGuard>
            }
          />
          <Route
            path="/admin"
            element={
              <AuthGuard>
                <Admin />
              </AuthGuard>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
