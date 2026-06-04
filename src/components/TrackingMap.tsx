import { useEffect, useRef } from 'react';

interface Props {
  lat: number;
  lng: number;
  customerLat?: number;
  customerLng?: number;
}

export default function TrackingMap({ lat, lng, customerLat, customerLng }: Props) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Dynamically load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Dynamically load Leaflet JS then init map
    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapDivRef.current || mapRef.current) return;

      const map = L.map(mapDivRef.current).setView([lat, lng], 15);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Driver marker (truck icon)
      const driverIcon = L.divIcon({
        html: `<div style="
          background:#2563eb;border-radius:50% 50% 50% 0;
          width:36px;height:36px;transform:rotate(-45deg);
          border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
          display:flex;align-items:center;justify-content:center;">
          <span style="transform:rotate(45deg);font-size:16px;">🚚</span>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        className: '',
      });

      markerRef.current = L.marker([lat, lng], { icon: driverIcon })
        .addTo(map)
        .bindPopup('📍 Delivery in progress')
        .openPopup();

      // Customer destination marker
      if (customerLat && customerLng) {
        const destIcon = L.divIcon({
          html: `<div style="
            background:#16a34a;border-radius:50% 50% 50% 0;
            width:32px;height:32px;transform:rotate(-45deg);
            border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;">
            <span style="transform:rotate(45deg);font-size:14px;">🏠</span>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          className: '',
        });
        L.marker([customerLat, customerLng], { icon: destIcon })
          .addTo(map)
          .bindPopup('🏠 Your delivery address');
      }
    };

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update driver marker position when lat/lng change
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const newLatLng = L.latLng(lat, lng);
    markerRef.current.setLatLng(newLatLng);
    mapRef.current.panTo(newLatLng, { animate: true, duration: 1 });
  }, [lat, lng]);

  return (
    <div
      ref={mapDivRef}
      style={{ width: '100%', height: '100%', borderRadius: '12px', zIndex: 0 }}
    />
  );
}
