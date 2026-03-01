import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Phone, Heart, Save } from "lucide-react";
import { toast } from "sonner";
import campLogo from "@/assets/camp-logo.png";
import { MobileNavigation } from "@/components/MobileNavigation";

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [hasVerifiedDocuments, setHasVerifiedDocuments] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [email, setEmail] = useState("");

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

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      const p = profileData as ProfileData;
      setEmail(p.email);
      setFullName(p.full_name ?? "");
      setPhone(p.phone ?? "");
      setEmergencyName(p.emergency_contact_name ?? "");
      setEmergencyPhone(p.emergency_contact_phone ?? "");
      setEmergencyRelationship(p.emergency_contact_relationship ?? "");

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const roles = userRoles?.map(r => r.role) || [];
      setIsAdmin(roles.includes("admin"));
      setIsDriver(roles.includes("driver"));

      if (roles.includes("driver")) {
        const { data: docs } = await supabase
          .from("driver_documents")
          .select("verification_status")
          .eq("driver_id", session.user.id)
          .eq("verification_status", "approved")
          .maybeSingle();
        setHasVerifiedDocuments(!!docs);
      }
    } catch (error: any) {
      toast.error("Unable to load profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          emergency_contact_relationship: emergencyRelationship.trim() || null,
        })
        .eq("id", session.user.id);

      if (error) throw error;
      toast.success("Profile saved");
    } catch (error: any) {
      toast.error("Unable to save profile. Please try again.");
    } finally {
      setSaving(false);
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
          <h3 className="text-lg font-semibold mb-2">Loading profile...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-nav/20 bg-nav shadow-md">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <img
              src={campLogo}
              alt="Camp Sequoia Lake Logo"
              className="h-8 md:h-10 w-auto"
            />
            <div>
              <h1 className="text-lg md:text-xl font-bold text-nav-foreground">My Profile</h1>
              <p className="text-xs md:text-sm text-nav-foreground/80 hidden sm:block">Manage your info</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="text-nav-foreground hover:bg-nav-foreground/10 hidden md:flex"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8 pb-mobile-nav max-w-xl">
        <div className="space-y-6">

          {/* Basic Info */}
          <Card className="border-2 animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                Basic Info
              </CardTitle>
              <CardDescription>Your name and contact details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 867-5309"
                />
                <p className="text-xs text-muted-foreground">Shown to drivers and passengers on your trips</p>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="border-2 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 text-destructive" />
                </div>
                Emergency Contact
              </CardTitle>
              <CardDescription>Who should we contact in an emergency?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Contact Name</Label>
                <Input
                  id="emergencyName"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">Contact Phone</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyRelationship">Relationship</Label>
                <Input
                  id="emergencyRelationship"
                  value={emergencyRelationship}
                  onChange={(e) => setEmergencyRelationship(e.target.value)}
                  placeholder="Spouse, Parent, Friend…"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <Button
            size="lg"
            className="w-full min-h-[48px] text-base hover:scale-[1.02] transition-transform"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-5 h-5 mr-2" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>

        </div>
      </main>

      <MobileNavigation
        isDriver={isDriver}
        isAdmin={isAdmin}
        hasVerifiedDocuments={hasVerifiedDocuments}
      />
    </div>
  );
};

export default Profile;
