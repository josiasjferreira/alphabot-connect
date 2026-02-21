/**
 * shared-core/types/slam.ts
 * DTOs para comunicação com módulo SLAM (Slamware 192.168.99.2:1445)
 */

export interface SlamPose {
  x: number;       // metros
  y: number;       // metros
  theta: number;   // radianos
  timestamp: number;
  quality: number;  // 0-100 (localization quality)
}

export interface SlamMapData {
  mapId: string;
  width: number;    // cells
  height: number;   // cells
  resolution: number; // meters per cell
  originX: number;
  originY: number;
  data: Uint8Array | number[]; // occupancy grid (0=free, 100=occupied, -1=unknown)
  timestamp: number;
}

export interface NavTarget {
  x: number;
  y: number;
  theta?: number;
  speed?: number;
  label?: string; // e.g., "mesa_12", "base", "charging_dock"
}

export interface NavPath {
  waypoints: Array<{ x: number; y: number }>;
  totalDistance: number; // meters
  estimatedTime: number; // seconds
}

export interface SlamObstacle {
  x: number;
  y: number;
  radius: number;
  type?: 'static' | 'dynamic';
}

export type SlamConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export interface SlamConfig {
  ip: string;       // default: 192.168.99.2
  port: number;     // default: 1445
  wsProxyPort?: number; // WebSocket proxy port if available
}
