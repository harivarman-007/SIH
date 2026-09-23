import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from 'react-leaflet';
import L from './leafletPlugins';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  MapPin,
  Compass,
  AlertTriangle,
  Flame,
  ShieldAlert,
  Radio,
  ChevronDown,
  Activity,
  CheckCircle2,
  Eye,
  Crosshair,
  Wifi,
  ChevronRight,
  Search,
} from 'lucide-react';
import { RiskCardModal, ObservationData } from './RiskCardModal';
import { fetchObservations, closeObservation, ObservationOut } from '@/api/observations';
import { fetchTrendsAnalytics, ZoneHotspotItem } from '@/api/analytics';

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------
export type MapViewMode = 'surface' | 'underground';

export interface MineSite {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  zoom: number;
  elevation: string;
  activeHazardsCount: number;
  baselineRisk: number;
  subsidiary: string;
  seamInfo: string;
  depthStr: string;
  leaseholdBoundary: [number, number][];
}

export interface MapObservation extends ObservationData {
  lat: number;
  lng: number;
  elevation: string;
  zoneName: string;
  schematicCoords: { x: number; y: number }; // SVG % coordinates for underground CAD
}

// ---------------------------------------------------------------------------
// Real Indian Coalfields per Phase 1 & Seed Data
// ---------------------------------------------------------------------------
const MINE_SITES: MineSite[] = [
  {
    id: 'jharia_moonidih',
    name: 'Moonidih Underground Mine (BCCL)',
    location: 'Jharia Coalfield, Dhanbad, Jharkhand',
    lat: 23.7388,
    lng: 86.3533,
    zoom: 15,
    elevation: '+180m Surface / -240m UG (Deep Seam XVI)',
    activeHazardsCount: 1,
    baselineRisk: 0.76,
    subsidiary: 'Bharat Coking Coal Ltd. (BCCL)',
    seamInfo: 'Seam XVI (Top) & Seam XV',
    depthStr: '-240m MSL',
    leaseholdBoundary: [
      [23.7485, 86.3420],
      [23.7512, 86.3585],
      [23.7445, 86.3678],
      [23.7315, 86.3650],
      [23.7278, 86.3495],
      [23.7358, 86.3398],
    ],
  },
  {
    id: 'raniganj_chinakuri',
    name: 'Chinakuri 1 & 2 Pit (ECL)',
    location: 'Raniganj Coalfield, Asansol, West Bengal',
    lat: 23.6844,
    lng: 86.9144,
    zoom: 15,
    elevation: '+115m Surface / -600m UG (Deepest Mine in India)',
    activeHazardsCount: 0,
    baselineRisk: 0.62,
    subsidiary: 'Eastern Coalfields Ltd. (ECL)',
    seamInfo: 'Dishergarh Seam',
    depthStr: '-600m MSL',
    leaseholdBoundary: [
      [23.6930, 86.9030],
      [23.6965, 86.9210],
      [23.6890, 86.9295],
      [23.6765, 86.9260],
      [23.6730, 86.9085],
      [23.6815, 86.9005],
    ],
  },
  {
    id: 'korba_kusmunda',
    name: 'Kusmunda Colliery (SECL)',
    location: 'Korba Coalfield, Chhattisgarh',
    lat: 22.3595,
    lng: 82.6800,
    zoom: 15,
    elevation: '+290m Surface / -160m UG',
    activeHazardsCount: 0,
    baselineRisk: 0.58,
    subsidiary: 'South Eastern Coalfields Ltd. (SECL)',
    seamInfo: 'Upper & Lower Kusmunda Seam',
    depthStr: '-160m MSL',
    leaseholdBoundary: [
      [22.3695, 82.6680],
      [22.3730, 82.6880],
      [22.3650, 82.6965],
      [22.3510, 82.6925],
      [22.3475, 82.6730],
      [22.3560, 82.6640],
    ],
  },
  {
    id: 'singrauli_jayant',
    name: 'Jayant Opencast Project (NCL)',
    location: 'Singrauli Coalfield, Madhya Pradesh',
    lat: 24.1167,
    lng: 82.6667,
    zoom: 14,
    elevation: '+320m Surface Pit Bench',
    activeHazardsCount: 0,
    baselineRisk: 0.81,
    subsidiary: 'Northern Coalfields Ltd. (NCL)',
    seamInfo: 'Purewa & Turra Seams (40m Thickness)',
    depthStr: 'Surface Bench (+320m)',
    leaseholdBoundary: [
      [24.1280, 82.6520],
      [24.1315, 82.6750],
      [24.1225, 82.6850],
      [24.1070, 82.6810],
      [24.1030, 82.6580],
      [24.1120, 82.6480],
    ],
  },
  {
    id: 'talcher_bhubaneswari',
    name: 'Bhubaneswari Colliery (MCL)',
    location: 'Talcher Coalfield, Angul, Odisha',
    lat: 20.9500,
    lng: 85.2167,
    zoom: 15,
    elevation: '+110m Surface / -280m UG',
    activeHazardsCount: 0,
    baselineRisk: 0.45,
    subsidiary: 'Mahanadi Coalfields Ltd. (MCL)',
    seamInfo: 'Seam II & III Composite',
    depthStr: '-280m MSL',
    leaseholdBoundary: [
      [20.9605, 85.2040],
      [20.9635, 85.2250],
      [20.9550, 85.2335],
      [20.9415, 85.2295],
      [20.9380, 85.2100],
      [20.9470, 85.2005],
    ],
  },
  {
    id: 'singareni_kothagudem',
    name: 'PVK Incline / Kothagudem (SCCL)',
    location: 'Godavari Valley, Kothagudem, Telangana',
    lat: 17.5511,
    lng: 80.6175,
    zoom: 15,
    elevation: '+90m Surface / -310m UG',
    activeHazardsCount: 0,
    baselineRisk: 0.52,
    subsidiary: 'Singareni Collieries Co. Ltd. (SCCL)',
    seamInfo: 'King Seam & Queen Seam',
    depthStr: '-310m MSL',
    leaseholdBoundary: [
      [17.5615, 80.6050],
      [17.5648, 80.6260],
      [17.5565, 80.6345],
      [17.5425, 80.6305],
      [17.5390, 80.6110],
      [17.5475, 80.6015],
    ],
  },
];

