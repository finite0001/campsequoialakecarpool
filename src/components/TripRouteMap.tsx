/// <reference types="google.maps" />
import { useEffect, useRef } from "react";

interface TripRouteMapProps {
  departureLocation?: google.maps.places.PlaceResult;
  arrivalLocation?: google.maps.places.PlaceResult;
}

const TripRouteMap = ({ departureLocation, arrivalLocation }: TripRouteMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Initialize map if not already created
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        zoom: 6,
        center: { lat: 36.7783, lng: -119.4179 }, // California center
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
      });

      directionsRendererRef.current = new window.google.maps.DirectionsRenderer();
      directionsRendererRef.current.setMap(mapInstanceRef.current);
    }

    // Update route when both locations are selected
    if (departureLocation?.geometry?.location && arrivalLocation?.geometry?.location) {
      const directionsService = new window.google.maps.DirectionsService();

      directionsService.route(
        {
          origin: departureLocation.geometry.location,
          destination: arrivalLocation.geometry.location,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result && directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(result);
          }
        }
      );
    } else {
      // Show markers for individual locations
      if (departureLocation?.geometry?.location && mapInstanceRef.current) {
        new window.google.maps.Marker({
          position: departureLocation.geometry.location,
          map: mapInstanceRef.current,
          title: "Departure: " + departureLocation.formatted_address,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          },
        });
        mapInstanceRef.current.setCenter(departureLocation.geometry.location);
      }

      if (arrivalLocation?.geometry?.location && mapInstanceRef.current) {
        new window.google.maps.Marker({
          position: arrivalLocation.geometry.location,
          map: mapInstanceRef.current,
          title: "Arrival: " + arrivalLocation.formatted_address,
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          },
        });
        if (!departureLocation) {
          mapInstanceRef.current.setCenter(arrivalLocation.geometry.location);
        }
      }
    }
  }, [departureLocation, arrivalLocation]);

  return (
    <div className="space-y-2">
      <div ref={mapRef} className="w-full h-80 rounded-lg border-2 border-border shadow-md" />
      {(!departureLocation || !arrivalLocation) && (
        <p className="text-sm text-muted-foreground text-center">
          Select both locations to see the route on the map
        </p>
      )}
    </div>
  );
};

export default TripRouteMap;
