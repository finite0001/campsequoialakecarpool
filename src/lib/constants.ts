export const VEHICLE_TYPES = {
  suv: { label: "SUV / Truck", mpg: 18, icon: "🚙" },
  sedan: { label: "Sedan / Compact", mpg: 28, icon: "🚗" },
  hybrid: { label: "Hybrid / Electric", mpg: 45, icon: "⚡" },
} as const;

export type VehicleType = keyof typeof VEHICLE_TYPES;
