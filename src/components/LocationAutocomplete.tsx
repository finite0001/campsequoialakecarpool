/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocationAutocompleteProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string, placeData?: google.maps.places.PlaceResult) => void;
  placeholder: string;
  required?: boolean;
  onPlaceSelect?: (place: google.maps.places.PlaceResult) => void;
}

const LocationAutocomplete = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  onPlaceSelect,
}: LocationAutocompleteProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!inputRef.current || !window.google) return;

    // Initialize autocomplete
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["geocode"],
      fields: ["formatted_address", "geometry", "name", "place_id"],
    });

    // Handle place selection
    const listener = autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place && place.formatted_address) {
        onChange(place.formatted_address, place);
        if (onPlaceSelect) {
          onPlaceSelect(place);
        }
      }
    });

    return () => {
      if (listener) {
        google.maps.event.removeListener(listener);
      }
    };
  }, [onChange, onPlaceSelect]);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base font-medium">
        {label} {required && "*"}
      </Label>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11"
      />
    </div>
  );
};

export default LocationAutocomplete;
