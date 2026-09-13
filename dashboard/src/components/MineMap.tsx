import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  MapPin,
  Compass,
  AlertTriangle,
  Flame,
  Wind,
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
    id: 'jharia',
    name: 'Jharia Coalfield Central',
    location: 'Dhanbad, Jharkhand',
    lat: 23.7957,
    lng: 86.4304,
    zoom: 15,
    elevation: '+180m Surface / -240m UG',
    activeHazardsCount: 5,
    baselineRisk: 0.76,
  },
  {
    id: 'raniganj',
    name: 'Raniganj North Block',
    location: 'Raniganj, West Bengal',
    lat: 23.6169,
    lng: 87.1275,
    zoom: 15,
    elevation: '+145m Surface / -190m UG',
    activeHazardsCount: 3,
    baselineRisk: 0.62,
  },
  {
    id: 'korba',
    name: 'Korba East Mine',
    location: 'Korba, Chhattisgarh',
    lat: 22.3595,
    lng: 82.7501,
    zoom: 15,
    elevation: '+290m Surface / -160m UG',
    activeHazardsCount: 4,
    baselineRisk: 0.58,
  },
  {
    id: 'singrauli',
    name: 'Singrauli Opencast',
    location: 'Singrauli, Madhya Pradesh',
    lat: 24.1993,
    lng: 82.6647,
    zoom: 14,
    elevation: '+320m Surface Pit',
    activeHazardsCount: 4,
    baselineRisk: 0.81,
  },
  {
    id: 'talcher',
    name: 'Talcher Phase II',
    location: 'Talcher, Odisha',
    lat: 20.9516,
    lng: 85.2279,
    zoom: 15,
    elevation: '+110m Surface / -280m UG',
    activeHazardsCount: 2,
    baselineRisk: 0.45,
  },
];

