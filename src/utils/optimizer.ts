/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PergolaSpecs, SolarPanelSpecs, PlacedPanel, OptimizationResult, MaterialCostSummary } from '../types';

/**
 * Optimizes the placement of solar panels atop the pergola.
 * Places a centered grid of solar panels within the total roof boundaries.
 */
export function optimizeSolarLayout(
  pergola: PergolaSpecs,
  solar: SolarPanelSpecs,
  forcedOrientation?: 'portrait' | 'landscape' | 'optimized',
  panelsCountOverride?: number | null
): OptimizationResult {
  const deckW = pergola.width * 12; // convert to inches
  const deckL = pergola.length * 12; // convert to inches

  const panelW = solar.width / 25.4; // convert millimeters to inches
  const panelL = solar.length / 25.4; // convert millimeters to inches
  const gap = solar.gap / 25.4; // convert millimeters to inches
  const allowedOverhang = (solar.overhang ?? 0) / 25.4; // convert millimeters to inches

  const calcLayout = (
    w: number,
    l: number,
    isRotated: boolean,
    label: 'portrait' | 'landscape'
  ): OptimizationResult => {
    const maxBoundW = deckW + 2 * allowedOverhang;
    const maxBoundL = deckL + 2 * allowedOverhang;

    const cols = Math.floor((maxBoundW + gap) / (w + gap));
    const rows = Math.floor((maxBoundL + gap) / (l + gap));

    const finalCols = cols > 0 ? cols : 0;
    const finalRows = rows > 0 ? rows : 0;
    const count = finalCols * finalRows;

    let panels: PlacedPanel[] = [];
    if (count > 0) {
      const gridW = finalCols * w + (finalCols - 1) * gap;
      const gridL = finalRows * l + (finalRows - 1) * gap;

      const startX = (deckW - gridW) / 2;
      const startY = (deckL - gridL) / 2;

      for (let r = 0; r < finalRows; r++) {
        for (let c = 0; c < finalCols; c++) {
          panels.push({
            id: `p-${label}-${r}-${c}`,
            x: startX + c * (w + gap),
            y: startY + r * (l + gap),
            w,
            l,
            rotated: isRotated,
          });
        }
      }
    }

    if (panelsCountOverride !== undefined && panelsCountOverride !== null && panelsCountOverride > 0 && panelsCountOverride < panels.length) {
      const centerX = deckW / 2;
      const centerY = deckL / 2;
      panels = panels
        .map(panel => {
          const pCenterX = panel.x + panel.w / 2;
          const pCenterY = panel.y + panel.l / 2;
          const distSq = Math.pow(pCenterX - centerX, 2) + Math.pow(pCenterY - centerY, 2);
          return { panel, distSq };
        })
        .sort((a, b) => a.distSq - b.distSq)
        .slice(0, panelsCountOverride)
        .map(item => item.panel);
    }

    const totalPower = panels.length * solar.wattage;
    const coveredArea = panels.length * (w * l);
    const totalArea = deckW * deckL;
    const efficiency = totalArea > 0 ? (coveredArea / totalArea) * 100 : 0;

    return {
      panels,
      columnsCount: finalCols,
      rowsCount: finalRows,
      totalWattage: totalPower,
      efficiencyPercent: Math.round(efficiency * 10) / 10,
      layoutType: label,
    };
  };

  const portraitResult = calcLayout(panelW, panelL, false, 'portrait');
  const landscapeResult = calcLayout(panelL, panelW, true, 'landscape');

  let finalResult: OptimizationResult;
  if (forcedOrientation === 'portrait') {
    finalResult = portraitResult;
  } else if (forcedOrientation === 'landscape') {
    finalResult = landscapeResult;
  } else {
    if (portraitResult.totalWattage > landscapeResult.totalWattage) {
      finalResult = portraitResult;
    } else if (landscapeResult.totalWattage > portraitResult.totalWattage) {
      finalResult = landscapeResult;
    } else {
      finalResult = portraitResult.panels.length >= landscapeResult.panels.length ? portraitResult : landscapeResult;
    }
  }

  return finalResult;
}

export interface MaterialItem {
  id: string;
  category: 'Lumber' | 'Hardware' | 'Solar' | 'Concrete';
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  notes: string;
}

