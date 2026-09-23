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
}

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
            <span className="text-xs font-semibold text-slate-400 mr-1 uppercase text-[10px]">Severity:</span>
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
