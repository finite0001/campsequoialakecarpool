import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Car, Shield } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

interface UserWithRole extends Profile {
  roles: string[];
}

interface Trip {
  id: string;
  departure_location: string;
  arrival_location: string;
  departure_datetime: string;
  total_seats: number;
  available_seats: number;
  driver: {
    full_name: string;
    email: string;
  };
  participants: Array<{
    passenger: {
      full_name: string;
    };
  }>;
}

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await loadData();
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error checking admin status:", error);
      }
      toast.error("Failed to verify admin access");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      // Load all users
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      // Load roles for all users
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Combine users with their roles
      const usersWithRoles: UserWithRole[] = usersData.map(user => ({
        ...user,
        roles: rolesData?.filter(r => r.user_id === user.id).map(r => r.role) || []
      }));

      setUsers(usersWithRoles);

      // Load all trips
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select(`
          *,
          driver:profiles!trips_driver_id_fkey(full_name, email),
          participants:trip_participants(
            passenger:profiles!trip_participants_passenger_id_fkey(full_name)
          )
        `)
        .order("departure_datetime", { ascending: false });

      if (tripsError) throw tripsError;
      setTrips(tripsData as any);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading data:", error);
      }
      toast.error("Failed to load admin data");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const drivers = users.filter((u) => u.roles.includes("driver"));
  const passengers = users.filter((u) => u.roles.includes("passenger") || u.roles.length === 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={campLogo} 
              alt="Camp Sequoia Lake Logo" 
              className="h-10 w-auto"
            />
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">Manage all carpools and users</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{users.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Drivers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{drivers.length}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total Trips</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{trips.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="trips">
              <Car className="w-4 h-4 mr-2" />
              Trips
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                  {users.length} total users ({drivers.length} drivers, {passengers.length}{" "}
                  passengers)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{user.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {user.phone && (
                          <p className="text-sm text-muted-foreground">{user.phone}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {format(new Date(user.created_at), "PPP")}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <Badge key={role} variant={role === "driver" ? "default" : "secondary"}>
                              {role}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="secondary">passenger</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trips" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Trips</CardTitle>
                <CardDescription>{trips.length} total trips</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trips.map((trip) => (
                    <div key={trip.id} className="p-4 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">
                            {trip.departure_location} → {trip.arrival_location}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Driver: {trip.driver.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(trip.departure_datetime), "PPP 'at' p")}
                          </p>
                        </div>
                        <Badge>
                          {trip.available_seats}/{trip.total_seats} seats
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {trip.participants.length} passenger(s):{" "}
                        {trip.participants
                          .map((p) => p.passenger.full_name)
                          .join(", ") || "None"}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