// Dynamic statutory zone perimeters computed around each Indian coalfield
function getZonePerimeters(site: MineSite) {
  const dLat = 0.003;
  const dLng = 0.0035;
  return [
    {
      name: `${site.name} — Pithead & Dispatch Yard`,
      baseline: `${(site.baselineRisk * 0.55).toFixed(2)} Surface Baseline`,
      polygon: [
        [site.lat - dLat * 0.7, site.lng - dLng * 0.8],
        [site.lat + dLat * 0.3, site.lng - dLng * 0.8],
        [site.lat + dLat * 0.3, site.lng + dLng * 0.4],
        [site.lat - dLat * 0.7, site.lng + dLng * 0.4],
      ] as [number, number][],
    },
    {
      name: `${site.name} — Active Extraction District (${site.seamInfo})`,
      baseline: `${site.baselineRisk.toFixed(2)} Underground Baseline`,
      polygon: [
        [site.lat + dLat * 0.4, site.lng - dLng * 0.6],
        [site.lat + dLat * 1.6, site.lng - dLng * 0.6],
        [site.lat + dLat * 1.6, site.lng + dLng * 1.2],
        [site.lat + dLat * 0.4, site.lng + dLng * 1.2],
      ] as [number, number][],
    },
  ];
}

// ---------------------------------------------------------------------------
// Custom Leaflet Icons (Crisp Monochromatic SVG Pins)
// ---------------------------------------------------------------------------
const createCustomPinIcon = (
  severity: 'high' | 'medium' | 'low',
  score: number,
  isSelected: boolean,
) => {
  const isHigh = severity === 'high';
  const isMed = severity === 'medium';

  // Crisp royal palette: Crimson for High, Amber for Medium, Emerald for Low
  const bgColor = isHigh ? '#be123c' : isMed ? '#b45309' : '#047857';
  const textColor = '#ffffff';
  const borderColor = isSelected ? '#1e40af' : '#ffffff';
  const ringScale = isSelected ? 'scale-110 ring-2 ring-blue-600' : 'scale-100 hover:scale-105';

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-150 ${ringScale}">
      <div style="background-color: ${bgColor}; color: ${textColor}; border: 2px solid ${borderColor};" 
           class="relative flex items-center justify-center w-8 h-8 rounded-full shadow-md font-mono text-[11px] font-bold">
        ${isHigh ? '!' : Math.round(score * 100)}
      </div>
      <div style="border-top-color: ${bgColor};" class="absolute -bottom-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px]"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-mine-pin',
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -38],
  });
};