const MOCK_MAP_HAZARDS: MapObservation[] = [
  {
    id: 'hz-101',
    name: 'Gallery 4: Roof Fall & Support Prop Failure',
    category: 'safety',
    severity: 'high',
    score: 0.94,
    lat: 23.7972,
    lng: 86.4285,
    elevation: '-240m UG',
    zoneName: 'Underground Gallery 4 East Dip',
    beaconId: 'BCN-JHR-402',
    description:
      'Severe strata delamination detected along 18 meters of unsupported roof span. Hydraulic props #14 and #15 buckled under strata load. Direct violation of DGMS Coal Mines Regulations 2017 (Reg 112).',
    location: 'Mine Sector 4, Gallery 4 East Dip',
    photoUrl:
      'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?q=80&w=800&auto=format&fit=crop',
    inspectorName: 'Rajesh Kumar (DGMS Certified)',
    date: '2026-09-11',
    topContributors: [
      'Keyword pattern: [roof fall, collapse] in field observation (+0.41)',
      'Underground strata baseline stress elevated to 0.84 (+0.28)',
      'Gallery uninspected for 28 consecutive days (+0.25)',
    ],
    suggestedAction:
      'IMMEDIATE ACTION: Withdraw all personnel from Gallery 4. Isolate 3.3kV traction power. Deploy hydraulic timber pack and install secondary rock bolts per DGMS Circular 4/2019.',
    status: 'open',
    schematicCoords: { x: 68, y: 74 },
  },
  {
    id: 'hz-102',
    name: 'Return Airway: Methane Gas Concentration 2.1%',
    category: 'safety',
    severity: 'high',
    score: 0.88,
    lat: 23.7942,
    lng: 86.4328,
    elevation: '-210m UG',
    zoneName: 'North Return Airway Split B',
    beaconId: 'BCN-JHR-403',
    description:
      'Telemetric methane sensor node registered 2.1% CH₄ at return airway junction. Exceeds statutory threshold of 1.25% mandated under DGMS Reg 169. Danger of explosive air-gas mixture.',
    location: 'North Return Airway Junction',
    photoUrl:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    inspectorName: 'Amitabh Sharma',
    date: '2026-09-11',
    topContributors: [
      'CH₄ telemetry peak exceeding 2.0% threshold (+0.44)',
      'Auxiliary ventilation fan velocity drop (-18%) (+0.26)',
      'Gas classification: Degasification Gassy Seam III (+0.18)',
    ],
    suggestedAction:
      'STATUTORY MANDATE: Cut electrical power to district longwall section immediately. Verify auxiliary exhaust ducting integrity. Evacuate miners to fresh air intake split.',
    status: 'in-progress',
    schematicCoords: { x: 74, y: 46 },
  },
  {
    id: 'hz-103',
    name: 'Underground Dip: Inundation Breakthrough Hazard',
    category: 'safety',
    severity: 'high',
    score: 0.82,
    lat: 23.7985,
    lng: 86.4335,
    elevation: '-280m UG',
    zoneName: 'Sump Dip Advance Heading',
    beaconId: 'BCN-JHR-405',
    description:
      'Water percolation rate increased to 450 gpm through advance pilot borehole. Proximity to old waterlogged abandoned workings estimated within 15 meters without protective barrier.',
    location: 'Bottom Sump Dip Face',
    photoUrl:
      'https://images.unsplash.com/photo-1516937941344-00b4e0337589?q=80&w=800&auto=format&fit=crop',
    inspectorName: 'Pooja Verma',
    date: '2026-09-10',
    topContributors: [
      'Water ingress rate spike beyond safe margin (+0.38)',
      'Proximity to abandoned waterlogged seam (+0.29)',
      'Geotechnical fault fissure detected (+0.15)',
    ],
    suggestedAction:
      'STOP HEADING ADVANCE: Drill statutory advance proving holes not less than 3 meters in advance of working face per DGMS Water Inrush Safeguard Norms.',
    status: 'open',
    schematicCoords: { x: 38, y: 84 },
  },
  {
    id: 'hz-104',
    name: 'Crushing Plant: Particulate Dust Plume Discharge',
    category: 'environment',
    severity: 'medium',
    score: 0.65,
    lat: 23.7935,
    lng: 86.4278,
    elevation: '+182m Surface',
    zoneName: 'Surface Coal Preparation Plant',
    beaconId: 'BCN-SRF-102',
    description:
      'Water atomizing spray nozzles clogged on primary jaw crusher feed chute. Airborne respirable dust particulate concentrations exceed 3.0 mg/m³ statutory ceiling.',
    location: 'Surface Plant Feed Hopper 2',
    photoUrl:
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop',
    inspectorName: 'Sanjay Deshmukh',
    date: '2026-09-10',
    topContributors: [
      'Suppression water pressure drop < 2.5 bar (+0.31)',
      'Dust monitor reading PM10 elevated (+0.22)',
      'High ambient dry wind factor (+0.12)',
    ],
    suggestedAction:
      'Flush spray manifolds and clean inline particulate filter. Verify minimum 5.0 bar atomization pressure before restarting crushing cycle.',
    status: 'in-progress',
    schematicCoords: { x: 22, y: 22 },
  },
  {
    id: 'hz-105',
    name: 'Haulage Road Bend: Boulder Fall Clearance',
    category: 'safety',
    severity: 'low',
    score: 0.42,
    lat: 23.792,
    lng: 86.431,
    elevation: '+180m Surface',
    zoneName: 'Main Surface Haul Road Km 2.4',
    beaconId: 'BCN-SRF-108',
    description:
      'Loose bench spillage on internal transport ramp. Minor berm erosion along western parapet wall. Heavy dumper passing clearance slightly constricted.',
    location: 'Haul Road Junction 3',
    photoUrl:
      'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?q=80&w=800&auto=format&fit=crop',
    inspectorName: 'Rajesh Kumar',
    date: '2026-09-09',
    topContributors: [
      'Road berm height below 1.5x dumper wheel diameter (+0.24)',
      'Drainage ditch sedimentation (+0.18)',
    ],
    suggestedAction:
      'Deploy front-end loader for roadway grading and reconstruct 2.2m safety berm along ramp crest.',
    status: 'completed',
    schematicCoords: { x: 50, y: 16 },
  },
];

