/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * CLX OMS V8 - GIS Map of BSS Stations across Indonesia
 */

import React, { useEffect, useRef, useState } from 'react';
import { SiteMaster } from '../types/oms';
import { MapPin, Navigation, ExternalLink, Filter, BatteryCharging } from 'lucide-react';
import L from 'leaflet';

interface GisBssMapProps {
  sites: SiteMaster[];
}

export const GisBssMap: React.FC<GisBssMapProps> = ({ sites }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [filterProvince, setFilterProvince] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedSite, setSelectedSite] = useState<SiteMaster | null>(sites[0] || null);

  // Extract distinct provinces
  const provinces = Array.from(new Set(sites.map((s) => s.province))).sort();

  // Filtered sites
  const filteredSites = sites.filter((s) => {
    if (filterProvince !== 'ALL' && s.province !== filterProvince) return false;
    if (filterStatus !== 'ALL' && s.operational !== filterStatus) return false;
    return true;
  });

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center Indonesia (Jakarta - Bandung - Surabaya area)
      const map = L.map(mapContainerRef.current).setView([-6.5, 107.5], 7);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | CLX BSS OMS',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Helper for custom SVG pin icons
    const createPinIcon = (status: string) => {
      let color = '#059669'; // Emerald
      if (status === 'UNAVAILABLE') color = '#DC2626'; // Red
      if (status === 'FAULTED') color = '#D97706'; // Amber

      const svgHtml = `
        <div style="
          background-color: ${color};
          width: 26px;
          height: 26px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 2px solid #ffffff;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: #ffffff;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `;

      return L.divIcon({
        className: 'custom-bss-pin',
        html: svgHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
        popupAnchor: [0, -26],
      });
    };

    // Add markers for filtered sites
    filteredSites.forEach((site) => {
      if (isNaN(site.lat) || isNaN(site.lng)) return;

      const marker = L.marker([site.lat, site.lng], {
        icon: createPinIcon(site.operational),
      }).addTo(map);

      marker.on('click', () => {
        setSelectedSite(site);
      });

      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <b style="color: #091a2e; font-size: 13px;">${site.locationName}</b><br/>
          <span style="font-family: monospace; color: #64748b;">${site.cabinetSN} · ${site.stationCode}</span><br/>
          <div style="margin-top: 4px;">
            Status: <b>${site.operational}</b><br/>
            Baterai Aktif: <b>${site.batteryCount} pack</b> (Kosong: ${site.emptySlots})<br/>
            Mitra: <b>${site.teamLead}</b>
          </div>
          <div style="margin-top: 6px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${site.lat},${site.lng}" target="_blank" style="color: #059669; font-weight: bold; text-decoration: underline;">
              Buka Navigasi Rute ↗
            </a>
          </div>
        </div>
      `);

      markersRef.current.push(marker);
    });

    if (filteredSites.length > 0 && filteredSites[0]) {
      const bounds = L.latLngBounds(
        filteredSites.map((s) => [s.lat, s.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [filteredSites]);

  const handleCenterOnSite = (site: SiteMaster) => {
    setSelectedSite(site);
    if (mapInstanceRef.current && !isNaN(site.lat) && !isNaN(site.lng)) {
      mapInstanceRef.current.flyTo([site.lat, site.lng], 14, { duration: 1.2 });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Peta Geografis (GIS) Stasiun BSS Indonesia
          </h3>
          <p className="text-xs text-slate-500">
            Sebaran stasiun swap baterai dengan status operasional real-time dan panduan rute navigasi teknisi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Provinsi:</span>
          </div>
          <select
            value={filterProvince}
            onChange={(e) => setFilterProvince(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Provinsi ({sites.length} Site)</option>
            {provinces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Status Operasional</option>
            <option value="AVAILABLE">AVAILABLE (Normal)</option>
            <option value="UNAVAILABLE">UNAVAILABLE (Offline / Gangguan)</option>
            <option value="FAULTED">FAULTED (Slot Terdegradasi)</option>
          </select>
        </div>
      </div>

      {/* Main Map + Station Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaflet Map Surface */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs relative">
          <div
            ref={mapContainerRef}
            className="w-full h-[520px] z-10"
            style={{ background: '#f8fafc' }}
          />

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-md text-xs space-y-1.5">
            <span className="font-bold text-slate-900 block text-[11px] mb-1">Status Stasiun:</span>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
              <span>Available / Operasional Normal</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              <span>Unavailable / Mati / Putus Komunikasi</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="w-3 h-3 rounded-full bg-amber-600"></span>
              <span>Faulted / Kendala Slot Sebagian</span>
            </div>
          </div>
        </div>

        {/* Selected Station Card & Site List */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Detail Stasiun Terpilih
            </span>

            {selectedSite ? (
              <div className="space-y-3">
                <div>
                  <h4 className="font-bold text-base text-slate-900">{selectedSite.locationName}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedSite.address || selectedSite.district}</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status Operasional:</span>
                    <span
                      className={`font-bold ${
                        selectedSite.operational === 'AVAILABLE'
                          ? 'text-emerald-700'
                          : selectedSite.operational === 'UNAVAILABLE'
                          ? 'text-red-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {selectedSite.operational}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Cabinet S/N:</span>
                    <span className="font-mono font-bold text-slate-800">{selectedSite.cabinetSN}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Station Code:</span>
                    <span className="font-mono text-slate-800">{selectedSite.stationCode}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Kapasitas Baterai:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedSite.batteryCount} Terpasang (Slot Kosong: {selectedSite.emptySlots})
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Konektivitas:</span>
                    <span className="font-mono text-slate-700">{selectedSite.connectivity}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Mitra / PIC:</span>
                    <span className="font-semibold text-slate-800">{selectedSite.teamLead}</span>
                  </div>

                  {selectedSite.faultedReason && (
                    <div className="pt-2 border-t border-slate-200 text-red-700">
                      <span className="font-bold block text-[11px]">Alarm Kerusakan:</span>
                      <p className="text-[11px] mt-0.5">{selectedSite.faultedReason}</p>
                    </div>
                  )}
                </div>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSite.lat},${selectedSite.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" />
                  Buka Rute di Google Maps
                </a>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Klik salah satu pin stasiun pada peta</p>
            )}
          </div>

          {/* Quick Site Switcher List */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Daftar Stasiun ({filteredSites.length})
            </span>
            <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
              {filteredSites.map((s) => (
                <button
                  key={s.siteKey}
                  onClick={() => handleCenterOnSite(s)}
                  className={`w-full text-left p-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                    selectedSite?.siteKey === s.siteKey
                      ? 'bg-slate-900 text-white font-bold'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className="truncate">{s.locationName}</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      s.operational === 'AVAILABLE'
                        ? 'bg-emerald-500'
                        : s.operational === 'UNAVAILABLE'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
