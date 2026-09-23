/**
 * leafletPlugins.ts
 * Configures Leaflet with classic plugins (leaflet.heat & leaflet.markercluster).
 * Ensures window.L is assigned before plugin modules evaluate.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

if (typeof window !== 'undefined') {
  (window as any).L = L;
}

import 'leaflet.heat';
import 'leaflet.markercluster';

export default L;