export function generateMaterialList(
  pergola: PergolaSpecs,
  solar: SolarPanelSpecs,
  panelsCount: number,
  isBuried: boolean = false
): { materials: MaterialItem[]; summary: MaterialCostSummary } {
  const materials: MaterialItem[] = [];

  // 1. Upright Posts (4x4 or 6x6 lumber for support legs)
  const actualPostHeight = pergola.height + (isBuried ? 2 : 0);
  let postStandardLength = 8;
  if (actualPostHeight <= 8) postStandardLength = 8;
  else if (actualPostHeight <= 10) postStandardLength = 10;
  else if (actualPostHeight <= 12) postStandardLength = 12;
  else if (actualPostHeight <= 14) postStandardLength = 14;
  else postStandardLength = 16;

  const postPrice = pergola.postLumber === '4x4'
    ? (postStandardLength === 8 ? 16 : postStandardLength === 10 ? 21 : postStandardLength === 12 ? 26 : 33)
    : (postStandardLength === 8 ? 36 : postStandardLength === 10 ? 47 : postStandardLength === 12 ? 58 : 72);

  materials.push({
    id: 'mat-posts',
    category: 'Lumber',
    name: `${pergola.postLumber} Post Timber`,
    specification: `Pressure Treated SPF, ${postStandardLength}' length`,
    quantity: pergola.legsCount,
    unit: 'pcs',
    unitPrice: postPrice,
    notes: isBuried ? 'Includes extra 2ft length for direct ground burial' : 'Surface mount layout',
  });

  // 2. Main Support Beams (Allows separately selecting sizing and length overrides for Width-spanning and Length-spanning top beams)
  const isTojaTrio = !!pergola.useTojaTrio;
  const getStandardBeamLength = (feet: number) => {
    if (feet <= 8) return 8;
    if (feet <= 10) return 10;
    if (feet <= 12) return 12;
    if (feet <= 14) return 14;
    return 16;
  };
  const getBeamUnitPrice = (lumber: '4x4' | '6x6', len: number) => {
    if (lumber === '4x4') {
      return len === 8 ? 18 : len === 10 ? 23 : len === 12 ? 29 : len === 14 ? 35 : 42;
    } else {
      return len === 8 ? 38 : len === 10 ? 51 : len === 12 ? 64 : len === 14 ? 79 : 95;
    }
  };

  // A. Width-Spanning Top Beams (running transverse/X axis)
  const selectedBeamLumberWidth = pergola.beamLumberWidth || pergola.beamLumber || pergola.postLumber || '6x6';
  const widthBeamLengthFeet = pergola.beamLengthWidth || pergola.width;
  const widthStdLength = getStandardBeamLength(widthBeamLengthFeet);
  const widthUnitPrice = getBeamUnitPrice(selectedBeamLumberWidth, widthStdLength);
  const widthQty = 2; // Front & back perimeter headers

  materials.push({
    id: 'mat-beams-width',
    category: 'Lumber',
    name: `${selectedBeamLumberWidth} Solid Top Width Beams`,
    specification: `Pressure Treated Structural Timber, ${widthStdLength}' length`,
    quantity: widthQty,
    unit: 'pcs',
    unitPrice: widthUnitPrice,
    notes: isTojaTrio
      ? `Transverse width-perimeter beams fitted inside Toja steel sleeve joints.`
      : `Transverse horizontal width-spanning timber plates.`,
  });

  // B. Length-Spanning Top Beams (running longitudinal/Y axis)
  const selectedBeamLumberLength = pergola.beamLumberLength || pergola.beamLumber || pergola.postLumber || '6x6';
  const lengthBeamLengthFeet = pergola.beamLengthLength || pergola.length;
  const lengthStdLength = getStandardBeamLength(lengthBeamLengthFeet);
  const lengthUnitPrice = getBeamUnitPrice(selectedBeamLumberLength, lengthStdLength);
  
  // Under Toja, length segments cut between posts. Under traditional, sistered doubled boards sandwich posts.
  const lengthQty = isTojaTrio 
    ? (pergola.legsCount === 4 ? 2 : pergola.legsCount === 6 ? 4 : 6)
    : (pergola.legsCount === 4 ? 4 : pergola.legsCount === 6 ? 6 : 8);

  materials.push({
    id: 'mat-beams-length',
    category: 'Lumber',
    name: `${selectedBeamLumberLength} Solid Top Length Beams`,
    specification: `Pressure Treated Structural Timber, ${lengthStdLength}' length`,
    quantity: lengthQty,
    unit: 'pcs',
    unitPrice: lengthUnitPrice,
    notes: isTojaTrio
      ? `Longitudinal length-perimeter beams custom nested inside Toja joint sleepers.`
      : `Longitudinal double sistered girders to sandwich upright posts.`,
  });

  // 3. User choice of 2x6 top crossbars (Rafters)
  // Crossbars spanning across the width of the pergola.
  const wInches = pergola.width * 12;
  const lInches = pergola.length * 12;
  const spacingVal = pergola.crossbarSpacing || 16;
  const rafterDir = pergola.rafterDirection || 'both';

  const hasWidthRafters = rafterDir === 'width' || rafterDir === 'both';
  const hasLengthRafters = rafterDir === 'length' || rafterDir === 'both';

  const getStandardLength = (feet: number) => {
    if (feet <= 8) return 8;
    if (feet <= 10) return 10;
    if (feet <= 12) return 12;
    if (feet <= 14) return 14;
    return 16;
  };

  const spacingValX = Math.max(1, pergola.crossbarSpacingX || pergola.crossbarSpacing || 16);
  const rafterCountX = pergola.raftersCountX !== undefined && pergola.raftersCountX !== null && pergola.raftersCountX > 0
    ? pergola.raftersCountX
    : (Math.ceil(lInches / spacingValX) + 1);

  const spacingValY = Math.max(1, pergola.crossbarSpacingY || pergola.crossbarSpacing || 16);
  const rafterCountY = pergola.raftersCountY !== undefined && pergola.raftersCountY !== null && pergola.raftersCountY > 0
    ? pergola.raftersCountY
    : (Math.ceil(wInches / spacingValY) + 1);

  let totalRafters = 0;

  if (hasWidthRafters) {
    const stdL = getStandardLength(pergola.width);
    const unitPrice = stdL === 8 ? 9 : stdL === 10 ? 12 : stdL === 12 ? 14 : stdL === 14 ? 15 : 19;
    totalRafters += rafterCountX;

    materials.push({
      id: 'mat-rafters-width',
      category: 'Lumber',
      name: `2x6 Top Crossbars (Width Spanning)`,
      specification: `Pressure Treated SPF, ${rafterCountX} pcs ${pergola.raftersCountX !== undefined && pergola.raftersCountX !== null ? '(Custom Qty)' : `@ ${spacingValX}" spacing`}, ${stdL}' length`,
      quantity: rafterCountX,
      unit: 'pcs',
      unitPrice: unitPrice,
      notes: `Mounted horizontally across columns with classic overhang ends.`,
    });
  }

  if (hasLengthRafters) {
    const stdL = getStandardLength(pergola.length);
    const unitPrice = stdL === 8 ? 9 : stdL === 10 ? 12 : stdL === 12 ? 14 : stdL === 14 ? 15 : 19;
    totalRafters += rafterCountY;

    materials.push({
      id: 'mat-rafters-length',
      category: 'Lumber',
      name: `2x6 Top Crossbars (Length Spanning)`,
      specification: `Pressure Treated SPF, ${rafterCountY} pcs ${pergola.raftersCountY !== undefined && pergola.raftersCountY !== null ? '(Custom Qty)' : `@ ${spacingValY}" spacing`}, ${stdL}' length`,
      quantity: rafterCountY,
      unit: 'pcs',
      unitPrice: unitPrice,
      notes: `Secondary level grid to support layout of solar array mounts.`,
    });
  }

  // 4. Concrete footing / ground anchors
  if (isBuried) {
    materials.push({
      id: 'mat-concrete',
      category: 'Concrete',
      name: "Fast-Setting Concrete Mix",
      specification: "80 lb bags for post base securement",
      quantity: pergola.legsCount * 2,
      unit: 'bags',
      unitPrice: 7.5,
      notes: `Required for posts set 2 feet deep below grade.`,
    });
  } else if (pergola.useTojaFooting) {
    const fSize = pergola.tojaFootingSize || pergola.postLumber || '6x6';
    const fPrice = fSize === '4x4' ? 34 : 59;
    materials.push({
      id: 'mat-toja-footers',
      category: 'Hardware',
      name: `Toja Grid SOLO Footing Base Bracket`,
      specification: `Heavy industrial steel sleeve (${fSize}) with outdoor-grade powder coating`,
      quantity: pergola.legsCount,
      unit: 'pcs',
      unitPrice: fPrice,
      notes: `Premium Toja brand post bases to anchor upright legs onto decks or concrete footings.`,
    });
  } else {
    const anchorPrice = pergola.postLumber === '4x4' ? 12 : 22;
    materials.push({
      id: 'mat-anchors',
      category: 'Hardware',
      name: `Structural Post Base Anchors`,
      specification: `Heavy-duty galvanized steel bracket for ${pergola.postLumber} posts`,
      quantity: pergola.legsCount,
      unit: 'pcs',
      unitPrice: anchorPrice,
      notes: `Secures vertical wood posts to existing concrete pads or deck footings.`,
    });
  }

  // 5. Hardwares and Fasteners
  if (pergola.useTojaTrio) {
    const tSize = pergola.tojaTrioSize || pergola.beamLumber || pergola.postLumber || '6x6';
    const trioPrice = tSize === '4x4' ? 89 : 139;
    
    // Add 4 corner TRIO brackets
    materials.push({
      id: 'mat-toja-trio',
      category: 'Hardware',
      name: `Toja Grid TRIO 3-Way Corner Bracket`,
      specification: `Industrial grade black powder coated steel corner sleeve for ${tSize} timbers`,
      quantity: 4,
      unit: 'pcs',
      unitPrice: trioPrice,
      notes: `Connects vertical corner post with both horizontal top support beams.`,
    });

    // If more than 4 legs, add intermediate QUAD/joiner brackets
    if (pergola.legsCount > 4) {
      const quadQty = pergola.legsCount - 4;
      const quadPrice = tSize === '4x4' ? 119 : 169;
      materials.push({
        id: 'mat-toja-quad',
        category: 'Hardware',
        name: `Toja Grid QUAD Intermediate T-Bracket`,
        specification: `4-way steel connector sleeve for ${tSize} wood columns`,
        quantity: quadQty,
        unit: 'pcs',
        unitPrice: quadPrice,
        notes: `Secures intermediate wood columns with overlapping running top beams.`,
      });
    }
  } else {
    // Traditional bolt sistering system
    materials.push({
      id: 'mat-bolts',
      category: 'Hardware',
      name: "Galvanized Hex Bolts & Washers Set",
      specification: "1/2\" x 8\" structural lumber bolts",
      quantity: pergola.legsCount * 4,
      unit: 'sets',
      unitPrice: 3.2,
      notes: `Secures the double top support beams to upright posts.`,
    });
  }

  // Rafter hangers and multi-purpose timber screws
  materials.push({
    id: 'mat-ties',
    category: 'Hardware',
    name: "Rafter Hurricane Alignment Ties",
    specification: "Galvanized steel RT16 layout hangers",
    quantity: totalRafters * 2,
    unit: 'pcs',
    unitPrice: 1.8,
    notes: `Fastens 2x6 crossbars securely to the main support beams against high wind uplifts.`,
  });

  materials.push({
    id: 'mat-screws-box',
    category: 'Hardware',
    name: "Coated Structural Timber Screws Box",
    specification: "#10 x 3\" premium exterior wood screws, 250 count box",
    quantity: 1,
    unit: 'box',
    unitPrice: 28,
    notes: pergola.useTojaTrio 
      ? `Secures wood timbers inside Toja sleeves. (Includes bracket installation hardware).`
      : `Rust-resistant coated screws for securing joist ties and crossbar splices.`,
  });

  // 6. Solar Panel Units
  materials.push({
    id: 'solar-panels',
    category: 'Solar',
    name: `${solar.wattage}W Solar PV Panel`,
    specification: `Monocrystalline silicon panel (${solar.width}mm x ${solar.length}mm)`,
    quantity: panelsCount,
    unit: 'pcs',
    unitPrice: 160,
    notes: `Generates up to ${panelsCount * solar.wattage} Watts total under peak solar conditions.`,
  });

  // 7. Mounting kits
  if (panelsCount > 0) {
    materials.push({
      id: 'solar-kits',
      category: 'Solar',
      name: `Solar Rafter Mounting Rail Kit`,
      specification: `Anodized aluminum rails, mid clamps, end clamps, and bracket mounts`,
      quantity: panelsCount,
      unit: 'kits',
      unitPrice: 45,
      notes: `Attaches individual panel frame to 2x6 pergola crossbar grids.`,
    });
  }

  // Cost Aggregations
  let postsCost = 0;
  let beamsCost = 0;
  let crossbarsCost = 0;
  let panelsCost = 0;
  let hardwareCost = 0;

  materials.forEach((item) => {
    const cost = item.quantity * item.unitPrice;
    if (item.id === 'mat-posts') postsCost += cost;
    else if (item.id.startsWith('mat-beams')) beamsCost += cost;
    else if (item.id.startsWith('mat-rafters')) crossbarsCost += cost;
    else if (item.category === 'Solar') panelsCost += cost;
    else hardwareCost += cost;
  });

  const totalEstimated = postsCost + beamsCost + crossbarsCost + panelsCost + hardwareCost;

  return {
    materials,
    summary: {
      postsCost,
      beamsCost,
      crossbarsCost,
      panelsCost,
      hardwareCost,
      totalEstimated,
    },
  };
}
