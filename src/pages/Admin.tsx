import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Car, Shield, UserPlus, UserMinus, Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";
import { SearchBar } from "@/components/SearchBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FilterSelect } from "@/components/FilterSelect";
import { SkeletonCard } from "@/components/SkeletonCard";

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
  
  // Search and filter states
  const [userSearch, setUserSearch] = useState("");
  const [tripSearch, setTripSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userSort, setUserSort] = useState<"name" | "date">("date");
  const [tripSort, setTripSort] = useState<"date" | "seats">("date");
  
  // Confirmation dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    action: "add" | "remove";
  }>({ open: false, userId: "", userName: "", action: "add" });

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
      toast.error("Unable to verify admin access. Please try again.");
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
      toast.error("Unable to load admin data. Please try again.");
    }
  };

  const toggleAdminRole = async (userId: string, currentlyAdmin: boolean) => {
    setConfirmDialog({ open: false, userId: "", userName: "", action: "add" });
    
    try {
      if (currentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Admin role removed");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Admin role added");
      }

      await loadData();
    } catch (error: any) {
      toast.error("Unable to update admin role. Please try again.");
    }
  };

  const exportUsersToCSV = () => {
    const headers = ["Name", "Email", "Phone", "Roles", "Joined Date"];
    const rows = users.map(user => [
      user.full_name,
      user.email,
      user.phone || "N/A",
      user.roles.join(", ") || "passenger",
      format(new Date(user.created_at), "PPP")
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Users exported successfully");
  };

  const exportTripsToCSV = () => {
    const headers = ["Departure", "Arrival", "Driver", "Date", "Seats", "Passengers"];
    const rows = trips.map(trip => [
      trip.departure_location,
      trip.arrival_location,
      trip.driver.full_name,
      format(new Date(trip.departure_datetime), "PPP p"),
      `${trip.available_seats}/${trip.total_seats}`,
      trip.participants.length
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trips_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Trips exported successfully");
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                           user.email.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = roleFilter === "all" || 
                         (roleFilter === "admin" && user.roles.includes("admin")) ||
                         (roleFilter === "driver" && user.roles.includes("driver")) ||
                         (roleFilter === "passenger" && !user.roles.includes("driver") && !user.roles.includes("admin"));
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      if (userSort === "name") {
        return a.full_name.localeCompare(b.full_name);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  // Filter and sort trips
  const filteredTrips = trips
    .filter(trip => {
      return trip.departure_location.toLowerCase().includes(tripSearch.toLowerCase()) ||
             trip.arrival_location.toLowerCase().includes(tripSearch.toLowerCase()) ||
             trip.driver.full_name.toLowerCase().includes(tripSearch.toLowerCase());
    })
    .sort((a, b) => {
      if (tripSort === "seats") {
        return a.available_seats - b.available_seats;
      }
      return new Date(b.departure_datetime).getTime() - new Date(a.departure_datetime).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-nav/20 bg-nav shadow-md">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={campLogo} alt="Camp Sequoia Lake Logo" className="h-10 w-auto" />
              <div>
                <h1 className="text-xl font-bold text-nav-foreground">Admin Dashboard</h1>
                <p className="text-sm text-nav-foreground/80">Loading...</p>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const drivers = users.filter((u) => u.roles.includes("driver"));
  const passengers = users.filter((u) => u.roles.includes("passenger") || u.roles.length === 0);

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={() => toggleAdminRole(confirmDialog.userId, confirmDialog.action === "remove")}
        title={confirmDialog.action === "add" ? "Add Admin Role?" : "Remove Admin Role?"}
        description={
          confirmDialog.action === "add"
            ? `Are you sure you want to make ${confirmDialog.userName} an administrator? They will have full access to manage users and trips.`
            : `Are you sure you want to remove admin privileges from ${confirmDialog.userName}? They will no longer be able to access the admin dashboard.`
        }
        confirmText={confirmDialog.action === "add" ? "Add Admin" : "Remove Admin"}
        variant={confirmDialog.action === "remove" ? "destructive" : "default"}
      />
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
              <h1 className="text-xl font-bold text-nav-foreground">Admin Dashboard</h1>
              <p className="text-sm text-nav-foreground/80">Manage all carpools</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-nav-foreground hover:bg-nav-foreground/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
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

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="border-2 hover:border-primary/50 hover:shadow-lg transition-all duration-300 animate-fade-up">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-muted-foreground">Total Users</CardTitle>
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{users.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Registered staff members</p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-success/50 hover:shadow-lg transition-all duration-300 animate-fade-up" style={{ animationDelay: "0.1s" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-muted-foreground">Drivers</CardTitle>
                <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-success" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-success">{drivers.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Verified drivers offering rides</p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-accent/50 hover:shadow-lg transition-all duration-300 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium text-muted-foreground">Total Trips</CardTitle>
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Car className="w-5 h-5 text-accent" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-accent">{trips.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Active and upcoming carpools</p>
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
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <CardTitle>All Users</CardTitle>
                    <CardDescription>
                      {filteredUsers.length} of {users.length} users
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportUsersToCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <SearchBar
                    value={userSearch}
                    onChange={setUserSearch}
                    placeholder="Search by name or email..."
                  />
                  <FilterSelect
                    value={roleFilter}
                    onChange={setRoleFilter}
                    options={[
                      { value: "all", label: "All Roles" },
                      { value: "admin", label: "Admins" },
                      { value: "driver", label: "Drivers" },
                      { value: "passenger", label: "Passengers" }
                    ]}
                    placeholder="Filter by role"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setUserSort(userSort === "name" ? "date" : "name")}
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    Sort by {userSort === "name" ? "Date" : "Name"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredUsers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No users found"
                    description="Try adjusting your search or filter criteria"
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredUsers.map((user) => {
                    const isAdmin = user.roles.includes("admin");
                    return (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          {user.phone && (
                            <p className="text-sm text-muted-foreground">{user.phone}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Joined {format(new Date(user.created_at), "PPP")}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex gap-1">
                            {user.roles.length > 0 ? (
                              user.roles.map((role) => (
                                <Badge 
                                  key={role} 
                                  variant={role === "admin" ? "outline" : role === "driver" ? "default" : "secondary"}
                                  className={role === "admin" ? "border-accent text-accent" : ""}
                                >
                                  {role}
                                </Badge>
                              ))
                            ) : (
                              <Badge variant="secondary">passenger</Badge>
                            )}
                          </div>
                          <Button
                            variant={isAdmin ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => setConfirmDialog({
                              open: true,
                              userId: user.id,
                              userName: user.full_name,
                              action: isAdmin ? "remove" : "add"
                            })}
                          >
                            {isAdmin ? (
                              <>
                                <UserMinus className="w-4 h-4 mr-1" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-1" />
                                Make Admin
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trips" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <CardTitle>All Trips</CardTitle>
                    <CardDescription>{filteredTrips.length} of {trips.length} trips</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportTripsToCSV}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <SearchBar
                    value={tripSearch}
                    onChange={setTripSearch}
                    placeholder="Search by location or driver..."
                  />
                  <div /> {/* Spacer */}
                  <Button
                    variant="outline"
                    onClick={() => setTripSort(tripSort === "date" ? "seats" : "date")}
                  >
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    Sort by {tripSort === "date" ? "Seats" : "Date"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredTrips.length === 0 ? (
                  <EmptyState
                    icon={Car}
                    title="No trips found"
                    description="Try adjusting your search criteria"
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredTrips.map((trip) => (
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
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </>
  );
};

export default Admin;
