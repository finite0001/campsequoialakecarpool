import { useNavigate, useLocation } from "react-router-dom";
import { Home, Car, Users, Plus, Shield, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/hooks/use-haptic";

interface NavItem {
  icon: typeof Home;
  label: string;
  path: string;
  showFor?: "all" | "driver" | "admin";
}

interface MobileNavigationProps {
  isDriver?: boolean;
  isAdmin?: boolean;
  hasVerifiedDocuments?: boolean;
}

export const MobileNavigation = ({ 
  isDriver = false, 
  isAdmin = false,
  hasVerifiedDocuments = false 
}: MobileNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: NavItem[] = [
    { icon: Home, label: "Home", path: "/dashboard", showFor: "all" },
    { icon: Car, label: "Trips", path: "/trips", showFor: "all" },
    ...(isAdmin || (isDriver && hasVerifiedDocuments) 
      ? [{ icon: Plus, label: "Create", path: "/create-trip", showFor: "all" as const }] 
      : []),
    { icon: Users, label: "My Trips", path: "/my-trips", showFor: "all" },
    ...(isAdmin
      ? [{ icon: Shield, label: "Admin", path: "/admin", showFor: "admin" as const }]
      : [{ icon: UserCircle, label: "Profile", path: "/profile", showFor: "all" as const }]),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => {
                triggerHaptic("light");
                navigate(item.path);
              }}
              className={cn(
                "flex flex-col items-center justify-center min-w-[60px] py-2 px-3 rounded-xl transition-all duration-200",
                "active:scale-95 touch-manipulation",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon 
                className={cn(
                  "w-6 h-6 mb-1 transition-transform",
                  isActive && "scale-110"
                )} 
              />
              <span className={cn(
                "text-xs font-medium",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
