import React, { useState, useMemo } from 'react';
import { PergolaSpecs, SolarPanelSpecs, PlacedPanel } from '../types';

interface TechnicalSchematicProps {
  pergola: PergolaSpecs;
  solar: SolarPanelSpecs;
  placedPanels: PlacedPanel[];
  isBuried: boolean;
}

export default function TechnicalSchematic({
  pergola,
  solar,
  placedPanels,
  isBuried,
}: TechnicalSchematicProps) {
  const [viewType, setViewType] = useState<'top' | 'front' | 'iso'>('top');
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  // Structural Dimensions
  const wInches = pergola.width * 12;
  const lInches = pergola.length * 12;
  const hInches = pergola.height * 12;
  const overhang = pergola.overhang; // overhang in inches

  // Material Profiles
  const postSize = pergola.postLumber === '4x4' ? 3.5 : 5.5;
  const selectedBeamLumberWidth = pergola.beamLumberWidth || pergola.beamLumber || pergola.postLumber || '6x6';
  const selectedBeamLumberLength = pergola.beamLumberLength || pergola.beamLumber || pergola.postLumber || '6x6';
  
  const beamWidthW = selectedBeamLumberWidth === '4x4' ? 3.5 : 5.5;   // Width-spanning beam width
  const beamWidthH = selectedBeamLumberWidth === '4x4' ? 3.5 : 5.5;   // Width-spanning beam height
  const beamLengthW = selectedBeamLumberLength === '4x4' ? 3.5 : 5.5; // Length-spanning beam width
  const beamLengthH = selectedBeamLumberLength === '4x4' ? 3.5 : 5.5; // Length-spanning beam height

  // General sizing shortcuts for backward compatibility and rendering
  const beamW = beamLengthW; // Beams seen from top running parallel to length
  const beamH = beamWidthH;  // Front facing beam height of the width-spanning beam
  const rafterW = 1.5; // 2x6 is 1.5"
  const rafterH = 5.5; // 2x6 is 5.5"
  const isTojaTrio = !!pergola.useTojaTrio;
  const isTojaFooting = !!pergola.useTojaFooting;

  // Precompute Leg Coordinates (4, 6, or 8 columns)
  // Leg positions are computed such that the rafters overhang of `overhang` inches is preserved.
  const legPositions = useMemo(() => {
    const list: { x: number; y: number }[] = [];
    const minX = overhang;
    const maxX = wInches - overhang;
    const minY = overhang;
    const maxY = lInches - overhang;
    const spanY = maxY - minY;

    if (pergola.legsCount === 4) {
      list.push({ x: minX, y: minY }); // Top-Left
      list.push({ x: maxX, y: minY }); // Top-Right
      list.push({ x: minX, y: maxY }); // Bottom-Left
      list.push({ x: maxX, y: maxY }); // Bottom-Right
    } else if (pergola.legsCount === 6) {
      list.push({ x: minX, y: minY });
      list.push({ x: maxX, y: minY });
      list.push({ x: minX, y: minY + spanY / 2 });
      list.push({ x: maxX, y: minY + spanY / 2 });
      list.push({ x: minX, y: maxY });
      list.push({ x: maxX, y: maxY });
    } else {
      // 8 posts
      list.push({ x: minX, y: minY });
      list.push({ x: maxX, y: minY });
      list.push({ x: minX, y: minY + spanY / 3 });
      list.push({ x: maxX, y: minY + spanY / 3 });
      list.push({ x: minX, y: minY + (2 * spanY) / 3 });
      list.push({ x: maxX, y: minY + (2 * spanY) / 3 });
      list.push({ x: minX, y: maxY });
      list.push({ x: maxX, y: maxY });
    }
    return list;
  }, [wInches, lInches, overhang, pergola.legsCount]);

  // Support lines of columns (unique X values where beams sit parallel to length)
  const structuralLinesX = useMemo(() => {
    return Array.from(new Set(legPositions.map(p => p.x))) as number[];
  }, [legPositions]);

  // Compute 2x6 top crossbar placement layout lines
  const rafterDir = pergola.rafterDirection || 'both';

  const widthRafterLines = useMemo(() => {
    const list: number[] = [];
    if (rafterDir === 'width' || rafterDir === 'both') {
      const isCustomQty = pergola.raftersCountX !== null && pergola.raftersCountX !== undefined && pergola.raftersCountX > 0;
      let count = 0;
      let spacing = 16;
      if (isCustomQty) {
        count = pergola.raftersCountX || 2;
      } else {
        spacing = Math.max(1, pergola.crossbarSpacingX || pergola.crossbarSpacing || 16);
        count = Math.ceil(lInches / spacing) + 1;
      }
      const actualSpacing = count <= 1 ? 0 : (lInches / (count - 1));
      for (let i = 0; i < count; i++) {
        list.push(i * actualSpacing);
      }
    }
    return list;
  }, [lInches, rafterDir, pergola.raftersCountX, pergola.crossbarSpacingX, pergola.crossbarSpacing]);

  const lengthCrossbarLines = useMemo(() => {
    const list: number[] = [];
    if (rafterDir === 'length' || rafterDir === 'both') {
      const isCustomQty = pergola.raftersCountY !== null && pergola.raftersCountY !== undefined && pergola.raftersCountY > 0;
      let count = 0;
      let spacing = 16;
      if (isCustomQty) {
        count = pergola.raftersCountY || 2;
      } else {
        spacing = Math.max(1, pergola.crossbarSpacingY || pergola.crossbarSpacing || 16);
        count = Math.ceil(wInches / spacing) + 1;
      }
      const actualSpacing = count <= 1 ? 0 : (wInches / (count - 1));
      for (let i = 0; i < count; i++) {
        list.push(i * actualSpacing);
      }
    }
    return list;
  }, [wInches, rafterDir, pergola.raftersCountY, pergola.crossbarSpacingY, pergola.crossbarSpacing]);

  // 3D Projection mapping matrix (Cabinet Projection 30 degrees angle, 0.5 fore-reduction ratio)
  const project = (x: number, y: number, z: number) => {
    const angle = 30 * (Math.PI / 180);
    const depthScale = 0.45;
    
    // Center of drafting board
    const boardCenterX = 280;
    const boardCenterY = 280;

    // Projected coordinates translation relative to centered origin
    const originX = boardCenterX - (wInches * 1.5) / 2;
    const originY = boardCenterY + (hInches * 1.5) / 2;

    const px = originX + x * 1.5 - y * depthScale * Math.cos(angle) * 1.5;
    const py = originY - z * 1.5 + y * depthScale * Math.sin(angle) * 1.5;

    return { x: px, y: py };
  };

  // Render top down drawing panel
  const renderTopView = () => {
    const widthSvg = 600;
    const heightSvg = 460;
    const padding = 55;

    const scale = Math.min(
      (widthSvg - 2 * padding) / wInches,
      (heightSvg - 2 * padding) / lInches
    );

    const xOff = (widthSvg - wInches * scale) / 2;
    const yOff = (heightSvg - lInches * scale) / 2;

    const toX = (val: number) => xOff + val * scale;
    const toY = (val: number) => yOff + val * scale;

    return (
      <svg className="w-full h-full bg-white font-mono text-[10px]" viewBox={`0 0 ${widthSvg} ${heightSvg}`}>
        {/* Plotting grid layout */}
        <defs>
          <pattern id="eInkGrid" width="15" height="15" patternUnits="userSpaceOnUse">
            <path d="M 15 0 L 0 0 0 15" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#eInkGrid)" />

        {/* Boundary Perimeter Roof Outline */}
        <rect
          x={toX(0)}
          y={toY(0)}
          width={wInches * scale}
          height={lInches * scale}
          fill="none"
          stroke="#111827"
          strokeWidth="2.5"
          strokeDasharray="4 4"
        />

        {/* Support columns Footprint positions */}
        {legPositions.map((pos, idx) => (
          <rect
            key={`leg-${idx}`}
            x={toX(pos.x - postSize / 2)}
            y={toY(pos.y - postSize / 2)}
            width={postSize * scale}
            height={postSize * scale}
            fill="#e5e7eb"
            stroke="#111827"
            strokeWidth="2"
          />
        ))}

        {/* Support Girders (Toja Perimeter Framework vs Traditional Double Sister Girders) */}
        {isTojaTrio ? (
          <>
            {/* Connect corners in a beautiful continuous black/grey structure */}
            <rect
              x={toX(overhang - postSize / 2)}
              y={toY(overhang - postSize / 2)}
              width={(wInches - 2 * overhang + postSize) * scale}
              height={(lInches - 2 * overhang + postSize) * scale}
              fill="none"
              stroke="#4b5563"
              strokeWidth={beamW * scale}
            />
            {/* Draw TRIO steel connector covers on top of the corners */}
            {legPositions.map((pos, idx) => (
              <rect
                key={`trio-top-cap-${idx}`}
                x={toX(pos.x - (postSize + 0.5) / 2)}
                y={toY(pos.y - (postSize + 0.5) / 2)}
                width={(postSize + 0.5) * scale}
                height={(postSize + 0.5) * scale}
                fill="#111827"
                stroke="#111827"
                rx="2"
              />
            ))}
          </>
        ) : (
          <>
            {/* Longitudinal Double Sistered Beams (spanning along length/Y-axis) */}
            {structuralLinesX.map((xCoord, idx) => {
              const lX1_outer = xCoord - postSize / 2 - beamW;
              const lX2_inner = xCoord + postSize / 2;
              return (
                <React.Fragment key={`beams-line-${idx}`}>
                  {/* Outer Beam board */}
                  <rect
                    x={toX(lX1_outer)}
                    y={toY(0)}
                    width={beamW * scale}
                    height={lInches * scale}
                    fill="#f3f4f6"
                    stroke="#111827"
                    strokeWidth="1.5"
                  />
                  {/* Inner Beam board */}
                  <rect
                    x={toX(lX2_inner)}
                    y={toY(0)}
                    width={beamW * scale}
                    height={lInches * scale}
                    fill="#f3f4f6"
                    stroke="#111827"
                    strokeWidth="1.5"
                  />
                </React.Fragment>
              );
            })}

            {/* Transverse Width-Spanning Beams (spanning along width/X-axis) at front and back columns lines */}
            {[overhang, lInches - overhang].map((yCoord, idx) => (
              <rect
                key={`transverse-beam-rect-${idx}`}
                x={toX(0)}
                y={toY(yCoord - beamWidthW / 2)}
                width={wInches * scale}
                height={beamWidthW * scale}
                fill="#f3f4f6"
                stroke="#111827"
                strokeWidth="1.5"
              />
            ))}
          </>
        )}

        {/* Width-Spanning 2x6 Crossbars */}
        {widthRafterLines.map((yCoord, idx) => (
          <rect
            key={`width-rafter-${idx}`}
            x={toX(0)}
            y={toY(yCoord - rafterW / 2)}
            width={wInches * scale}
            height={rafterW * scale}
            fill="#ffffff"
            stroke="#111827"
            strokeWidth="1.2"
          />
        ))}

        {/* Length-Spanning 2x6 Crossbars */}
        {lengthCrossbarLines.map((xCoord, idx) => (
          <rect
            key={`length-rafter-${idx}`}
            x={toX(xCoord - rafterW / 2)}
            y={toY(0)}
            width={rafterW * scale}
            height={lInches * scale}
            fill="#ffffff"
            stroke="#111827"
            strokeWidth="1"
            strokeDasharray="2 1"
          />
        ))}

        {/* Centered Placed Solar Panels PV Array */}
        {placedPanels.map((panel) => {
          const rx = panel.x;
          const ry = panel.y;
          const rw = panel.w;
          const rl = panel.l;

          return (
            <g key={panel.id}>
              {/* High precision Panel block boundary */}
              <rect
                x={toX(rx)}
                y={toY(ry)}
                width={rw * scale}
                height={rl * scale}
                fill="#f9fafb"
                stroke="#111827"
                strokeWidth="2"
                rx="1"
              />
              {/* Solar cell division grids - Highly visible E-ink indicator */}
              <line
                x1={toX(rx + rw / 2)}
                y1={toY(ry)}
                x2={toX(rx + rw / 2)}
                y2={toY(ry + rl)}
                stroke="#374151"
                strokeWidth="0.8"
              />
              {/* Transverse cross indicator representing polycrystalline cell blocks */}
              <line
                x1={toX(rx)}
                y1={toY(ry + rl / 2)}
                x2={toX(rx + rw)}
                y2={toY(ry + rl / 2)}
                stroke="#374151"
                strokeWidth="0.8"
              />
              {/* Direction text marker */}
              <text
                x={toX(rx + rw / 2)}
                y={toY(ry + rl / 2 + 3)}
                textAnchor="middle"
                className="text-[8px] font-black fill-black"
              >
                {panel.rotated ? 'LANDSCAPE' : 'PORTRAIT'}
              </text>
            </g>
          );
        })}

        {/* Dynamic Drafting Dimensions Overlay */}
        {showDimensions && (
          <g>
            {/* Width Dimension Indicator Line */}
            <line x1={toX(0)} y1={toY(-25)} x2={toX(wInches)} y2={toY(-25)} stroke="#000000" strokeWidth="1.5" />
            <line x1={toX(0)} y1={toY(-30)} x2={toX(0)} y2={toY(-20)} stroke="#000000" strokeWidth="1.5" />
            <line x1={toX(wInches)} y1={toY(-30)} x2={toX(wInches)} y2={toY(-20)} stroke="#000000" strokeWidth="1.5" />
            <rect x={toX(wInches / 2) - 28} y={toY(-32)} width="56" height="14" fill="#ffffff" stroke="#111827" strokeWidth="1" />
            <text x={toX(wInches / 2)} y={toY(-22)} textAnchor="middle" className="font-bold font-mono">
              W: {pergola.width} FT
            </text>

            {/* Length Dimension Indicator Line */}
            <line x1={toX(wInches + 25)} y1={toY(0)} x2={toX(wInches + 25)} y2={toY(lInches)} stroke="#000000" strokeWidth="1.5" />
            <line x1={toX(wInches + 20)} y1={toY(0)} x2={toX(wInches + 30)} y2={toY(0)} stroke="#000000" strokeWidth="1.5" />
            <line x1={toX(wInches + 20)} y1={toY(lInches)} x2={toX(wInches + 30)} y2={toY(lInches)} stroke="#000000" strokeWidth="1.5" />
            <rect x={toX(wInches + 10)} y={toY(lInches / 2) - 7} width="62" height="14" fill="#ffffff" stroke="#111827" strokeWidth="1" />
            <text x={toX(wInches + 41)} y={toY(lInches / 2 + 3)} textAnchor="middle" className="font-bold font-mono">
              L: {pergola.length} FT
            </text>

            {/* Post Spacing Indicator (Inside columns spacing bounds) */}
            <line
              x1={toX(overhang)}
              y1={toY(lInches + 20)}
              x2={toX(wInches - overhang)}
              y2={toY(lInches + 20)}
              stroke="#4b5563"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <text x={toX(wInches / 2)} y={toY(lInches + 32)} textAnchor="middle" className="font-mono text-[9px] font-bold fill-zinc-700">
              POST GAP: {((wInches - 2 * overhang) / 12).toFixed(1)} FT
            </text>
            <text x={toX(overhang / 2)} y={toY(lInches + 12)} textAnchor="middle" className="font-mono text-[8px] fill-zinc-650">
              OH: {overhang}&quot;
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Render front elevation side projection
  const renderFrontView = () => {
    const widthSvg = 600;
    const heightSvg = 430;
    const padding = 60;

    const scale = Math.min(
      (widthSvg - 2 * padding) / wInches,
      (heightSvg - 2 * padding) / (hInches + 15) // accommodate ground and post rafters depth
    );

    const xOff = (widthSvg - wInches * scale) / 2;
    const yOff = heightSvg - padding; // anchor baseline at footer

    const toX = (val: number) => xOff + val * scale;
    const toY = (val: number) => yOff - val * scale;

    // Ground footer lines
    return (
      <svg className="w-full h-full bg-white font-mono text-[10px]" viewBox={`0 0 ${widthSvg} ${heightSvg}`}>
        <rect width="100%" height="100%" fill="#ffffff" />
        <line x1={10} y1={toY(0)} x2={widthSvg - 10} y2={toY(0)} stroke="#000000" strokeWidth="2" />
        <text x={20} y={toY(-15)} className="font-black text-[9px]">GRADE GROUND LEVEL</text>

        {/* Concrete underground pillars if buried */}
        {isBuried && (
          <g>
            {legPositions.map((pos, idx) => (
              <g key={`pier-${idx}`}>
                {/* Underground post projection */}
                <rect
                  x={toX(pos.x - postSize / 2)}
                  y={toY(0)}
                  width={postSize * scale}
                  height={24 * scale} // 2ft is 24in deep
                  fill="#e5e7eb"
                  stroke="#111827"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                {/* Concrete footing volume */}
                <path
                  d={`M ${toX(pos.x - postSize - 2)} ${toY(0)} L ${toX(pos.x - postSize - 2)} ${toY(-24)} L ${toX(pos.x + postSize + 2)} ${toY(-24)} L ${toX(pos.x + postSize + 2)} ${toY(0)} Z`}
                  fill="none"
                  stroke="#4b5563"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              </g>
            ))}
            <text x={toX(wInches) + 10} y={toY(-12)} className="fill-zinc-600 text-[8px] font-bold">24&quot; PIERS BELOW GRADE</text>
          </g>
        )}

        {/* Upright wood columns */}
        {legPositions.map((pos, idx) => (
          <g key={`column-${idx}`}>
            <rect
              x={toX(pos.x - postSize / 2)}
              y={toY(hInches)}
              width={postSize * scale}
              height={hInches * scale}
              fill="#fafafa"
              stroke="#000000"
              strokeWidth="2"
            />
            {/* Draw wood texture grains line for retro blueprint look */}
            <line
              x1={toX(pos.x)}
              y1={toY(5)}
              x2={toX(pos.x)}
              y2={toY(hInches - 5)}
              stroke="#e5e7eb"
              strokeWidth="0.8"
            />
            {/* SOLO Footing Sleeve if selected & not buried */}
            {!isBuried && isTojaFooting && (
              <rect
                x={toX(pos.x - (postSize + 0.4) / 2)}
                y={toY(4.5)}
                width={(postSize + 0.4) * scale}
                height={4.5 * scale}
                fill="#111827"
                stroke="#111827"
                rx="1"
              />
            )}
          </g>
        ))}

        {/* Main top support beams (Toja Solid Timber Grid vs Traditional Sistered 2x8) */}
        <rect
          x={toX(isTojaTrio ? overhang : 0)}
          y={toY(hInches)}
          width={(isTojaTrio ? wInches - 2 * overhang : wInches) * scale}
          height={beamH * scale}
          fill="#fafafa"
          stroke="#000000"
          strokeWidth="2"
        />
        <text x={toX(wInches / 2)} y={toY(hInches - beamH / 2 + 1.5)} textAnchor="middle" className="font-bold text-[9px] fill-black">
          {isTojaTrio ? `${selectedBeamLumberWidth} TOJA PERIMETER BEAMS` : 'DOUBLE 2x8 SUPPORT BEAMS'}
        </text>

        {/* Left and Right TRIO corner brackets overlays on Front Elevation if Toja is active */}
        {isTojaTrio && (
          <>
            {/* Left corner joint sleeve */}
            <rect
              x={toX(overhang - postSize / 2 - 0.2)}
              y={toY(hInches + (beamH - postSize) / 2)}
              width={(postSize + 0.4) * scale}
              height={(postSize + 0.4) * scale}
              fill="#111827"
              stroke="#111827"
              rx="1.5"
            />
            {/* Right corner joint sleeve */}
            <rect
              x={toX(wInches - overhang - postSize / 2 - 0.2)}
              y={toY(hInches + (beamH - postSize) / 2)}
              width={(postSize + 0.4) * scale}
              height={(postSize + 0.4) * scale}
              fill="#111827"
              stroke="#111827"
              rx="1.5"
            />
          </>
        )}

        {/* At top, show 2x6 crossbars seated flat on top of the 2x8 side ledger */}
        {widthRafterLines.map((yCoord, idx) => {
          // Crossbars are spacing along Length. Seen from front elevation, they sit at offset points and show end caps
          // We can sketch them as small rect cross section endcaps over depth overhangs
          return (
            <rect
              key={`rafter-cap-${idx}`}
              x={toX(0) - 2} // represent overhang sweep past perimeter slightly
              y={toY(hInches + rafterH)}
              width={(wInches * scale) + 4}
              height={rafterH * scale}
              fill="#ffffff"
              stroke="#111827"
              strokeWidth="1.2"
              opacity={0.15}
            />
          );
        })}

        {/* Show Rafter end cross profiles if viewing head-on */}
        {/* Draw a front-most Rafter profile at hInches + rafterH height spanning entire width to show overhang sweep cantilever */}
        <g>
          {/* Overhanging end cuts */}
          <path
            d={`M ${toX(0)} ${toY(hInches + rafterH)} 
                L ${toX(wInches)} ${toY(hInches + rafterH)} 
                L ${toX(wInches)} ${toY(hInches)} 
                L ${toX(wInches - 4)} ${toY(hInches)}
                L ${toX(wInches - 4)} ${toY(hInches + rafterH - 2)}
                L ${toX(4)} ${toY(hInches + rafterH - 2)}
                L ${toX(4)} ${toY(hInches)}
                L ${toX(0)} ${toY(hInches)} Z`}
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="1.8"
          />
          {/* Classic decorative pergola swoop detail line */}
          <path d={`M ${toX(0)} ${toY(hInches)} C ${toX(3)} ${toY(hInches + 2)}, ${toX(5)} ${toY(hInches + rafterH - 2)} , ${toX(8)} ${toY(hInches + rafterH)}`} stroke="#000000" strokeWidth="1.5" fill="none" />
          <path d={`M ${toX(wInches)} ${toY(hInches)} C ${toX(wInches - 3)} ${toY(hInches + 2)}, ${toX(wInches - 5)} ${toY(hInches + rafterH - 2)} , ${toX(wInches - 8)} ${toY(hInches + rafterH)}`} stroke="#000000" strokeWidth="1.5" fill="none" />
        </g>

        {/* Solar panel layer profiles on very top */}
        {placedPanels.length > 0 && (
          <rect
            x={toX(overhang)}
            y={toY(hInches + rafterH + 2)} // panels set on top flat mount
            width={(wInches - 2 * overhang) * scale}
            height={2.5 * scale} // panel profile height
            fill="#e5e7eb"
            stroke="#000000"
            strokeWidth="1.5"
          />
        )}

        {/* Dimensions on the front view */}
        {showDimensions && (
          <g>
            {/* Height Indicator left side */}
            <line x1={toX(-25)} y1={toY(0)} x2={toX(-25)} y2={toY(hInches)} stroke="#000000" strokeWidth="1.5" />
            <line x1={toX(-30)} y1={toY(0)} x2={toX(-20)} y2={toY(0)} stroke="#000000" strokeWidth="1.5" />
            <line x1={toX(-30)} y1={toY(hInches)} x2={toX(-20)} y2={toY(hInches)} stroke="#000000" strokeWidth="1.5" />
            <rect x={toX(-30) - 52} y={toY(hInches / 2) - 8} width="48" height="15" fill="#ffffff" stroke="#111827" strokeWidth="1" />
            <text x={toX(-30) - 28} y={toY(hInches / 2 + 3.5)} textAnchor="middle" className="font-bold text-[9px]">
              H: {pergola.height} FT
            </text>

            <text x={toX(wInches / 2)} y={toY(hInches + rafterH + 18)} textAnchor="middle" className="font-bold text-[8px] fill-zinc-650">
              CANTILEVER CHANNELS OVERHANG: {overhang} INCHES
            </text>
          </g>
        )}
      </svg>
    );
  };

  // Render 3D isometric view using pure cabinet projected lines
  const renderIsometricView = () => {
    const widthSvg = 600;
    const heightSvg = 430;

    return (
      <svg className="w-full h-full bg-white font-mono text-[10px]" viewBox={`0 0 ${widthSvg} ${heightSvg}`}>
        <defs>
          <pattern id="isoGrid" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f3f4f6" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#isoGrid)" />

        {/* 1. Ground footprints */}
        {legPositions.map((p, idx) => {
          const pt = project(p.x, p.y, 0);
          return (
            <ellipse
              key={`iso-footbase-${idx}`}
              cx={pt.x}
              cy={pt.y}
              rx={6}
              ry={3}
              fill="#e5e7eb"
              stroke="#111827"
              strokeWidth="1.2"
            />
          );
        })}

        {/* 2. Verticals Upright wood Columns */}
        {legPositions.map((p, idx) => {
          const bPt = project(p.x, p.y, 0);
          const tPt = project(p.x, p.y, hInches);
          return (
            <g key={`iso-column-${idx}`}>
              {/* Pillar centerline representing high-contrast drawing style */}
              <line
                x1={bPt.x}
                y1={bPt.y}
                x2={tPt.x}
                y2={tPt.y}
                stroke="#111827"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <line
                x1={bPt.x}
                y1={bPt.y}
                x2={tPt.x}
                y2={tPt.y}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </g>
          );
        })}

        {/* 3. Main Double longitudinal Support Beams at height hInches */}
        {/* We can sketch these as projected lines connecting leg columns parallel to Y-axis */}
        {structuralLinesX.map((xCoord, idx) => {
          const ptStart_outer = project(xCoord - postSize / 2, 0, hInches);
          const ptEnd_outer = project(xCoord - postSize / 2, lInches, hInches);

          const ptStart_inner = project(xCoord + postSize / 2, 0, hInches);
          const ptEnd_inner = project(xCoord + postSize / 2, lInches, hInches);

          return (
            <g key={`iso-girder-${idx}`}>
              <line x1={ptStart_outer.x} y1={ptStart_outer.y} x2={ptEnd_outer.x} y2={ptEnd_outer.y} stroke="#111827" strokeWidth="2.5" />
              <line x1={ptStart_inner.x} y1={ptStart_inner.y} x2={ptEnd_inner.x} y2={ptEnd_inner.y} stroke="#111827" strokeWidth="2" strokeDasharray="3 1" />
            </g>
          );
        })}

        {/* 3.1 Transverse Width-Spanning Support Beams at height hInches (parallel to X-axis) */}
        {[overhang, lInches - overhang].map((yCoord, idx) => {
          const ptStart = project(0, yCoord, hInches);
          const ptEnd = project(wInches, yCoord, hInches);
          return (
            <g key={`iso-transverse-beam-${idx}`}>
              {/* Outer stroke line representing solid wood volume */}
              <line
                x1={ptStart.x}
                y1={ptStart.y}
                x2={ptEnd.x}
                y2={ptEnd.y}
                stroke="#111827"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* 4. top level 2x6 crossbars (spanning across X-axis) */}
        {widthRafterLines.map((yCoord, idx) => {
          const ptStart = project(0, yCoord, hInches + rafterH);
          const ptEnd = project(wInches, yCoord, hInches + rafterH);
          return (
            <g key={`iso-rafter-${idx}`}>
              <line
                x1={ptStart.x}
                y1={ptStart.y}
                x2={ptEnd.x}
                y2={ptEnd.y}
                stroke="#111827"
                strokeWidth="1.8"
                strokeLinecap="square"
              />
            </g>
          );
        })}

        {/* 5. Isometric projected Solar Panels PV Grid overlay */}
        {placedPanels.map((panel, idx) => {
          // project the four corners of each panels
          const p1 = project(panel.x, panel.y, hInches + rafterH + 1);
          const p2 = project(panel.x + panel.w, panel.y, hInches + rafterH + 1);
          const p3 = project(panel.x + panel.w, panel.y + panel.l, hInches + rafterH + 1);
          const p4 = project(panel.x, panel.y + panel.l, hInches + rafterH + 1);

          const ptsString = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;

          return (
            <g key={`iso-panel-${idx}`}>
              {/* Face Polygon */}
              <polygon
                points={ptsString}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="1.8"
              />
              {/* Highlight cross hairs to signify PV cells */}
              <line
                x1={(p1.x + p2.x) / 2}
                y1={(p1.y + p2.y) / 2}
                x2={(p3.x + p4.x) / 2}
                y2={(p3.y + p4.y) / 2}
                stroke="#374151"
                strokeWidth="0.5"
              />
              <line
                x1={(p2.x + p3.x) / 2}
                y1={(p2.y + p3.y) / 2}
                x2={(p4.x + p1.x) / 2}
                y2={(p4.y + p1.y) / 2}
                stroke="#374151"
                strokeWidth="0.5"
              />
            </g>
          );
        })}

        {/* Label and compass directions */}
        <text x="35" y="55" className="font-extrabold text-[12px] uppercase fill-neutral-900 leading-none">
          Drafting View: 3D Cabinet Projection
        </text>
        <text x="35" y="72" className="text-[10px] fill-zinc-650">
          Scale: Axis skewed at 30° / Fore-reduction 0.45
        </text>

        {/* 3D compass */}
        <g transform="translate(530, 80)">
          <line x1="0" y1="0" x2="-20" y2="12" stroke="#111827" strokeWidth="1.5" />
          <text x="-25" y="24" className="font-bold text-[8px] fill-black">L (Y)</text>

          <line x1="0" y1="0" x2="25" y2="0" stroke="#111827" strokeWidth="1.5" />
          <text x="32" y="3" className="font-bold text-[8px] fill-black font-mono">W (X)</text>

          <line x1="0" y1="0" x2="0" y2="-25" stroke="#111827" strokeWidth="1.5" />
          <text x="-3" y="-30" className="font-bold text-[8px] fill-black font-mono">H (Z)</text>
        </g>
      </svg>
    );
  };

  return (
    <div className="border-4 border-black bg-white p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      {/* Schematic Action Toolbar Panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3 select-none">
        <div className="flex items-center gap-1.5.5">
          <span className="font-mono text-xs font-black bg-black text-white px-2 py-1 leading-none uppercase tracking-wider">
            TECHNICAL DRAFT
          </span>
          <span className="hidden sm:inline font-mono text-[10px] text-zinc-550 border border-black px-1.5 py-0.5 opacity-80">
            BOOX CANVAS
          </span>
        </div>

        {/* Tab button layout togglers */}
        <div className="flex items-center border-2 border-black bg-white divide-x-2 divide-black">
          <button
            id="schematic-view-top"
            onClick={() => setViewType('top')}
            className={`px-3 py-1 font-mono text-xs font-black transition-all ${
              viewType === 'top' ? 'bg-black text-white' : 'hover:bg-zinc-100'
            }`}
          >
            TOP (PLAN)
          </button>
          <button
            id="schematic-view-front"
            onClick={() => setViewType('front')}
            className={`px-3 py-1 font-mono text-xs font-black transition-all ${
              viewType === 'front' ? 'bg-black text-white' : 'hover:bg-zinc-100'
            }`}
          >
            FRONT (ELEVATION)
          </button>
          <button
            id="schematic-view-iso"
            onClick={() => setViewType('iso')}
            className={`px-3 py-1 font-mono text-xs font-black transition-all ${
              viewType === 'iso' ? 'bg-black text-white' : 'hover:bg-zinc-100'
            }`}
          >
            3D PROJECTED
          </button>
        </div>

        {/* View helper checkbox parameters */}
        <button
          onClick={() => setShowDimensions(!showDimensions)}
          className={`px-2.5 py-1 border-2 border-black font-mono text-[10px] font-black transition-all ${
            showDimensions ? 'bg-zinc-100' : 'bg-white opacity-60'
          }`}
        >
          {showDimensions ? 'HIDE VALUES' : 'SHOW MEASURES'}
        </button>
      </div>

      {/* SVG Canvas Board */}
      <div className="relative w-full h-[460px] border-2 border-zinc-900 bg-white flex items-center justify-center overflow-hidden">
        {viewType === 'top' && renderTopView()}
        {viewType === 'front' && renderFrontView()}
        {viewType === 'iso' && renderIsometricView()}
      </div>

      {/* Helper technical specification values block */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-zinc-50 border border-black p-3.5 divide-y md:divide-y-0 md:divide-x divide-zinc-200">
        <div>
          <span className="block font-mono text-[9px] uppercase text-zinc-550 font-bold leading-tight">Post Specification</span>
          <span className="block font-mono text-xs font-black text-zinc-900">{pergola.postLumber} Timber ({pergola.legsCount} columns)</span>
        </div>
        <div className="pt-2 md:pt-0 md:pl-3">
          <span className="block font-mono text-[9px] uppercase text-zinc-550 font-bold leading-tight">Sub-Beams Support</span>
          <span className="block font-mono text-xs font-black text-zinc-900">Double sistered 2x8 beams</span>
        </div>
        <div className="pt-2 md:pt-0 md:pl-3">
          <span className="block font-mono text-[9px] uppercase text-zinc-550 font-bold leading-tight">Roof Joists Grid</span>
          <span className="block font-mono text-xs font-black text-zinc-900">2x6 Rafter crossbars @ {pergola.crossbarSpacing}&quot;</span>
        </div>
        <div className="pt-2 md:pt-0 md:pl-3">
          <span className="block font-mono text-[9px] uppercase text-zinc-550 font-bold leading-tight">Active Roof Cantilevers</span>
          <span className="block font-mono text-xs font-black text-zinc-900">{overhang}&quot; Overhang columns offsets</span>
        </div>
      </div>
    </div>
  );
}
