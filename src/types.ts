/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PostLumberType = '4x4' | '6x6';
export type BeamLumberType = '4x4' | '6x6';

export interface PergolaSpecs {
  width: number;       // total top width in feet (X axis length)
  length: number;      // total top length in feet (Y axis length)
  height: number;      // ground to top beam height in feet (Z axis)
  postLumber: PostLumberType; // choices of 4x4 or 6x6 lumber
  legsCount: number;   // 4, 6, or 8 posts
  overhang: number;    // beam/rafter overhang in inches (cantilever past post, default: 12)
  crossbarSpacing: number; // spacing between 2x6 crossbar rafters in inches (default: 16)
  crossbarSpacingX?: number | null; // spacing for X coordinate rafters (can be empty)
  crossbarSpacingY?: number | null; // spacing for Y coordinate rafters (can be empty)
  raftersCountX?: number | null;    // total custom X-axis rafter count (can be empty)
  raftersCountY?: number | null;    // total custom Y-axis rafter count (can be empty)
  rafterDirection?: 'width' | 'length' | 'both'; // direction of rafters
  beamLumber?: BeamLumberType; // choice/size of top beams (4x4 or 6x6, defaults to match post if not set)
  beamLength?: number;       // custom beam length override in feet (or auto/0)
  beamLumberWidth?: BeamLumberType;  // beam lumber size specifically for width-spanning beams
  beamLumberLength?: BeamLumberType; // beam lumber size specifically for length-spanning beams
  beamLengthWidth?: number;          // custom beam length override select for width beams
  beamLengthLength?: number;         // custom beam length override select for length beams
  useTojaTrio?: boolean;     // whether to use Toja Grid brand TRIO system brackets
  tojaTrioSize?: '4x4' | '6x6'; // Toja Grid TRIO bracket sleeve size
  useTojaFooting?: boolean;   // whether to use Toja Grid brand footing brackets for legs
  tojaFootingSize?: '4x4' | '6x6'; // Toja Grid footing (SOLO) bracket size
}

export interface SolarPanelSpecs {
  width: number;       // width of panel in millimeters
  length: number;      // length of panel in millimeters
  wattage: number;     // power capacity in Watts
  gap: number;         // physical spacing between adjacent panels in millimeters
  tiltAngle: number;   // optional flat or tilt mounting angle in degrees
  overhang?: number;   // allowed panel overhang past edges of the pergola in millimeters
}

export interface PlacedPanel {
  id: string;
  x: number;           // left offset in inches from top-left active solar mounting boundary
  y: number;           // top offset in inches from top-left active solar mounting boundary
  w: number;           // actual dimension along X axis in inches
  l: number;           // actual dimension along Y axis in inches
  rotated: boolean;    // true if rotated (landscape instead of portrait)
}

export interface OptimizationResult {
  panels: PlacedPanel[];
  columnsCount: number;
  rowsCount: number;
  totalWattage: number;
  efficiencyPercent: number; // percentage of top deck covered by solar panels
  layoutType: 'portrait' | 'landscape' | 'dual_staggered';
}

export interface MaterialCostSummary {
  postsCost: number;
  beamsCost: number;
  crossbarsCost: number;
  panelsCost: number;
  hardwareCost: number;
  totalEstimated: number;
}

export interface SavedProject {
  id: string;
  name: string;
  timestamp: number;
  pergola: PergolaSpecs;
  solar: SolarPanelSpecs;
  panelsOverride: number | null;
  selectedPresetIndex: number;
  isBuried: boolean;
  forcedOrientation: 'portrait' | 'landscape' | 'optimized';
  activeNotes?: string[];
  milestones?: { id: string; text: string; done: boolean }[];
}

