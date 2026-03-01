import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Car, Shield, UserPlus, UserMinus, Download, ArrowUpDown, FileCheck, CheckCircle, XCircle, Clock, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import campLogo from "@/assets/camp-logo.png";
import { SearchBar } from "@/components/SearchBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { FilterSelect } from "@/components/FilterSelect";
import { SkeletonCard } from "@/components/SkeletonCard";
import AdminGuard from "@/components/AdminGuard";

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

interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  target_audience: string | null;
  sent_at: string | null;
  sender: {
    full_name: string;
  } | null;
}

interface DriverDocument {
  id: string;
  driver_id: string;
  drivers_license_path: string;
  insurance_card_path: string;
  verification_status: "pending" | "approved" | "rejected";
  uploaded_at: string;
  driver: {
    full_name: string;
    email: string;
    phone: string | null;
  };
}

const Admin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [docStatusFilter, setDocStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastAudience, setBroadcastAudience] = useState("all");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

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
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

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

      // Load driver documents with driver profile
      const { data: docsData, error: docsError } = await supabase
        .from("driver_documents")
        .select(`
          *,
          driver:profiles!driver_documents_driver_id_fkey(full_name, email, phone)
        `)
        .order("uploaded_at", { ascending: false });

      if (docsError) throw docsError;
      setDocuments(docsData as any);

      // Load broadcast messages
      const { data: broadcastsData } = await supabase
        .from("broadcast_messages")
        .select("*, sender:profiles!broadcast_messages_sender_id_fkey(full_name)")
        .order("sent_at", { ascending: false })
        .limit(50);

      setBroadcasts((broadcastsData as any) || []);
    } catch (error: any) {
      toast.error("Unable to load admin data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDocumentStatus = async (docId: string, driverId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("driver_documents")
        .update({ verification_status: status })
        .eq("id", docId);

      if (error) throw error;

      if (status === "approved") {
        // Ensure driver role exists
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({ user_id: driverId, role: "driver" }, { onConflict: "user_id,role" });
        if (roleError) throw roleError;
        toast.success("Driver approved — they can now create trips");
      } else {
        toast.success("Documents rejected — driver has been notified");
      }

      await loadData();
    } catch (error: any) {
      toast.error("Unable to update document status. Please try again.");
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

  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setSendingBroadcast(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.from("broadcast_messages").insert({
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        target_audience: broadcastAudience,
        sender_id: session.user.id,
        sent_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast.success("Broadcast sent to all users");
      setBroadcastTitle("");
      setBroadcastMessage("");
      setBroadcastAudience("all");
      await loadData();
    } catch (error: any) {
      toast.error("Unable to send broadcast. Please try again.");
    } finally {
      setSendingBroadcast(false);
    }
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
      <AdminGuard>
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
      </AdminGuard>
    );
  }

  const drivers = users.filter((u) => u.roles.includes("driver"));
  const passengers = users.filter((u) => u.roles.includes("passenger") || u.roles.length === 0);

  return (
    <AdminGuard>
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

        {documents.filter(d => d.verification_status === "pending").length > 0 && (
          <div className="mb-6 p-4 rounded-lg border-2 border-warning bg-warning/5 flex items-center gap-3">
            <Clock className="w-5 h-5 text-warning flex-shrink-0" />
            <p className="font-medium text-sm">
              {documents.filter(d => d.verification_status === "pending").length} driver document{documents.filter(d => d.verification_status === "pending").length !== 1 ? "s" : ""} waiting for review
            </p>
          </div>
        )}

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

        <Tabs defaultValue="documents" className="space-y-6">
          <TabsList>
            <TabsTrigger value="documents">
              <FileCheck className="w-4 h-4 mr-2" />
              Documents
              {documents.filter(d => d.verification_status === "pending").length > 0 && (
                <span className="ml-2 bg-warning text-warning-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                  {documents.filter(d => d.verification_status === "pending").length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="trips">
              <Car className="w-4 h-4 mr-2" />
              Trips
            </TabsTrigger>
            <TabsTrigger value="broadcasts">
              <Megaphone className="w-4 h-4 mr-2" />
              Broadcast
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Driver Document Verification</CardTitle>
                    <CardDescription>Review and approve driver license and insurance submissions</CardDescription>
                  </div>
                  <FilterSelect
                    value={docStatusFilter}
                    onChange={(v) => setDocStatusFilter(v as typeof docStatusFilter)}
                    options={[
                      { value: "pending", label: "Pending Review" },
                      { value: "approved", label: "Approved" },
                      { value: "rejected", label: "Rejected" },
                      { value: "all", label: "All Documents" },
                    ]}
                    placeholder="Filter by status"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {documents.filter(d => docStatusFilter === "all" || d.verification_status === docStatusFilter).length === 0 ? (
                  <EmptyState
                    icon={FileCheck}
                    title={docStatusFilter === "pending" ? "No pending documents" : "No documents found"}
                    description={docStatusFilter === "pending" ? "All driver submissions have been reviewed" : "Try a different filter"}
                  />
                ) : (
                  <div className="space-y-4">
                    {documents
                      .filter(d => docStatusFilter === "all" || d.verification_status === docStatusFilter)
                      .map((doc) => (
                        <div key={doc.id} className="p-4 border rounded-lg space-y-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium">{doc.driver.full_name}</p>
                              <p className="text-sm text-muted-foreground">{doc.driver.email}</p>
                              {doc.driver.phone && (
                                <p className="text-sm text-muted-foreground">{doc.driver.phone}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Submitted {format(new Date(doc.uploaded_at), "PPP 'at' p")}
                              </p>
                            </div>
                            <Badge
                              variant={
                                doc.verification_status === "approved" ? "default" :
                                doc.verification_status === "rejected" ? "destructive" : "secondary"
                              }
                              className="flex-shrink-0 flex items-center gap-1"
                            >
                              {doc.verification_status === "approved" && <CheckCircle className="w-3 h-3" />}
                              {doc.verification_status === "rejected" && <XCircle className="w-3 h-3" />}
                              {doc.verification_status === "pending" && <Clock className="w-3 h-3" />}
                              {doc.verification_status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p className="flex items-center gap-2">
                              <FileCheck className="w-3 h-3" />
                              License: <span className="font-mono text-xs">{doc.drivers_license_path.split("/").pop()}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <FileCheck className="w-3 h-3" />
                              Insurance: <span className="font-mono text-xs">{doc.insurance_card_path.split("/").pop()}</span>
                            </p>
                          </div>
                          {doc.verification_status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handleUpdateDocumentStatus(doc.id, doc.driver_id, "approved")}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => handleUpdateDocumentStatus(doc.id, doc.driver_id, "rejected")}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                  <div />
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

          <TabsContent value="broadcasts" className="space-y-6">
            {/* Compose */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Megaphone className="w-4 h-4 text-primary" />
                  </div>
                  Send Announcement
                </CardTitle>
                <CardDescription>Message will appear on every user's dashboard for 7 days</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="e.g. All trips delayed 30 minutes"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter the full announcement text…"
                    maxLength={1000}
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground text-right">{broadcastMessage.length}/1000</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Audience</label>
                  <FilterSelect
                    value={broadcastAudience}
                    onChange={setBroadcastAudience}
                    options={[
                      { value: "all", label: "All Users" },
                      { value: "drivers", label: "Drivers Only" },
                      { value: "passengers", label: "Passengers Only" },
                    ]}
                    placeholder="Select audience"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSendBroadcast}
                  disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                >
                  {sendingBroadcast ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2"></div>
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Broadcast
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* History */}
            <Card>
              <CardHeader>
                <CardTitle>Broadcast History</CardTitle>
                <CardDescription>{broadcasts.length} message{broadcasts.length !== 1 ? "s" : ""} sent</CardDescription>
              </CardHeader>
              <CardContent>
                {broadcasts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No broadcasts sent yet</p>
                ) : (
                  <div className="space-y-3">
                    {broadcasts.map((b) => (
                      <div key={b.id} className="p-4 border rounded-lg space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-sm">{b.title}</p>
                          <Badge variant="outline" className="flex-shrink-0 text-xs capitalize">
                            {b.target_audience ?? "all"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{b.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.sent_at ? format(new Date(b.sent_at), "PPP 'at' p") : "Unknown time"}
                          {b.sender ? ` · ${b.sender.full_name}` : ""}
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
    </AdminGuard>
  );
};

export default Admin;