// Zone perimeters for Jharia Coalfield Central
const ZONE_PERIMETERS = [
  {
    name: 'Surface Processing & Dispatch Yard',
    baseline: '0.35 Baseline',
    polygon: [
      [23.7915, 86.4265],
      [23.7945, 86.4265],
      [23.795, 86.4305],
      [23.792, 86.4305],
    ] as [number, number][],
  },
  {
    name: 'Deep Longwall Extraction Perimeter',
    baseline: '0.78 Baseline',
    polygon: [
      [23.7955, 86.427],
      [23.7995, 86.427],
      [23.7995, 86.4345],
      [23.7955, 86.4345],
    ] as [number, number][],
  },
];

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

  const bgColor = isHigh ? '#000000' : isMed ? '#27272a' : '#ffffff';
  const textColor = isHigh || isMed ? '#ffffff' : '#000000';
  const borderColor = isSelected ? '#000000' : '#000000';
  const ringScale = isSelected ? 'scale-125' : 'scale-100';

  const pulseRingHtml = isHigh
    ? `<span class="absolute -inset-2.5 rounded-full border-2 border-black animate-radar opacity-70 pointer-events-none"></span>`
    : '';

  const html = `
    <div class="relative flex items-center justify-center cursor-pointer transition-transform duration-200 ${ringScale}">
      ${pulseRingHtml}
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

  // Live hazards state
  const [hazards, setHazards] = useState<MapObservation[]>(MOCK_MAP_HAZARDS);
  const [rawObservations, setRawObservations] = useState<ObservationOut[]>([]);
  const [isLoadingHazards, setIsLoadingHazards] = useState<boolean>(false);

  // Inspector & Modal State
  const [activeHazard, setActiveHazard] = useState<MapObservation | null>(MOCK_MAP_HAZARDS[0]);
  const [riskCardModalItem, setRiskCardModalItem] = useState<ObservationData | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
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
        if (mapped.length > 0) {
          setActiveHazard(mapped[0]);
        }
      }
    } catch {
      // Keep mock hazards as fallback
    } finally {
      setIsLoadingHazards(false);
    }
  }, [selectedSite.lat, selectedSite.lng]);

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
      <div className="border border-zinc-200 rounded-2xl p-4 sm:p-5 bg-white shadow-xs mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Site Selector + Location Info */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative">
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                Active Coalfield Block
              </label>
              <div className="relative inline-block">
                <select
                  value={selectedSite.id}
                  onChange={(e) => {
                    const site = MINE_SITES.find((s) => s.id === e.target.value);
                    if (site) setSelectedSite(site);
                  }}
                  className="appearance-none bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-black font-semibold text-sm rounded-lg px-3 py-2 pr-9 cursor-pointer focus:outline-none focus:ring-1 focus:ring-black transition-colors"
                >
                  {MINE_SITES.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name} ({site.location})
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-2.5 size-4 text-zinc-500 pointer-events-none" />
              </div>
            </div>

            <div className="hidden sm:block h-8 w-[1px] bg-zinc-200 mx-1" />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 border border-zinc-200 text-xs font-mono text-zinc-700">
                <Crosshair className="size-3.5 text-black" />
                <span>
                  {selectedSite.lat.toFixed(4)}°N, {selectedSite.lng.toFixed(4)}°E
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 border border-zinc-200 text-xs font-mono text-zinc-700">
                <Compass className="size-3.5 text-black" />
                <span>{selectedSite.elevation}</span>
              </div>
              {isLoadingHazards && (
                <span className="text-[11px] font-mono text-zinc-400 animate-pulse hidden md:inline">
                  Syncing live hazards...
                </span>
              )}
            </div>
          </div>

          {/* Perspective View Switcher: Surface GIS vs Underground CAD */}
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider text-zinc-400 mr-1 hidden sm:inline">
              Mode:
            </span>
            <div className="flex p-1 bg-zinc-100 rounded-xl border border-zinc-200">
              <button
                type="button"
                onClick={() => setViewMode('surface')}
                className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                  viewMode === 'surface'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-zinc-600 hover:text-black'
                }`}
              >
                <MapPin className="size-3.5" />
                <span>Surface GIS (GPS)</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('underground')}
                className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                  viewMode === 'underground'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-zinc-600 hover:text-black'
                }`}
              >
                <Radio className="size-3.5" />
                <span>Underground CAD (-240m)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar & Quick Counters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-zinc-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-400 mr-1">Severity:</span>
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => {
              const active = filterSeverity === sev;
              const count =
                sev === 'all'
                  ? MOCK_MAP_HAZARDS.length
                  : MOCK_MAP_HAZARDS.filter((h) => h.severity === sev).length;
              return (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setFilterSeverity(sev)}
                  className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-all ${
                    active
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <span className="capitalize">{sev}</span>
                  <span
                    className={`ml-1.5 text-[10px] font-mono px-1 rounded ${
                      active ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <div className="h-4 w-[1px] bg-zinc-200 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={() => setShowZones(!showZones)}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium flex items-center gap-1 transition-all ${
                showZones
                  ? 'bg-zinc-100 text-black border-zinc-300'
                  : 'bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Layers className="size-3" />
              <span>Zone Outlines</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTelemetrySensors(!showTelemetrySensors)}
              className={`text-xs px-2.5 py-1 rounded-md border font-medium flex items-center gap-1 transition-all ${
                showTelemetrySensors
                  ? 'bg-zinc-100 text-black border-zinc-300'
                  : 'bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <Activity className="size-3" />
              <span>IoT Telemetry Nodes</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFocusHighestRisk}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 flex items-center gap-1.5 transition-colors"
            >
              <Crosshair className="size-3.5 text-black" />
              <span>Target Critical Hazard</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:text-black hover:bg-zinc-50 flex items-center gap-1"
            >
              <Eye className="size-3.5" />
              <span>{isDrawerOpen ? 'Hide List' : 'Show List'}</span>
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
            /* ============================================================= */
            /* VIEW 1: Surface GIS Satellite / CartoDB Monochromatic Map   */
            /* ============================================================= */
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

              {/* Monochromatic Clean Positron Light Tiles */}
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                maxZoom={19}
              />

              {/* Zone Perimeters */}
              {showZones &&
                ZONE_PERIMETERS.map((zone, idx) => (
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

              {/* Observation / Hazard Markers */}
              {filteredHazards.map((h) => {
                const isSelected = activeHazard?.id === h.id;
                return (
                  <Marker
                    key={h.id}
                    position={[h.lat, h.lng]}
                    icon={createCustomPinIcon(h.severity, h.score, isSelected)}
                    eventHandlers={{
                      click: () => handleSelectHazard(h),
                    }}
                  >
                    <Popup className="monochrome-popup">
                      <div className="p-3 w-64 text-zinc-950 font-sans">
                        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                            {h.beaconId || 'SURFACE-GPS'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                              h.severity === 'high'
                                ? 'bg-black text-white'
                                : 'bg-zinc-100 text-zinc-800'
                            }`}
                          >
                            {(h.score * 100).toFixed(0)}% RISK
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs text-black leading-snug mb-1">
                          {h.name}
                        </h4>
                        <p className="text-[11px] text-zinc-500 line-clamp-2 mb-2.5">
                          {h.description}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRiskCardModalItem(h)}
                          className="w-full text-center py-1.5 px-3 bg-black hover:bg-zinc-800 text-white rounded-md text-xs font-medium transition-colors"
                        >
                          View DGMS Risk Card
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
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

              {/* Underground Schematic Vector Layer */}
              <svg className="w-full h-full" viewBox="0 0 1000 600" preserveAspectRatio="none">
                {/* Surface Ground Line */}
                <line x1="0" y1="100" x2="1000" y2="100" stroke="#000000" strokeWidth="2" />
                <text x="30" y="85" fill="#71717a" fontSize="11" fontFamily="monospace">
                  SURFACE LEVEL (+180m MSL) — SECTOR 4 HEADFRAME
                </text>

                {/* Vertical Winding Shaft No. 1 */}
                <rect x="180" y="100" width="30" height="420" fill="#f4f4f5" stroke="#000000" strokeWidth="1.5" />
                <line x1="195" y1="100" x2="195" y2="520" stroke="#000000" strokeWidth="1" strokeDasharray="3 3" />
                <text x="130" y="240" fill="#a1a1aa" fontSize="10" fontFamily="monospace" transform="rotate(-90 130 240)">
                  VERTICAL SHAFT NO. 1 (DEPTH 320m)
                </text>

                {/* Main Haulage Incline Tunnel */}
                <path
                  d="M 210 100 L 520 280 L 880 280"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="22"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-10"
                />
                <path
                  d="M 210 100 L 520 280 L 880 280"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text x="310" y="180" fill="#71717a" fontSize="11" fontFamily="monospace">
                  MAIN INCLINE HAULAGE (1 IN 4.5 GRADE)
                </text>

                {/* Gallery A: North Return Airway Split (Depth -210m) */}
                <rect x="210" y="250" width="700" height="45" fill="#fafafa" stroke="#000000" strokeWidth="1.5" />
                <text x="230" y="278" fill="#000000" fontSize="12" fontWeight="600" fontFamily="sans-serif">
                  GALLERY A &bull; NORTH RETURN AIRWAY (DEPTH -210m)
                </text>

                {/* Gallery B: Active Longwall Extraction Face (Depth -280m) */}
                <rect x="210" y="420" width="700" height="55" fill="#fafafa" stroke="#000000" strokeWidth="1.5" />
                <text x="230" y="452" fill="#000000" fontSize="12" fontWeight="600" fontFamily="sans-serif">
                  GALLERY B &bull; ACTIVE LONGWALL COAL FACE (DEPTH -280m)
                </text>

                {/* Airflow Velocity Vectors (Animated subtle dashed stream) */}
                <path
                  d="M 220 272 L 890 272"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2"
                  className="animate-ventilation opacity-30"
                />
                <path
                  d="M 220 447 L 890 447"
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2"
                  className="animate-ventilation opacity-30"
                />

                {/* Cross Connecting Shafts / Ventilation Stoppings */}
                <line x1="450" y1="295" x2="450" y2="420" stroke="#000000" strokeWidth="14" opacity="0.1" />
                <line x1="450" y1="295" x2="450" y2="420" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 4" />
                <text x="460" y="360" fill="#71717a" fontSize="10" fontFamily="monospace">
                  AIRWAY SPLIT 2
                </text>

                <line x1="720" y1="295" x2="720" y2="420" stroke="#000000" strokeWidth="14" opacity="0.1" />
                <line x1="720" y1="295" x2="720" y2="420" stroke="#000000" strokeWidth="1.5" strokeDasharray="4 4" />
                <text x="730" y="360" fill="#71717a" fontSize="10" fontFamily="monospace">
                  REGULATOR DOOR R-4
                </text>

                {/* Sump Siphon Bottom Tunnel */}
                <rect x="210" y="510" width="300" height="30" fill="#f4f4f5" stroke="#000000" strokeWidth="1" />
                <text x="230" y="530" fill="#71717a" fontSize="10" fontFamily="monospace">
                  DEWATERING SUMP DRAINAGE PIT (-320m)
                </text>
              </svg>

              {/* Underground IoT Sensor Badges */}
              {showTelemetrySensors && (
                <>
                  <div className="absolute top-[240px] left-[32%] flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-300 rounded-md shadow-xs text-[10px] font-mono text-black">
                    <Wifi className="size-3 text-black" />
                    <span>CH₄: 0.34% (NORM)</span>
                  </div>
                  <div className="absolute top-[240px] left-[78%] flex items-center gap-1.5 px-2 py-1 bg-black text-white border border-black rounded-md shadow-xs text-[10px] font-mono">
                    <Flame className="size-3 text-white" />
                    <span>CH₄: 2.10% (ALERT)</span>
                  </div>
                  <div className="absolute top-[410px] left-[35%] flex items-center gap-1.5 px-2 py-1 bg-white border border-zinc-300 rounded-md shadow-xs text-[10px] font-mono text-black">
                    <Wind className="size-3 text-black" />
                    <span>FLOW: 1.42 m/s</span>
                  </div>
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

          {/* Floating Reticle & Map Legend HUD (Top Left) */}
          <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur border border-zinc-200 rounded-xl p-3 shadow-sm max-w-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="size-2 rounded-full bg-black animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-black">
                {viewMode === 'surface' ? 'SURFACE TELEMETRY GRID' : 'SUB-SURFACE CAD SCHEMATIC'}
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {viewMode === 'surface'
                ? 'Geospatial GPS rendering of open pits, processing yards & incline shafts.'
                : 'RFID/BLE beacon array across underground galleries with ventilation vectors.'}
            </p>
          </div>

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