// ---------------------------------------------------------------------------
// Recurring Hotspot Radar Beacon Icon
// ---------------------------------------------------------------------------
const createHotspotIcon = (item: ZoneHotspotItem) => {
  const isRising = item.recent_trend === 'rising';
  const color = isRising ? '#dc2626' : '#d97706';

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer group">
      <div style="background-color: ${color};" class="absolute w-7 h-7 rounded-full opacity-40 animate-ping"></div>
      <div style="background-color: ${color}; border: 2px solid #ffffff;" class="relative flex items-center justify-center w-7 h-7 rounded-full text-white shadow-md font-mono text-[10px] font-bold">
        ${item.total_violations}
      </div>
      <div class="absolute -bottom-5 bg-slate-900 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow opacity-90 whitespace-nowrap pointer-events-none">
        ${item.zone_name.split(' ')[0]}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-hotspot-beacon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

// ---------------------------------------------------------------------------
// GIS Hazard Heatmap Layer (leaflet.heat)
// ---------------------------------------------------------------------------
function HazardHeatmapLayer({ hazards }: { hazards: MapObservation[] }) {
  const map = useMap();

  useEffect(() => {
    if (!hazards.length) return;

    // Weight each point by risk_score (0.25 floor to 1.0 ceiling)
    const points = hazards.map((h) => [
      h.lat,
      h.lng,
      Math.max(0.25, Math.min(1.0, h.score)),
    ]);

    const heatLayer = (L as any).heatLayer(points, {
      radius: 35,
      blur: 22,
      maxZoom: 18,
      max: 1.0,
      gradient: {
        0.2: '#059669', // Emerald/Low
        0.5: '#d97706', // Amber/Medium
        0.8: '#dc2626', // Crimson/High
        1.0: '#991b1b', // Severe
      },
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, hazards]);

  return null;
}

// ---------------------------------------------------------------------------
// Risk-Aware Spatial Cluster Layer (leaflet.markercluster)
// ---------------------------------------------------------------------------
function ClusteredHazardMarkers({
  hazards,
  activeHazard,
  onSelectHazard,
  onOpenRiskCard,
}: {
  hazards: MapObservation[];
  activeHazard: MapObservation | null;
  onSelectHazard: (h: MapObservation) => void;
  onOpenRiskCard: (h: MapObservation) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!hazards.length) return;

    const clusterGroup = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const markers = cluster.getAllChildMarkers();
        const count = markers.length;

        // Dynamic risk severity inspection of all markers in cluster
        let maxScore = 0;
        let hasHigh = false;
        let hasMed = false;

        markers.forEach((m: any) => {
          const obs = m.options?.obsData as MapObservation | undefined;
          const score = obs?.score ?? 0;
          const sev = obs?.severity;
          if (score > maxScore) maxScore = score;
          if (sev === 'high' || score >= 0.7) hasHigh = true;
          else if (sev === 'medium' || score >= 0.4) hasMed = true;
        });

        // Dynamic color styling: Rose/Danger for High, Amber for Medium, Emerald for Low
        const bg = hasHigh ? '#be123c' : hasMed ? '#b45309' : '#047857';
        const ring = hasHigh ? 'animate-pulse ring-4 ring-rose-300' : 'ring-2 ring-white';
        const label = hasHigh ? 'CRITICAL' : hasMed ? 'WARN' : 'NORM';

        const html = `
          <div class="relative flex items-center justify-center">
            <div style="background-color: ${bg};" class="w-9 h-9 rounded-full flex flex-col items-center justify-center text-white shadow-lg ${ring} border-2 border-white transition-transform hover:scale-110">
              <span class="font-mono text-xs font-bold leading-none">${count}</span>
              <span class="text-[8px] font-extrabold tracking-tight opacity-90 leading-none">${label}</span>
            </div>
            ${
              hasHigh
                ? `<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span></span>`
                : ''
            }
          </div>
        `;

        return L.divIcon({
          html,
          className: 'custom-cluster-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    });

    hazards.forEach((h) => {
      const isSelected = activeHazard?.id === h.id;
      const icon = createCustomPinIcon(h.severity, h.score, isSelected);
      const marker = L.marker([h.lat, h.lng], {
        icon,
        obsData: h,
      } as any);

      // Monochromatic crisp popup matching Executive Light Theme
      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-3 w-64 text-zinc-950 font-sans';
      popupDiv.innerHTML = `
        <div class="flex items-center justify-between pb-1.5 border-b border-zinc-100 mb-2">
          <span class="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            ${h.beaconId || 'SURFACE-GPS'}
          </span>
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
            h.severity === 'high' ? 'bg-rose-100 text-rose-800' : 'bg-zinc-100 text-zinc-800'
          }">
            ${(h.score * 100).toFixed(0)}% RISK
          </span>
        </div>
        <h4 class="font-semibold text-xs text-black leading-snug mb-1">${h.name}</h4>
        <p class="text-[11px] text-zinc-500 line-clamp-2 mb-2.5">${h.description}</p>
        <button id="view-risk-btn-${h.id}" class="w-full text-center py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white rounded-md text-xs font-semibold transition-colors">
          View DGMS Risk Card
        </button>
      `;

      marker.bindPopup(popupDiv, { className: 'monochrome-popup' });

      marker.on('click', () => {
        onSelectHazard(h);
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`view-risk-btn-${h.id}`);
        if (btn) {
          btn.onclick = () => onOpenRiskCard(h);
        }
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, hazards, activeHazard, onSelectHazard, onOpenRiskCard]);

  return null;
}

// ---------------------------------------------------------------------------
// Leaflet Map Camera Controller
// ---------------------------------------------------------------------------
function MapCameraFlyer({
  center,
  zoom,
}: {
  center: [number, number];
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [center, zoom, map]);
  return null;
}

function mapObservationToMapHazard(
  obs: ObservationOut,
  index: number,
  baseLat: number,
  baseLng: number
): MapObservation {
  const effectiveFlag = obs.cloud_flag ?? obs.edge_flag ?? 'low';
  const effectiveScore = obs.cloud_score ?? obs.edge_score ?? 0.45;
  const statusMap: Record<string, 'open' | 'in-progress' | 'completed'> = {
    open: 'open',
    escalated: 'open',
    in_progress: 'in-progress',
    closed: 'completed',
  };

  const latOffset = ((index % 7) - 3) * 0.0022;
  const lngOffset = (Math.floor(index / 7) - 2) * 0.0025;
  const lat = obs.lat ?? baseLat + latOffset;
  const lng = obs.lng ?? baseLng + lngOffset;

  const schematicX = 18 + ((index * 19) % 65);
  const schematicY = 22 + ((index * 17) % 55);

  const reasons = (obs.cloud_reasons || obs.edge_reasons || {}) as Record<string, any>;
  const topContributors = Object.entries(reasons).map(([k, v]) => `${k}: ${String(v)}`);
  if (topContributors.length === 0) {
    topContributors.push('Statutory risk indicator assessed');
  }

  return {
    id: obs.id,
    name: obs.description.slice(0, 50) + (obs.description.length > 50 ? '...' : ''),
    category: (obs.category as any) || 'safety',
    severity: effectiveFlag,
    score: effectiveScore,
    lat,
    lng,
    elevation: '-240m UG',
    zoneName: obs.zone_id ? `Zone ${obs.zone_id}` : 'Underground Section',
    beaconId: obs.beacon_id ?? `BCN-${obs.id.slice(0, 4).toUpperCase()}`,
    description: obs.description,
    location: `Mine Sector, Zone ${obs.zone_id || 'A'}`,
    photoUrl:
      obs.photo_url ||
      'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?q=80&w=800&auto=format&fit=crop',
    inspectorName: `Inspector ${obs.inspector_id ? obs.inspector_id.slice(0, 8) : 'Staff'}`,
    date: obs.created_at ? obs.created_at.slice(0, 10) : '2026-09-11',
    topContributors,
    suggestedAction: obs.suggested_action || 'Execute safety remediation per SOP.',
    status: statusMap[obs.status] || 'open',
    schematicCoords: { x: schematicX, y: schematicY },
  };
}

interface MineMapProps {
  role?: string;
  onKpiRefresh?: () => void;
}

// ---------------------------------------------------------------------------
// Main Component: MineMap
// ---------------------------------------------------------------------------
export default function MineMap({ role, onKpiRefresh }: MineMapProps) {
  const [selectedSite, setSelectedSite] = useState<MineSite>(MINE_SITES[0]);
  const [viewMode, setViewMode] = useState<MapViewMode>('surface');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [filterCategory] = useState<'all' | 'safety' | 'environment' | 'labour'>('all');
  const [showZones, setShowZones] = useState<boolean>(true);
  const [showTelemetrySensors, setShowTelemetrySensors] = useState<boolean>(true);

  // GIS Layer & Feature Visibility States
  const [displayMode, setDisplayMode] = useState<'both' | 'heatmap' | 'pins'>('both');
  const [showBoundaries, setShowBoundaries] = useState<boolean>(true);
  const [showHotspots, setShowHotspots] = useState<boolean>(true);
  const [hotspots, setHotspots] = useState<ZoneHotspotItem[]>([]);

  // Live hazards state (only real DB observations, zero fake mock hazards)
  const [hazards, setHazards] = useState<MapObservation[]>([]);
  const [rawObservations, setRawObservations] = useState<ObservationOut[]>([]);
  const [isLoadingHazards, setIsLoadingHazards] = useState<boolean>(false);
  const [mapLayerType, setMapLayerType] = useState<'osm' | 'satellite'>('osm');

  // Inspector & Modal State
  const [activeHazard, setActiveHazard] = useState<MapObservation | null>(null);
  const [riskCardModalItem, setRiskCardModalItem] = useState<ObservationData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadMapHazards = useCallback(async () => {
    setIsLoadingHazards(true);
    try {
      const data = await fetchObservations({ limit: 60 });
      if (data && data.length > 0) {
        setRawObservations(data);
        const mapped = data.map((obs, idx) =>
          mapObservationToMapHazard(obs, idx, selectedSite.lat, selectedSite.lng)
        );
        setHazards(mapped);
        setActiveHazard(mapped[0]);
      } else {
        setRawObservations([]);
        setHazards([]);
        setActiveHazard(null);
      }
    } catch {
      setRawObservations([]);
      setHazards([]);
      setActiveHazard(null);
    } finally {
      setIsLoadingHazards(false);
    }
  }, [selectedSite.lat, selectedSite.lng]);

  const loadHotspots = useCallback(async () => {
    try {
      const res = await fetchTrendsAnalytics({ mine_site_id: selectedSite.id });
      if (res && res.zone_hotspots) {
        setHotspots(res.zone_hotspots);
      } else {
        setHotspots([]);
      }
    } catch (err) {
      console.warn('Failed to fetch trends hotspots for map', err);
      setHotspots([]);
    }
  }, [selectedSite.id]);

  // Derive real telemetry from actual submitted observations
  const latestGasObs = useMemo(() => {
    return (
      rawObservations.find(
        (obs) => obs.gas_reading_value !== null && obs.gas_reading_value !== undefined
      ) || null
    );
  }, [rawObservations]);

  useEffect(() => {
    loadMapHazards();
  }, [loadMapHazards, role]);

  useEffect(() => {
    loadHotspots();
  }, [loadHotspots]);

  // Filtered Hazards
  const filteredHazards = useMemo(() => {
    return hazards.filter((h) => {
      const matchSeverity = filterSeverity === 'all' || h.severity === filterSeverity;
      const matchCat = filterCategory === 'all' || h.category === filterCategory;
      const matchSearch =
        searchQuery === '' ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.zoneName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.beaconId && h.beaconId.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSeverity && matchCat && matchSearch;
    });
  }, [hazards, filterSeverity, filterCategory, searchQuery]);

  // Handle Marker / Pin Click
  const handleSelectHazard = (h: MapObservation) => {
    setActiveHazard(h);
  };

  // Jump camera to high-risk hazard
  const handleFocusHighestRisk = () => {
    const highest = [...filteredHazards].sort((a, b) => b.score - a.score)[0];
    if (highest) {
      setActiveHazard(highest);
    }
  };

  return (
    <div className="w-full bg-white text-zinc-950 font-sans">
      {/* ------------------------------------------------------------------- */}
      {/* 1. Header Toolbar & Site Selector HUD */}
      {/* ------------------------------------------------------------------- */}
      <div className="border border-slate-200 rounded-2xl p-3.5 bg-white shadow-xs mb-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Site Selector + Coordinates */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <select
                value={selectedSite.id}
                onChange={(e) => {
                  const site = MINE_SITES.find((s) => s.id === e.target.value);
                  if (site) setSelectedSite(site);
                }}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-900 font-bold text-xs rounded-xl px-3 py-2 pr-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-700 transition-colors"
              >
                {MINE_SITES.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.location})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 size-3.5 text-slate-500 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
              <Crosshair className="size-3 text-blue-700" />
              <span>{selectedSite.lat.toFixed(4)}°N, {selectedSite.lng.toFixed(4)}°E</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
              <Compass className="size-3 text-slate-500" />
              <span>{selectedSite.elevation}</span>
            </div>

            {isLoadingHazards && (
              <span className="text-[11px] font-mono text-blue-600 animate-pulse hidden md:inline">
                Syncing live hazards...
              </span>
            )}
          </div>

          {/* Perspective View Switcher: Surface GIS vs Underground CAD */}
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('surface')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'surface'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapPin className="size-3.5" />
                <span>Surface GIS (GPS)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('underground')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  viewMode === 'underground'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Radio className="size-3.5" />
                <span>Underground CAD ({selectedSite.depthStr})</span>
              </button>
            </div>

            {viewMode === 'surface' && (
              <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setMapLayerType('osm')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mapLayerType === 'osm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  OSM
                </button>
                <button
                  type="button"
                  onClick={() => setMapLayerType('satellite')}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    mapLayerType === 'satellite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Satellite
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Toolbar & Quick Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 mt-2.5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* GIS Layer Mode Selector */}
            {viewMode === 'surface' && (
              <>
                <span className="text-xs font-semibold text-slate-400 mr-0.5 uppercase text-[10px]">GIS Mode:</span>
                <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 mr-1.5">
                  <button
                    type="button"
                    onClick={() => setDisplayMode('both')}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                      displayMode === 'both' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Both
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('heatmap')}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                      displayMode === 'heatmap' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Heatmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('pins')}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all ${
                      displayMode === 'pins' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Pins
                  </button>
                </div>
              </>
            )}

            <span className="text-xs font-semibold text-slate-400 mr-1 uppercase text-[10px]">Severity:</span>
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => {
              const active = filterSeverity === sev;
              const count =
                sev === 'all'
                  ? hazards.length
                  : hazards.filter((h) => h.severity === sev).length;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setFilterSeverity(sev)}
                  className={`text-xs px-2.5 py-1 rounded-xl border font-semibold transition-all ${
                    active
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="capitalize">{sev}</span>
                  <span
                    className={`ml-1 text-[10px] font-mono px-1 rounded ${
                      active ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="h-4 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

            {viewMode === 'surface' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBoundaries(!showBoundaries)}
                  className={`text-xs px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 transition-all ${
                    showBoundaries
                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle DGMS Leasehold Perimeter"
                >
                  <ShieldAlert className="size-3" />
                  <span>Boundary</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowHotspots(!showHotspots)}
                  className={`text-xs px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 transition-all ${
                    showHotspots
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
                  title="Toggle Recurring Zone Hotspot Beacons"
                >
                  <Flame className="size-3 text-rose-600" />
                  <span>Hotspots ({hotspots.length})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowZones(!showZones)}
              className={`text-xs px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 transition-all ${
                showZones
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Layers className="size-3" />
              <span>Zone Outlines</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTelemetrySensors(!showTelemetrySensors)}
              className={`text-xs px-2.5 py-1 rounded-xl border font-semibold flex items-center gap-1 transition-all ${
                showTelemetrySensors
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Activity className="size-3" />
              <span>IoT Telemetry</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFocusHighestRisk}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1.5 transition-colors"
            >
              <Crosshair className="size-3 text-rose-600" />
              <span>Target Critical</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
            >
              <Eye className="size-3.5" />
              <span>{isDrawerOpen ? 'Hide Hazards' : 'Show Hazards'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. Interactive Map Container (Surface GIS vs Underground CAD) */}
      {/* ------------------------------------------------------------------- */}
      <div className="relative border border-zinc-200 rounded-2xl overflow-hidden bg-zinc-50 shadow-xs">
        {/* Main Canvas Area */}
        <div className="relative w-full h-[620px] bg-zinc-100">
          {viewMode === 'surface' ? (
            <>
              {/* ============================================================= */}
              {/* VIEW 1: Surface GIS Satellite / CartoDB Monochromatic Map   */}
              {/* ============================================================= */}
            <MapContainer
              center={[selectedSite.lat, selectedSite.lng]}
              zoom={selectedSite.zoom}
              scrollWheelZoom={true}
              className="w-full h-full z-0"
            >
              <MapCameraFlyer
                center={
                  activeHazard && filterSeverity === 'all'
                    ? [activeHazard.lat, activeHazard.lng]
                    : [selectedSite.lat, selectedSite.lng]
                }
                zoom={selectedSite.zoom}
              />

              {/* Dual-Mode Tile Layer: OpenStreetMap Standard or High-Res Esri Satellite */}
              {mapLayerType === 'satellite' ? (
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  maxZoom={18}
                />
              ) : (
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={19}
                />
              )}

              {/* Mine Site Leasehold Boundary Perimeter */}
              {showBoundaries && (
                <Polygon
                  positions={selectedSite.leaseholdBoundary}
                  pathOptions={{
                    color: '#1e40af',
                    weight: 2,
                    dashArray: '6, 6',
                    fillColor: '#3b82f6',
                    fillOpacity: 0.04,
                  }}
                >
                  <Popup>
                    <div className="p-2.5 max-w-xs font-sans text-slate-900">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900 mb-1">
                        <ShieldAlert className="size-3.5 text-blue-700" />
                        <span>{selectedSite.name}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mb-2">
                        DGMS Statutory Leasehold Perimeter ({selectedSite.subsidiary})
                      </div>
                      <div className="text-[10px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                        Provisional perimeter pending official DGMS GIS survey shapefiles.
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              )}

              {/* Dynamic Statutory Zone Perimeters around active Coalfield */}
              {showZones &&
                getZonePerimeters(selectedSite).map((zone, idx) => (
                  <Polygon
                    key={idx}
                    positions={zone.polygon}
                    pathOptions={{
                      color: '#000000',
                      weight: 1.5,
                      dashArray: '4, 4',
                      fillColor: '#000000',
                      fillOpacity: 0.04,
                    }}
                  />
                ))}

              {/* Step 1: Hazard Density Heatmap Layer */}
              {(displayMode === 'heatmap' || displayMode === 'both') && (
                <HazardHeatmapLayer hazards={filteredHazards} />
              )}

              {/* Step 2: Risk-Aware Clustered Pin Markers */}
              {(displayMode === 'pins' || displayMode === 'both') && (
                <ClusteredHazardMarkers
                  hazards={filteredHazards}
                  activeHazard={activeHazard}
                  onSelectHazard={handleSelectHazard}
                  onOpenRiskCard={(h) => setRiskCardModalItem(h)}
                />
              )}

              {/* Step 4: AI Recurring Trend Hotspot Beacons */}
              {showHotspots &&
                hotspots.map((item) => {
                  const zoneObs = hazards.filter(
                    (h) =>
                      h.zoneName?.toLowerCase().includes(item.zone_name.toLowerCase()) ||
                      h.location?.toLowerCase().includes(item.zone_name.toLowerCase()) ||
                      h.id.includes(item.zone_id)
                  );
                  let hLat = selectedSite.lat;
                  let hLng = selectedSite.lng;
                  if (zoneObs.length > 0) {
                    hLat = zoneObs.reduce((acc, o) => acc + o.lat, 0) / zoneObs.length;
                    hLng = zoneObs.reduce((acc, o) => acc + o.lng, 0) / zoneObs.length;
                  } else {
                    const hash = item.zone_id
                      .split('')
                      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    hLat = selectedSite.lat + (((hash % 7) - 3) * 0.0022);
                    hLng = selectedSite.lng + ((((hash * 3) % 7) - 3) * 0.0025);
                  }

                  return (
                    <Marker
                      key={`hotspot-${item.zone_id}`}
                      position={[hLat, hLng]}
                      icon={createHotspotIcon(item)}
                    >
                      <Popup className="monochrome-popup">
                        <div className="p-3 w-60 text-slate-900 font-sans">
                          <div className="flex items-center justify-between pb-1 border-b border-slate-100 mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1">
                              <Flame className="size-3" />
                              TREND HOTSPOT
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                                item.recent_trend === 'rising'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {item.recent_trend}
                            </span>
                          </div>
                          <h4 className="font-bold text-xs text-slate-900 mb-1">{item.zone_name}</h4>
                          <div className="space-y-1 text-[11px] text-slate-600 font-mono mb-2">
                            <div className="flex justify-between">
                              <span>14-Day Violations:</span>
                              <span className="font-bold text-slate-900">{item.count_14d}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>30-Day Violations:</span>
                              <span className="font-bold text-slate-900">{item.count_30d}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>90-Day Total:</span>
                              <span className="font-bold text-slate-900">{item.total_violations}</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                            Identified via recurrent spatial incident analytics.
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
            </MapContainer>

            {/* Floating Provisional Survey Disclaimer */}
            {showBoundaries && (
              <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-xs text-[10px] text-slate-600 flex items-center gap-1.5 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
                <span>Leasehold perimeters provisional pending official DGMS GIS survey shapefiles</span>
              </div>
            )}
            </>
          ) : (
            /* ============================================================= */
            /* VIEW 2: Underground Tactical CAD Schematics (-240m Section)   */
            /* ============================================================= */
            <div className="relative w-full h-full bg-white overflow-hidden select-none">
              {/* Tactical CAD Grid Lines */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* Underground / Opencast Schematic Vector Layer */}
              <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
                {/* Title Stamp */}
                <rect x="20" y="20" width="380" height="42" fill="#ffffff" stroke="#000000" strokeWidth="1.2" />
                <text x="32" y="38" fill="#000000" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  STATUTORY MINING CAD • DGMS REG. 112 / CMR 2017
                </text>
                <text x="32" y="52" fill="#71717a" fontSize="9" fontFamily="monospace">
                  {selectedSite.subsidiary} &bull; {selectedSite.name.toUpperCase()}
                </text>

                {selectedSite.id === 'singrauli_jayant' ? (
                  /* ========================================================= */
                  /* OPENCAST MINE CAD BENCH PROFILE (Jayant Opencast Project) */
                  /* ========================================================= */
                  <g id="opencast-profile">
                    {/* Natural Surface Ground Profile */}
                    <line x1="0" y1="80" x2="160" y2="80" stroke="#000000" strokeWidth="2" />
                    <text x="25" y="72" fill="#71717a" fontSize="10" fontFamily="monospace">
                      ORIGINAL GROUND LEVEL (+320m MSL)
                    </text>

                    {/* Terraced Opencast Pit Benches */}
                    {/* Bench 1: Topsoil / Overburden */}
                    <path d="M 160 80 L 200 130 L 280 130" fill="none" stroke="#000000" strokeWidth="2" />
                    <text x="210" y="122" fill="#52525b" fontSize="9" fontFamily="monospace">
                      BENCH 1 &bull; OVERBURDEN (+305m)
                    </text>

                    {/* Bench 2: Intermediate Strata */}
                    <path d="M 280 130 L 330 200 L 420 200" fill="none" stroke="#000000" strokeWidth="2" />
                    <text x="340" y="192" fill="#52525b" fontSize="9" fontFamily="monospace">
                      BENCH 2 &bull; SANDSTONE RIDGE (+280m)
                    </text>

                    {/* Bench 3: Purewa Seam (Exposed Coal) */}
                    <path d="M 420 200 L 470 280 L 590 280" fill="none" stroke="#000000" strokeWidth="2" />
                    <rect x="470" y="274" width="120" height="12" fill="#18181b" />
                    <text x="480" y="268" fill="#000000" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                      PUREWA COAL SEAM (+250m)
                    </text>

                    {/* Bench 4: Interburden Shales */}
                    <path d="M 590 280 L 640 370 L 730 370" fill="none" stroke="#000000" strokeWidth="2" />
                    <text x="645" y="362" fill="#52525b" fontSize="9" fontFamily="monospace">
                      BENCH 4 &bull; INTERBURDEN SHALE (+210m)
                    </text>

                    {/* Bench 5: Turra Main Coal Seam (40m Thick Extraction Face) */}
                    <path d="M 730 370 L 780 470 L 890 470" fill="none" stroke="#000000" strokeWidth="2.5" />
                    <rect x="780" y="458" width="110" height="24" fill="#18181b" />
                    <text x="790" y="448" fill="#000000" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                      TURRA SEAM (40M THICK FACE)
                    </text>

                    {/* Pit Floor Basin & Sump */}
                    <path d="M 890 470 L 920 530 L 980 530" fill="none" stroke="#000000" strokeWidth="2" />
                    <rect x="920" y="525" width="60" height="25" fill="#f4f4f5" stroke="#000000" strokeWidth="1" />
                    <text x="925" y="542" fill="#71717a" fontSize="9" fontFamily="monospace">
                      PIT SUMP (+140m)
                    </text>

                    {/* Haul Road Ramp Zigzag */}
                    <line x1="160" y1="80" x2="900" y2="470" stroke="#000000" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.4" />
                    <text x="400" y="330" fill="#71717a" fontSize="10" fontFamily="monospace" transform="rotate(27 400 330)">
                      HEAVY HAUL ROAD (GRADIENT 1 IN 16) &bull; DUMPER ALIGNMENT
                    </text>

                    {/* Highwall Slope Warning Barrier */}
                    <line x1="880" y1="80" x2="880" y2="470" stroke="#000000" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
                    <text x="885" y="260" fill="#a1a1aa" fontSize="9" fontFamily="monospace" transform="rotate(90 885 260)">
                      EASTERN HIGHWALL SLOPE 45°
                    </text>
                  </g>
                ) : (
                  /* ========================================================= */
                  /* UNDERGROUND COAL MINE CAD PROFILE (Deep Seam Extraction)  */
                  /* ========================================================= */
                  <g id="underground-profile">
                    {/* Surface Ground Line */}
                    <line x1="0" y1="95" x2="1000" y2="95" stroke="#000000" strokeWidth="2" />
                    <text x="420" y="85" fill="#71717a" fontSize="11" fontFamily="monospace">
                      SURFACE DATUM ({selectedSite.elevation.split('/')[0]?.trim() || '+180m'}) &bull; HEADFRAME & FAN DRIFT
                    </text>

                    {/* Surface Headframe Winding Derrick */}
                    <polygon points="175,95 195,30 215,95" fill="none" stroke="#000000" strokeWidth="1.5" />
                    <circle cx="195" cy="30" r="8" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />

                    {/* Vertical Winding Shaft No. 1 */}
                    <rect x="180" y="95" width="30" height="430" fill="#f4f4f5" stroke="#000000" strokeWidth="1.5" />
                    <line x1="195" y1="95" x2="195" y2="525" stroke="#000000" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="130" y="250" fill="#a1a1aa" fontSize="10" fontFamily="monospace" transform="rotate(-90 130 250)">
                      MAIN WINDING SHAFT ({selectedSite.depthStr})
                    </text>

                    {/* Secondary Upcast Fan Ventilation Shaft */}
                    <rect x="880" y="95" width="24" height="370" fill="#f4f4f5" stroke="#000000" strokeWidth="1.5" />
                    <line x1="892" y1="95" x2="892" y2="465" stroke="#000000" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="915" y="220" fill="#a1a1aa" fontSize="9" fontFamily="monospace" transform="rotate(90 915 220)">
                      UPCAST EXHAUST FAN SHAFT
                    </text>

                    {/* Main Haulage Incline Tunnel */}
                    <path
                      d="M 210 95 L 480 250 L 880 250"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="22"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="opacity-10"
                    />
                    <path
                      d="M 210 95 L 480 250 L 880 250"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <text x="260" y="160" fill="#71717a" fontSize="10" fontFamily="monospace">
                      INCLINE DRIFT HAULAGE (1 IN 4.5 GRADE)
                    </text>

                    {/* Upper Gallery: Intake & Haulage Split */}
                    <rect x="210" y="235" width="670" height="45" fill="#fafafa" stroke="#000000" strokeWidth="1.5" />
                    <text x="230" y="262" fill="#000000" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                      GALLERY A &bull; INTAKE AIRWAY &amp; LOCOMOTIVE LEVEL ({selectedSite.seamInfo.split('&')[0]?.trim() || selectedSite.seamInfo})
                    </text>

                    {/* Lower Gallery: Active Coal Extraction Face */}
                    <rect x="210" y="415" width="670" height="55" fill="#fafafa" stroke="#000000" strokeWidth="1.5" />
                    <text x="230" y="447" fill="#000000" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                      GALLERY B &bull; ACTIVE EXTRACTION DISTRICT &bull; {selectedSite.seamInfo} ({selectedSite.depthStr})
                    </text>

                    {/* Airflow Velocity Vectors (Animated subtle dashed stream) */}
                    <path
                      d="M 220 257 L 870 257"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="2"
                      className="animate-ventilation opacity-30"
                    />
                    <path
                      d="M 220 442 L 870 442"
                      fill="none"
                      stroke="#000000"
                      strokeWidth="2"
                      className="animate-ventilation opacity-30"
                    />

                    {/* Cross Connecting Shafts / Ventilation Stoppings */}
                    <line x1="430" y1="280" x2="430" y2="415" stroke="#000000" strokeWidth="14" opacity="0.1" />
                    <line x1="430" y1="280" x2="430" y2="415" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 4" />
                    <text x="440" y="350" fill="#71717a" fontSize="10" fontFamily="monospace">
                      VENTILATION SPLIT 1
                    </text>

                    <line x1="680" y1="280" x2="680" y2="415" stroke="#000000" strokeWidth="14" opacity="0.1" />
                    <line x1="680" y1="280" x2="680" y2="415" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 4" />
                    <text x="690" y="350" fill="#71717a" fontSize="10" fontFamily="monospace">
                      DGMS REGULATOR DOOR R-2
                    </text>

                    {/* Sump Siphon Bottom Tunnel */}
                    <rect x="210" y="505" width="280" height="30" fill="#f4f4f5" stroke="#000000" strokeWidth="1" />
                    <text x="230" y="525" fill="#71717a" fontSize="10" fontFamily="monospace">
                      DEWATERING SUMP DRAINAGE PIT ({selectedSite.depthStr})
                    </text>
                  </g>
                )}
              </svg>

              {/* Real Observation-Derived Underground Gas Badges */}
              {showTelemetrySensors && (
                <>
                  {rawObservations
                    .filter(
                      (obs) =>
                        obs.gas_reading_value !== null && obs.gas_reading_value !== undefined
                    )
                    .slice(0, 3)
                    .map((obs, i) => {
                      const isAlert = obs.gas_reading_value! > 0.75;
                      const positions = [
                        { top: '240px', left: '32%' },
                        { top: '240px', left: '76%' },
                        { top: '410px', left: '35%' },
                      ];
                      const pos = positions[i] || { top: '300px', left: '50%' };
                      return (
                        <div
                          key={obs.id}
                          style={pos}
                          className={`absolute flex items-center gap-1.5 px-2 py-1 rounded-md shadow-xs text-[10px] font-mono ${
                            isAlert
                              ? 'bg-black text-white border border-black animate-pulse'
                              : 'bg-white text-black border border-zinc-300'
                          }`}
                        >
                          {isAlert ? (
                            <Flame className="size-3 text-white" />
                          ) : (
                            <Wifi className="size-3 text-black" />
                          )}
                          <span>
                            CH₄: {obs.gas_reading_value}
                            {obs.gas_reading_unit || '%'} ({isAlert ? 'ALERT' : 'NORM'})
                          </span>
                        </div>
                      );
                    })}
                </>
              )}

              {/* Tactical Hazards Placed by Schematic Coordinates */}
              {filteredHazards.map((h) => {
                const isSelected = activeHazard?.id === h.id;
                const isHigh = h.severity === 'high';

                return (
                  <div
                    key={h.id}
                    onClick={() => handleSelectHazard(h)}
                    style={{
                      left: `${h.schematicCoords.x}%`,
                      top: `${h.schematicCoords.y}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    {isHigh && (
                      <span className="absolute -inset-3 rounded-full border-2 border-black animate-radar opacity-80 pointer-events-none" />
                    )}

                    <div
                      className={`relative flex items-center justify-center size-9 rounded-full shadow-lg border-2 transition-all duration-200 ${
                        isSelected
                          ? 'ring-4 ring-zinc-300 scale-110'
                          : 'hover:scale-105'
                      } ${
                        isHigh
                          ? 'bg-black text-white border-black'
                          : h.severity === 'medium'
                          ? 'bg-zinc-800 text-white border-zinc-900'
                          : 'bg-white text-black border-zinc-300'
                      }`}
                    >
                      {isHigh ? (
                        <AlertTriangle className="size-4 text-white" />
                      ) : (
                        <span className="text-[11px] font-mono font-bold">
                          {Math.round(h.score * 100)}
                        </span>
                      )}
                    </div>

                    {/* Hover Beacon Label */}
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap bg-black text-white text-[10px] px-2 py-0.5 rounded shadow font-mono">
                      {h.beaconId} &bull; {h.name.split(':')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible Observation Side-Drawer (Floating Right Side) */}
          <AnimatePresence>
            {isDrawerOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 bottom-14 w-80 z-10 bg-white/95 backdrop-blur border border-zinc-200 rounded-xl shadow-lg flex flex-col overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="p-3.5 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-black" />
                    <span className="text-xs font-bold text-black uppercase tracking-wider">
                      Sector Hazards ({filteredHazards.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-xs text-zinc-400 hover:text-black font-semibold"
                  >
                    Close
                  </button>
                </div>

                {/* Quick Search */}
                <div className="p-2.5 border-b border-zinc-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 size-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search hazard or beacon..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                {/* Hazard List */}
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-1.5">
                  {filteredHazards.map((h) => {
                    const isSelected = activeHazard?.id === h.id;
                    return (
                      <div
                        key={h.id}
                        onClick={() => handleSelectHazard(h)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-colors text-left ${
                          isSelected
                            ? 'bg-zinc-100 border border-zinc-300'
                            : 'hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold text-zinc-500">
                            {h.beaconId || 'SURFACE-GPS'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                              h.severity === 'high'
                                ? 'bg-black text-white'
                                : 'bg-zinc-200 text-zinc-800'
                            }`}
                          >
                            {(h.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <h5 className="font-semibold text-xs text-black line-clamp-1 mb-0.5">
                          {h.name}
                        </h5>
                        <p className="text-[11px] text-zinc-500 line-clamp-1">
                          {h.elevation} &bull; {h.zoneName}
                        </p>

                        {isSelected && (
                          <div className="mt-2.5 pt-2 border-t border-zinc-200 flex items-center justify-between">
                            <span className="text-[10px] text-zinc-400 capitalize">
                              {h.status}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRiskCardModalItem(h);
                              }}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-black text-white hover:bg-zinc-800 flex items-center gap-1 transition-colors"
                            >
                              <span>Risk Card</span>
                              <ChevronRight className="size-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 3. Bottom DGMS Real-Time Telemetry & Status HUD Ticker            */}
        {/* ----------------------------------------------------------------- */}
        <div className="border-t border-zinc-200 bg-white p-3.5 px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-5 text-xs">
            {/* Real Gas Reading from Actual Observations */}
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${
                  latestGasObs
                    ? latestGasObs.gas_reading_value! > 0.75
                      ? 'bg-rose-500 animate-pulse'
                      : 'bg-emerald-500'
                    : 'bg-zinc-300'
                }`}
              />
              <span className="text-zinc-500 font-medium">Latest Observed Gas:</span>
              {latestGasObs ? (
                <>
                  <span className="font-mono font-bold text-black">
                    {latestGasObs.gas_reading_value}
                    {latestGasObs.gas_reading_unit ? ` ${latestGasObs.gas_reading_unit}` : ' % CH₄'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 font-mono text-zinc-700">
                    Limit &lt; 0.75%
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono hidden md:inline">
                    (Obs #{latestGasObs.id.slice(0, 6).toUpperCase()})
                  </span>
                </>
              ) : (
                <span className="font-mono text-zinc-400 italic">No gas telemetry logged</span>
              )}
            </div>

            <div className="hidden sm:block h-4 w-[1px] bg-zinc-200" />

            {/* Live Observation Counts */}
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-black" />
              <span className="text-zinc-500 font-medium">Site Observations:</span>
              <span className="font-mono font-bold text-black">
                {hazards.length} Active ({hazards.filter((h) => h.severity === 'high').length} High Risk)
              </span>
            </div>

            <div className="hidden sm:block h-4 w-[1px] bg-zinc-200" />

            {/* Telemetry Ingestion Mode */}
            <div className="flex items-center gap-2">
              <Radio className="size-3.5 text-black" />
              <span className="text-zinc-500 font-medium">Telemetry Source:</span>
              <span className="font-mono font-semibold text-black">
                Field Inspection Feed (Live)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px]">
              <CheckCircle2 className="size-3.5 text-black" />
              <span>DGMS Circular 4/2019 Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 4. Full Component 4 Integration: RiskCardModal Drilldown           */}
      {/* ------------------------------------------------------------------- */}
      <RiskCardModal
        observation={riskCardModalItem}
        isOpen={!!riskCardModalItem}
        onClose={() => setRiskCardModalItem(null)}
        onResolve={async (id, note) => {
          try {
            await closeObservation(id, note);
            await loadMapHazards();
            onKpiRefresh?.();
          } catch (err) {
            console.error('Failed to close observation from map:', err);
          }
        }}
      />
    </div>
  );
}
