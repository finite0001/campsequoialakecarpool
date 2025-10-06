import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, ArrowLeft, CheckCircle2 } from "lucide-react";
import campLogo from "@/assets/camp-logo.png";

const VerifyDriver = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);

  const validateFile = (file: File): boolean => {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.pdf'];
    
    // Check MIME type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPG, PNG, or PDF files are allowed');
      return false;
    }
    
    // Check extension
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error('Invalid file extension');
      return false;
    }
    
    // Check size
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return false;
    }
    
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "dl" | "insurance") => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (!validateFile(file)) {
        return;
      }
      
      if (type === "dl") {
        setDlFile(file);
      } else {
        setInsuranceFile(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dlFile || !insuranceFile) {
      toast.error("Please upload both documents");
      return;
    }

    setUploading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      const userId = session.user.id;

      // Upload DL
      const dlExt = dlFile.name.split(".").pop();
      const dlPath = `${userId}/drivers-license.${dlExt}`;
      const { error: dlError } = await supabase.storage
        .from("driver-documents")
        .upload(dlPath, dlFile, { upsert: true });

      if (dlError) throw dlError;

      // Upload Insurance
      const insuranceExt = insuranceFile.name.split(".").pop();
      const insurancePath = `${userId}/insurance-card.${insuranceExt}`;
      const { error: insuranceError } = await supabase.storage
        .from("driver-documents")
        .upload(insurancePath, insuranceFile, { upsert: true });

      if (insuranceError) throw insuranceError;

      // Save file paths to database (not public URLs for security)
      const { error: dbError } = await supabase
        .from("driver_documents")
        .upsert({
          driver_id: userId,
          drivers_license_path: dlPath,
          insurance_card_path: insurancePath,
          verification_status: "pending",
        });

      if (dbError) throw dbError;

      toast.success("Documents uploaded successfully! An admin will review them shortly.");
      navigate("/dashboard");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error uploading documents:", error);
      }
      toast.error("Failed to upload documents. Please try again.");
    } finally {
      setUploading(false);
    }
  };

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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Driver Verification</CardTitle>
            <CardDescription>
              Upload your driver's license and insurance card to become a verified driver
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="dl" className="text-base">
                  Driver's License *
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="dl"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, "dl")}
                    className="cursor-pointer"
                  />
                  {dlFile && (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a clear photo of your driver's license (front side)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="insurance" className="text-base">
                  Insurance Card *
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="insurance"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, "insurance")}
                    className="cursor-pointer"
                  />
                  {insuranceFile && (
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Upload a clear photo of your current insurance card
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Important Notes:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Files must be less than 5MB</li>
                  <li>Accepted formats: JPG, PNG, PDF</li>
                  <li>An admin will review your documents before approval</li>
                  <li>Your information is kept secure and private</li>
                </ul>
              </div>

              <Button type="submit" className="w-full" disabled={uploading || !dlFile || !insuranceFile}>
                {uploading ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-pulse" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Submit Documents
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default VerifyDriver;
