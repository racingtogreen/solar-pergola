import React, { useState, useMemo, useEffect } from 'react';
import { 
  Sun, 
  Layers, 
  Hammer, 
  Printer, 
  RefreshCw, 
  Plus, 
  Minus, 
  Info, 
  Sliders, 
  Layout, 
  Battery, 
  Cpu, 
  Coins, 
  Check, 
  Trash, 
  Sparkles,
  HelpCircle,
  Save,
  FolderOpen,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PergolaSpecs, SolarPanelSpecs, OptimizationResult, PlacedPanel, SavedProject } from './types';
import { optimizeSolarLayout, generateMaterialList, MaterialItem } from './utils/optimizer';
import TechnicalSchematic from './components/TechnicalSchematic';

// Default initial parameter presets
const DEFAULT_PERGOLA: PergolaSpecs = {
  width: 12,          // 12 ft
  length: 12,         // 12 ft
  height: 8.5,        // 8.5 ft
  postLumber: '6x6',
  legsCount: 4,
  overhang: 12,       // 12 inches
  crossbarSpacing: 16, // 16 inches Center-To-Center
  rafterDirection: 'both',
  beamLumber: '6x6',
  beamLength: undefined,
  useTojaTrio: false,
  tojaTrioSize: '6x6',
  useTojaFooting: false,
  tojaFootingSize: '6x6'
};

const DEFAULT_SOLAR: SolarPanelSpecs = {
  width: 1016,        // 1016 mm (approx 40 inches)
  length: 1676,       // 1676 mm (approx 66 inches)
  wattage: 380,       // 380W
  gap: 25,            // 25 mm spacing for mounting mid-clamps
  tiltAngle: 0,
  overhang: 0         // Default allowed panel overhang (mm)
};

// Preset solar panels for quick selection
interface SolarPreset {
  name: string;
  width: number;
  length: number;
  wattage: number;
  description: string;
}

const SOLAR_PRESETS: SolarPreset[] = [
  { name: 'Standard Residential (380W)', width: 1016, length: 1676, wattage: 380, description: 'Standard high-density monochrome residential PV' },
  { name: 'Commercial High-Yield (450W)', width: 1054, length: 2007, wattage: 450, description: 'Larger commercial format with higher voltage output' },
  { name: 'Compact RV/Off-Grid (100W)', width: 513, length: 1016, wattage: 100, description: 'Smaller modules optimal for nested spaces' },
  { name: 'Custom Blueprint Spec', width: 1016, length: 1676, wattage: 380, description: 'Manually specify custom size dimensions' }
];

export default function App() {
  // Core Specs State
  const [pergola, setPergola] = useState<PergolaSpecs>(DEFAULT_PERGOLA);
  const [solar, setSolar] = useState<SolarPanelSpecs>(DEFAULT_SOLAR);
  const [panelsOverride, setPanelsOverride] = useState<number | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [isBuried, setIsBuried] = useState<boolean>(false);
  const [forcedOrientation, setForcedOrientation] = useState<'portrait' | 'landscape' | 'optimized'>('optimized');
  
  // App navigation state within Onyx Boox Interface
  const [activeTab, setActiveTab] = useState<'blueprint' | 'lumber_cut' | 'solar_opt' | 'assembly'>('blueprint');
  
  // Custom interactive notes for the user notebook
  const [activeNotes, setActiveNotes] = useState<string[]>([
    "Determine placement regarding shade from trees or nearby roof pitch structures.",
    "Orient the primary ledger beams to receive secure windward cross-bracing.",
    "Verify local building permits for maximum allowable height for secondary structures."
  ]);
  const [newNote, setNewNote] = useState<string>("");

  // E-ink simulated parameters
  const [eInkInverted, setEInkInverted] = useState<boolean>(false);
  const [eInkRefreshActive, setEInkRefreshActive] = useState<boolean>(false);
  const [eInkBattery, setEInkBattery] = useState<number>(88);
  const [eInkModeActive, setEInkModeActive] = useState<boolean>(true); // E-ink Mode on by default

  // Checklist of construction milestones
  const [milestones, setMilestones] = useState<{ id: string; text: string; done: boolean }[]>([
    { id: 'm1', text: 'Clear site and level ground area', done: true },
    { id: 'm2', text: 'Mark post coordinates based on spacing calculator', done: false },
    { id: 'm3', text: 'Dig post holed or secure structural deck anchor brackets', done: false },
    { id: 'm4', text: 'Cut vertical upright timber posts to plan dimensions', done: false },
    { id: 'm5', text: 'Saddle ledger beams and plumb support posts with temporary braces', done: false },
    { id: 'm6', text: 'Rafter alignment layout and lock hurricane ties', done: false },
    { id: 'm7', text: 'Torque aluminum solar mounting rail brackets', done: false },
    { id: 'm8', text: 'Lay PV panels and secure end/mid clamp assemblies', done: false }
  ]);

  // Saved Projects state
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [isProjectsPanelOpen, setIsProjectsPanelOpen] = useState<boolean>(false);
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>("");

  // Handle panel presets configuration
  const handlePresetSelect = (idx: number) => {
    setSelectedPresetIndex(idx);
    if (idx !== SOLAR_PRESETS.length - 1) {
      setSolar({
        ...solar,
        width: SOLAR_PRESETS[idx].width,
        length: SOLAR_PRESETS[idx].length,
        wattage: SOLAR_PRESETS[idx].wattage
      });
    }
  };

  // Safe numerical increments (E-ink devices operate highly on tap-to-step vs continuous sliders)
  const adjustPergolaDimension = (field: keyof PergolaSpecs, amount: number) => {
    setPergola(prev => {
      let val = (prev[field] as number) + amount;
      // boundary guards
      if (field === 'width' || field === 'length') {
        val = Math.max(8, Math.min(30, val));
      } else if (field === 'height') {
        val = Math.max(7, Math.min(16, val));
      } else if (field === 'overhang') {
        val = Math.max(6, Math.min(36, val));
      } else if (field === 'crossbarSpacing') {
        // hard stop on spacing options: 12, 16, 24
        const options = [12, 16, 24];
        let curIdx = options.indexOf(prev.crossbarSpacing);
        let nextIdx = Math.max(0, Math.min(options.length - 1, curIdx + (amount > 0 ? 1 : -1)));
        val = options[nextIdx];
      }
      return { ...prev, [field]: val };
    });
  };

  const adjustSolarDimension = (field: keyof SolarPanelSpecs, amount: number) => {
    setSolar(prev => {
      let val = Math.max(1, (prev[field] as number) + amount);
      if (field === 'wattage') val = Math.max(50, val);
      return { ...prev, [field]: val };
    });
  };

  const handleSolarInputChange = (field: keyof SolarPanelSpecs, rawValue: string) => {
    setSelectedPresetIndex(SOLAR_PRESETS.length - 1);
    const parsed = parseFloat(rawValue);
    setSolar(prev => {
      const val = isNaN(parsed) ? 0 : parsed;
      return { ...prev, [field]: val };
    });
  };

  const handlePergolaInputChange = (field: keyof PergolaSpecs, rawValue: string) => {
    const parsed = parseFloat(rawValue);
    setPergola(prev => {
      const val = isNaN(parsed) ? 0 : parsed;
      return { ...prev, [field]: val };
    });
  };

  // Run the Optimization Solver
  const maxPossibleResult: OptimizationResult = useMemo(() => {
    return optimizeSolarLayout(pergola, solar, forcedOrientation, null);
  }, [pergola, solar, forcedOrientation]);

  const optimizationResult: OptimizationResult = useMemo(() => {
    return optimizeSolarLayout(pergola, solar, forcedOrientation, panelsOverride);
  }, [pergola, solar, forcedOrientation, panelsOverride]);

  // Safeguard panelsOverride max-bound and reset gracefully if maximum drops below selection
  useEffect(() => {
    if (panelsOverride !== null && maxPossibleResult.panels.length > 0 && panelsOverride > maxPossibleResult.panels.length) {
      setPanelsOverride(maxPossibleResult.panels.length);
    }
  }, [maxPossibleResult.panels.length, panelsOverride]);

  // Run the Bill of Materials calculation
  const materialListResult = useMemo(() => {
    return generateMaterialList(pergola, solar, optimizationResult.panels.length, isBuried);
  }, [pergola, solar, optimizationResult, isBuried]);

  // Precompute rafter totals
  const totalRaftersDetails = useMemo(() => {
    const rafterDir = pergola.rafterDirection || 'width';
    const hasWidthRafters = rafterDir === 'width' || rafterDir === 'both';
    const hasLengthRafters = rafterDir === 'length' || rafterDir === 'both';

    const wInches = pergola.width * 12;
    const lInches = pergola.length * 12;

    const spacingValX = Math.max(1, pergola.crossbarSpacingX || pergola.crossbarSpacing || 16);
    const raftersCountX = pergola.raftersCountX !== undefined && pergola.raftersCountX !== null && pergola.raftersCountX > 0
      ? pergola.raftersCountX
      : (Math.ceil(lInches / spacingValX) + 1);

    const spacingValY = Math.max(1, pergola.crossbarSpacingY || pergola.crossbarSpacing || 16);
    const raftersCountY = pergola.raftersCountY !== undefined && pergola.raftersCountY !== null && pergola.raftersCountY > 0
      ? pergola.raftersCountY
      : (Math.ceil(wInches / spacingValY) + 1);

    const total = (hasWidthRafters ? raftersCountX : 0) + (hasLengthRafters ? raftersCountY : 0);
    return {
      total,
      raftersCountX,
      raftersCountY,
      hasWidthRafters,
      hasLengthRafters,
      rafterDir
    };
  }, [pergola]);

  // Dynamic daily off-grid solar production projections
  const solarProductionDetails = useMemo(() => {
    const totalWatts = optimizationResult.totalWattage;
    const peakSunHours = 4.8; // default standard solar radiation rating
    const conversionEfficiencyFactor = 0.82; // standard inverter conversion/cable drop factor
    const dailyKWh = (totalWatts * peakSunHours * conversionEfficiencyFactor) / 1000;

    // What can you run with this daily power?
    const applianceExamples: { name: string; hrs: number; wattage: number }[] = [
      { name: 'Energy Star Refrigerator', hrs: 24, wattage: 80 },
      { name: 'Laptop Workstation', hrs: 8, wattage: 90 },
      { name: 'LED String Lights', hrs: 6, wattage: 35 },
      { name: 'High-Efficiency Air Heatpump', hrs: 2, wattage: 1200 },
      { name: 'Wi-Fi Cellular Router', hrs: 24, wattage: 15 }
    ];

    const loadPossibilities = applianceExamples.map(app => {
      const dailyDrawKWh = (app.wattage * app.hrs) / 1000;
      const countRunDays = dailyDrawKWh > 0 ? dailyKWh / dailyDrawKWh : 0;
      return {
        ...app,
        drawKWh: dailyDrawKWh,
        factor: countRunDays
      };
    });

    return {
      dailyKWh: dailyKWh,
      yearlyKWh: dailyKWh * 365,
      loads: loadPossibilities
    };
  }, [optimizationResult]);

  // Handle milestone checklist toggles
  const toggleMilestone = (id: string) => {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, done: !m.done } : m));
  };

  // Handle notes add/remove
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (newNote.trim()) {
      setActiveNotes(prev => [...prev, newNote.trim()]);
      setNewNote("");
    }
  };

  const handleClearNote = (index: number) => {
    setActiveNotes(prev => prev.filter((_, i) => i !== index));
  };

  // E-ink refresh flash trigger (imitates real Onyx BOOX screen redraw)
  const triggerEInkRefresh = () => {
    setEInkRefreshActive(true);
    setEInkInverted(true);
    setTimeout(() => {
      setEInkInverted(false);
    }, 280);
    setTimeout(() => {
      setEInkRefreshActive(false);
    }, 600);
  };

  // Automatically update the battery level slightly to give dynamic feel
  useEffect(() => {
    const interval = setInterval(() => {
      setEInkBattery(prev => {
        if (prev <= 10) return 99;
        return prev - 1;
      });
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  // Load saved projects and auto-restore last active design on mount
  useEffect(() => {
    const storedProjects = localStorage.getItem('pergola_solar_projects');
    if (storedProjects) {
      try {
        setSavedProjects(JSON.parse(storedProjects));
      } catch (e) {
        console.error('Error loading saved projects:', e);
      }
    }

    const lastActive = localStorage.getItem('pergola_solar_last_active');
    if (lastActive) {
      try {
        const activeObj = JSON.parse(lastActive);
        if (activeObj.pergola) setPergola(activeObj.pergola);
        if (activeObj.solar) setSolar(activeObj.solar);
        if (activeObj.panelsOverride !== undefined) setPanelsOverride(activeObj.panelsOverride);
        if (activeObj.selectedPresetIndex !== undefined) setSelectedPresetIndex(activeObj.selectedPresetIndex);
        if (activeObj.isBuried !== undefined) setIsBuried(activeObj.isBuried);
        if (activeObj.forcedOrientation !== undefined) setForcedOrientation(activeObj.forcedOrientation);
        if (activeObj.activeNotes !== undefined) setActiveNotes(activeObj.activeNotes);
        if (activeObj.milestones !== undefined) setMilestones(activeObj.milestones);
      } catch (e) {
        console.error('Error restoring last active design:', e);
      }
    }
  }, []);

  // Sync current layout to last_active block in local storage for refresh recovery
  useEffect(() => {
    const current_state = {
      pergola,
      solar,
      panelsOverride,
      selectedPresetIndex,
      isBuried,
      forcedOrientation,
      activeNotes,
      milestones
    };
    localStorage.setItem('pergola_solar_last_active', JSON.stringify(current_state));
  }, [pergola, solar, panelsOverride, selectedPresetIndex, isBuried, forcedOrientation, activeNotes, milestones]);

  // Project Functions
  const handleSaveProject = (nameToSave: string) => {
    const cleanName = nameToSave.trim() || `Design Slot ${savedProjects.length + 1}`;
    
    const newProj: SavedProject = {
      id: 'proj_' + Date.now(),
      name: cleanName,
      timestamp: Date.now(),
      pergola,
      solar,
      panelsOverride,
      selectedPresetIndex,
      isBuried,
      forcedOrientation,
      activeNotes,
      milestones
    };

    const updated = [newProj, ...savedProjects];
    setSavedProjects(updated);
    localStorage.setItem('pergola_solar_projects', JSON.stringify(updated));
    setNewProjectName("");
    setSaveSuccessMessage("PROJECT DESIGN SAVED SUCCESSFULLY!");
    setTimeout(() => setSaveSuccessMessage(""), 3000);
    triggerEInkRefresh();
  };

  const handleLoadProject = (proj: SavedProject) => {
    setPergola(proj.pergola);
    setSolar(proj.solar);
    setPanelsOverride(proj.panelsOverride);
    setSelectedPresetIndex(proj.selectedPresetIndex);
    setIsBuried(proj.isBuried);
    setForcedOrientation(proj.forcedOrientation);
    if (proj.activeNotes) setActiveNotes(proj.activeNotes);
    if (proj.milestones) setMilestones(proj.milestones);
    
    setSaveSuccessMessage(`LOADED DESIGN: ${proj.name.toUpperCase()}`);
    setTimeout(() => setSaveSuccessMessage(""), 3000);
    triggerEInkRefresh();
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedProjects.filter(p => p.id !== id);
    setSavedProjects(updated);
    localStorage.setItem('pergola_solar_projects', JSON.stringify(updated));
    triggerEInkRefresh();
  };

  const handleExportDec = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      version: "1.0",
      exportDate: new Date().toISOString(),
      savedProjects,
      activeProject: {
        pergola,
        solar,
        panelsOverride,
        selectedPresetIndex,
        isBuried,
        forcedOrientation,
        activeNotes,
        milestones
      }
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `solar_pergola_drawing_suite_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportDec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.activeProject) {
            const ap = parsed.activeProject;
            if (ap.pergola) setPergola(ap.pergola);
            if (ap.solar) setSolar(ap.solar);
            if (ap.panelsOverride !== undefined) setPanelsOverride(ap.panelsOverride);
            if (ap.selectedPresetIndex !== undefined) setSelectedPresetIndex(ap.selectedPresetIndex);
            if (ap.isBuried !== undefined) setIsBuried(ap.isBuried);
            if (ap.forcedOrientation !== undefined) setForcedOrientation(ap.forcedOrientation);
            if (ap.activeNotes) setActiveNotes(ap.activeNotes);
            if (ap.milestones) setMilestones(ap.milestones);
          }
          if (Array.isArray(parsed.savedProjects)) {
            const merged = [...parsed.savedProjects, ...savedProjects];
            // Deduplicate by ID
            const uniqueMap = new Map();
            merged.forEach(p => uniqueMap.set(p.id, p));
            const dedupedByUniqueVal = Array.from(uniqueMap.values());
            setSavedProjects(dedupedByUniqueVal);
            localStorage.setItem('pergola_solar_projects', JSON.stringify(dedupedByUniqueVal));
          }
          setSaveSuccessMessage("IMPORT COMPLETED SUCCESSFULLY");
          setTimeout(() => setSaveSuccessMessage(""), 3000);
          triggerEInkRefresh();
        } catch (err) {
          alert("Error parsing backup JSON config. Invalid schema.");
        }
      };
    }
  };

  // Quick print handler for construction blueprint and materials listing
  const handlePrintBlueprint = () => {
    window.print();
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      eInkModeActive ? 'bg-[#f4f4f5] text-black font-sans' : 'bg-slate-100 text-slate-900 font-sans'
    }`}>
      {/* E-ink Simulated Transient Screen Refresh Overlay */}
      <AnimatePresence>
        {eInkRefreshActive && (
          <motion.div 
            id="eink-flash-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0.1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            className={`fixed inset-0 z-50 pointer-events-none flex items-center justify-center ${
              eInkInverted ? 'bg-black/90' : 'bg-white/95'
            }`}
          >
            <div className="text-white font-mono text-xl tracking-widest font-extrabold select-none bg-black px-6 py-4 border-2 border-white rounded-md shadow-2xl">
              REFRESHING DIGITAL INK SCREEN...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto p-4 md:p-8 relative">
        {/* Dynamic Action Toast Notifications */}
        <AnimatePresence>
          {saveSuccessMessage && (
            <motion.div
              id="action-toast"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 border-2 border-dashed border-black bg-emerald-50 text-emerald-950 p-3 font-mono text-xs font-black uppercase text-center tracking-wider flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] z-50 transform"
            >
              <Check className="w-4 h-4 text-emerald-850 shrink-0" />
              <span>{saveSuccessMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved Projects Drawer / Slate Overlay */}
        <AnimatePresence>
          {isProjectsPanelOpen && (
            <motion.div
              id="projects-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
              onClick={() => setIsProjectsPanelOpen(false)}
            >
              <motion.div
                id="projects-modal-content"
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className={`w-full max-w-2xl border-4 border-black p-6 md:p-8 space-y-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${
                  eInkModeActive ? 'bg-white text-black' : 'bg-slate-50 text-slate-900'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Title Banner */}
                <div className="flex justify-between items-center border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 stroke-[2.5]" />
                    <h2 className="font-serif text-xl font-black tracking-tight uppercase">
                      Architectural Saved Designs Slot Manager
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsProjectsPanelOpen(false)}
                    className="p-1 border-2 border-black hover:bg-black hover:text-white transition"
                    title="Close Screen"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Create/Save project segment */}
                <div className="border-2 border-black p-4 bg-zinc-50 space-y-3">
                  <label className="font-mono text-xs font-bold uppercase text-gray-800 block">
                    Save active blueprint as a new template slot:
                  </label>
                  <div className="flex gap-2 flex-col sm:flex-row">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder={`e.g., Backyard Patio ${pergola.width}ft x ${pergola.length}ft`}
                      className="flex-1 font-mono text-xs font-black border-2 border-black p-2 bg-white outline-none rounded-none focus:bg-zinc-105 placeholder-zinc-400 text-black placeholder:text-zinc-500"
                    />
                    <button
                      onClick={() => handleSaveProject(newProjectName)}
                      className="px-4 py-2 text-xs font-mono font-black border-2 border-black bg-black text-white hover:bg-zinc-800 hover:text-stone-100 flex items-center justify-center gap-1.5 transition whitespace-nowrap active:translate-y-0.5"
                    >
                      <Save className="w-4 h-4" />
                      SAVE NEW DESIGN
                    </button>
                  </div>
                </div>

                {/* Active designs grid / list */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-mono text-xs font-bold uppercase text-zinc-500">
                      Your Local Drawing Vault ({savedProjects.length} Slots Saved)
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportDec}
                        className="px-2 py-1 text-[9px] font-mono border border-black uppercase bg-white hover:bg-black hover:text-white transition text-black"
                        title="Backup project file offline"
                      >
                        Backup DB File (JSON)
                      </button>
                      <label className="px-2 py-1 text-[9px] font-mono border border-black uppercase bg-white hover:bg-black hover:text-white transition cursor-pointer text-black">
                        Import File (JSON)
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={handleImportDec}
                        />
                      </label>
                    </div>
                  </div>

                  {savedProjects.length === 0 ? (
                    <div className="border-2 border-black border-dashed p-8 text-center bg-zinc-50/50">
                      <span className="font-mono text-xs font-bold text-zinc-400 block mb-1">
                        Vault Slot Registry is Empty.
                      </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        Customize a patio frame above and click "SAVE NEW DESIGN" to write to system memory (localStorage).
                      </span>
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-black/20 pr-1 select-none space-y-2">
                      {savedProjects.map((p) => {
                        return (
                          <div
                            key={p.id}
                            className="p-3 border-2 border-black bg-white hover:bg-zinc-100 transition flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer"
                            onClick={() => {
                              handleLoadProject(p);
                              setIsProjectsPanelOpen(false);
                            }}
                          >
                            <div className="space-y-0.5 text-left">
                              <div className="font-serif font-black text-sm text-black flex items-center gap-1.5 flex-wrap">
                                <span>{p.name}</span>
                                <span className="font-mono text-[9px] bg-black text-white px-1 leading-none uppercase">
                                  {p.pergola.width}x{p.pergola.length}x{p.pergola.height} FT
                                </span>
                              </div>
                              <div className="font-mono text-[10px] text-zinc-500 flex flex-wrap gap-x-2.5 items-center">
                                <span>Solar: <strong className="text-black">{p.solar.wattage}W preset</strong></span>
                                <span>•</span>
                                <span>Rafters: <strong className="text-black">{p.pergola.raftersCountX || 'Auto'}/{p.pergola.raftersCountY || 'Auto'}</strong></span>
                                <span>•</span>
                                <span>Saved: <strong className="text-zinc-600">{new Date(p.timestamp).toLocaleString()}</strong></span>
                              </div>
                            </div>
                            <div className="flex gap-2 self-stretch sm:self-auto justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadProject(p);
                                  setIsProjectsPanelOpen(false);
                                }}
                                className="px-2.5 py-1.5 text-[10px] font-mono border-2 border-black hover:bg-black hover:text-white transition flex items-center gap-1 bg-white text-black"
                              >
                                <Check className="w-3 h-3" />
                                LOAD
                              </button>
                              <button
                                onClick={(e) => handleDeleteProject(p.id, e)}
                                className="px-2 py-1 text-[10px] font-mono border-2 border-red-800 text-red-900 bg-red-50 hover:bg-red-800 hover:text-white transition flex items-center gap-1"
                              >
                                <Trash className="w-3 h-3" />
                                DELETE
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bottom informative notes */}
                <div id="modal-footer" className="text-[10px] font-mono text-zinc-500 leading-normal bg-zinc-50 p-2.5 border border-zinc-200">
                  <span className="font-black text-zinc-700 block uppercase mb-0.5">INFORMATION INTEGRITY:</span>
                  Plans saved here are compiled locally in your user browser cache storage buffer. Clearing browser storage history or cache memory will reset this registry database. Use the "Backup DB file" to download a local copy of your layouts offline anytime.
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          id="tablet-screen" 
          className={`border-4 border-black p-5 md:p-8 transition-colors duration-200 shadow-xl ${
            eInkModeActive ? 'bg-white' : 'bg-[#fbfbfa]'
          }`}
        >
            
            {/* Header notebook branding and e-ink info board */}
            <div id="notebook-header" className="flex flex-col xl:flex-row justify-between items-start xl:items-center pb-5 mb-6 border-b-4 border-black gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tight font-serif select-all">
                  E-INK PERGOLA & SOLAR ARRAY DESIGNER
                </h1>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <p className="font-mono text-xs text-gray-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-black inline-block animate-pulse"></span>
                    BOOX Technical Drawing Suite • Workspace ID: <strong className="underline">PERGOLA-SOLAR-06-2026</strong>
                  </p>
                  
                  {/* Functional buttons integrated from stylus-rail */}
                  <div className="flex gap-2">
                    <button 
                      id="tool-select"
                      onClick={triggerEInkRefresh}
                      className="px-2 py-1 text-[10px] font-mono font-bold border-2 border-black bg-white hover:bg-gray-100 flex items-center gap-1 transition" 
                      title="Force Screen Refresh"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      REFRESH
                    </button>
                    
                    <button 
                      id="tool-printer"
                      onClick={handlePrintBlueprint}
                      className="px-2 py-1 text-[10px] font-mono font-bold border-2 border-black bg-white hover:bg-gray-100 flex items-center gap-1 transition" 
                      title="Print Blueprint"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      PRINT
                    </button>

                    <button 
                      id="tool-projects"
                      onClick={() => {
                        setNewProjectName(`Blueprint Spec ${pergola.width}x${pergola.length}`);
                        setIsProjectsPanelOpen(true);
                      }}
                      className="px-2 py-1 text-[10px] font-mono font-bold border-2 border-black bg-emerald-50 text-emerald-950 hover:bg-emerald-100 flex items-center gap-1 transition shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] animate-pulse" 
                      title="Manage Saved Designs"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-emerald-800" />
                      DESIGNS ({savedProjects.length})
                    </button>

                    <button 
                      id="eink-theme-toggle"
                      onClick={() => {
                        setEInkModeActive(!eInkModeActive);
                        triggerEInkRefresh();
                      }}
                      className="px-2.5 py-1 text-[10px] font-mono font-black border-2 border-black bg-black text-white hover:bg-gray-800 transition shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      THEME: {eInkModeActive ? 'E-INK ON' : 'STARK COLOR'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick dynamic metrics badges */}
              <div className="flex items-stretch border-2 border-black divide-x-2 divide-black">
                <div className="px-3 py-1 bg-black text-white flex flex-col justify-center">
                  <span className="text-[8px] font-mono font-bold tracking-wider block uppercase">SOLAR YIELD</span>
                  <span className="text-sm font-mono font-black">{optimizationResult.totalWattage} Watts</span>
                </div>
                <div className="px-3 py-1 bg-white text-black flex flex-col justify-center">
                  <span className="text-[8px] font-mono font-bold tracking-wider block uppercase">PANELS PLACED</span>
                  <span className="text-sm font-mono font-black text-center">{optimizationResult.panels.length} units</span>
                </div>
                <div className="px-3 py-1 bg-white text-black flex flex-col justify-center">
                  <span className="text-[8px] font-mono font-bold tracking-wider block uppercase">LUMBER TOTAL</span>
                  <span className="text-sm font-mono font-black text-center">
                    {(materialListResult.materials.filter(m => m.category === 'Lumber').reduce((sum, item) => sum + item.quantity, 0))} Pcs
                  </span>
                </div>
              </div>
            </div>

            {/*
              ========================================================================
              APP SPLIT WORKSPACE: LEFT CONTROL COLUMN | RIGHT TECHNICAL OUTPUTS
              ========================================================================
            */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT DRAUGHTING OPTIONS COLUMN */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* 1. PERGOLA SPECIFICATION CABINET */}
                <div className="border-2 border-black p-4 bg-white space-y-4">
                  <h3 className="font-mono text-sm font-bold bg-black text-white px-2 py-1 inline-block uppercase leading-none">
                    1. Pergola Dimensions (Teak / Fir Wood Frame)
                  </h3>

                   {/* Width manual adjustment */}
                  <div>
                    <label className="font-mono text-xs font-bold uppercase text-gray-800 block mb-1">
                      Total Top Width (X-Axis span)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        id="pergola-width-input"
                        value={pergola.width || ''}
                        onChange={(e) => handlePergolaInputChange('width', e.target.value)}
                        className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                        placeholder="Width"
                        min="1"
                      />
                      <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                        FT
                      </span>
                    </div>
                  </div>

                  {/* Length manual adjustment */}
                  <div>
                    <label className="font-mono text-xs font-bold uppercase text-gray-800 block mb-1">
                      Total Top Length (Y-Axis span)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        id="pergola-length-input"
                        value={pergola.length || ''}
                        onChange={(e) => handlePergolaInputChange('length', e.target.value)}
                        className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                        placeholder="Length"
                        min="1"
                      />
                      <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                        FT
                      </span>
                    </div>
                  </div>

                  {/* Height manual adjustment */}
                  <div>
                    <label className="font-mono text-xs font-bold uppercase text-gray-800 block mb-1">
                      Headroom Post Height (Z-Axis clearance)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        id="pergola-height-input"
                        value={pergola.height || ''}
                        onChange={(e) => handlePergolaInputChange('height', e.target.value)}
                        className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                        placeholder="Height"
                        min="1"
                      />
                      <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                        FT
                      </span>
                    </div>
                  </div>

                  <hr className="border-black border-dashed" />

                  {/* Wood Post Timber Choice Selector */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                        Column Upright size
                      </label>
                      <div className="grid grid-cols-2 border border-black divide-x divide-black bg-white select-none">
                        <button
                          id="lumber-size-4x4"
                          onClick={() => setPergola({ ...pergola, postLumber: '4x4' })}
                          className={`py-1 w-full text-center text-xs font-mono font-bold transition-all ${
                            pergola.postLumber === '4x4' ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                          }`}
                        >
                          4x4
                        </button>
                        <button
                          id="lumber-size-6x6"
                          onClick={() => setPergola({ ...pergola, postLumber: '6x6' })}
                          className={`py-1 w-full text-center text-xs font-mono font-bold transition-all ${
                            pergola.postLumber === '6x6' ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                          }`}
                        >
                          6x6
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                        Legs (Posts) Qty
                      </label>
                      <div className="grid grid-cols-3 border border-black divide-x divide-black bg-white">
                        {[4, 6, 8].map((num) => (
                          <button
                            key={`leg-option-${num}`}
                            id={`legs-qty-${num}`}
                            onClick={() => setPergola({ ...pergola, legsCount: num })}
                            className={`py-1 text-center text-xs font-mono font-bold transition-all ${
                              pergola.legsCount === num ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>                  {/* Top Beams & Custom Sizing Section */}
                  <div className="border border-black p-3.5 bg-zinc-50 space-y-4">
                    <h4 className="font-mono text-xs font-black uppercase text-gray-900 tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Top Beams & Lumber Customizer
                    </h4>

                    {/* Width Beams */}
                    <div className="border border-zinc-200 p-2.5 bg-white space-y-2">
                      <p className="font-mono text-[11px] font-extrabold uppercase text-gray-800 leading-none">
                        Width-Spanning Beams (X-Axis)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-mono text-[9px] text-gray-500 uppercase block mb-1">
                            Lumber Size
                          </label>
                          <div className="grid grid-cols-2 border border-black divide-x divide-black bg-white select-none">
                            {(['4x4', '6x6'] as const).map((size) => (
                              <button
                                key={`beam-size-width-${size}`}
                                type="button"
                                id={`beam-size-width-${size}`}
                                onClick={() => setPergola({ ...pergola, beamLumberWidth: size })}
                                className={`py-1 text-center text-xs font-mono font-bold transition-all ${
                                  (pergola.beamLumberWidth || pergola.beamLumber || pergola.postLumber || '6x6') === size
                                    ? 'bg-black text-white font-black'
                                    : 'hover:bg-gray-100 text-gray-650'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="font-mono text-[9px] text-gray-500 uppercase block mb-1">
                            Beam Lumber Length
                          </label>
                          <select
                            id="beam-length-width-select"
                            value={pergola.beamLengthWidth || ''}
                            onChange={(e) => setPergola({ ...pergola, beamLengthWidth: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            className="w-full font-mono text-xs font-black border-2 border-black p-1 bg-white outline-none rounded-none focus:bg-zinc-100 h-8"
                          >
                            <option value="">Auto (Matches {pergola.width} FT)</option>
                            <option value="8">8 Feet (Standard)</option>
                            <option value="10">10 Feet</option>
                            <option value="12">12 Feet</option>
                            <option value="14">14 Feet</option>
                            <option value="16">16 Feet</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Length Beams */}
                    <div className="border border-zinc-200 p-2.5 bg-white space-y-2">
                      <p className="font-mono text-[11px] font-extrabold uppercase text-gray-800 leading-none">
                        Length-Spanning Girders (Y-Axis)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="font-mono text-[9px] text-gray-500 uppercase block mb-1">
                            Lumber Size
                          </label>
                          <div className="grid grid-cols-2 border border-black divide-x divide-black bg-white select-none">
                            {(['4x4', '6x6'] as const).map((size) => (
                              <button
                                key={`beam-size-length-${size}`}
                                type="button"
                                id={`beam-size-length-${size}`}
                                onClick={() => setPergola({ ...pergola, beamLumberLength: size })}
                                className={`py-1 text-center text-xs font-mono font-bold transition-all ${
                                  (pergola.beamLumberLength || pergola.beamLumber || pergola.postLumber || '6x6') === size
                                    ? 'bg-black text-white font-black'
                                    : 'hover:bg-gray-100 text-gray-650'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="font-mono text-[9px] text-gray-500 uppercase block mb-1">
                            Beam Lumber Length
                          </label>
                          <select
                            id="beam-length-length-select"
                            value={pergola.beamLengthLength || ''}
                            onChange={(e) => setPergola({ ...pergola, beamLengthLength: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                            className="w-full font-mono text-xs font-black border-2 border-black p-1 bg-white outline-none rounded-none focus:bg-zinc-100 h-8"
                          >
                            <option value="">Auto (Matches {pergola.length} FT)</option>
                            <option value="8">8 Feet (Standard)</option>
                            <option value="10">10 Feet</option>
                            <option value="12">12 Feet</option>
                            <option value="14">14 Feet</option>
                            <option value="16">16 Feet</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Toja Grid Premium Brackets Section */}
                  <div className="border border-black p-3.5 bg-white space-y-4">
                    <h4 className="font-mono text-xs font-black uppercase text-[#111827] tracking-wider flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      Toja Grid Brand Connectors
                    </h4>

                    {/* TRIO Corner Brackets Choice */}
                    <div className="space-y-2 border border-black p-2.5 bg-zinc-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-[11px] font-extrabold uppercase text-gray-900 leading-none">
                            TRIO 3-Way Corner Brackets
                          </p>
                          <p className="text-[9px] text-gray-500 font-mono mt-0.5">Heavy industrial corner sleeve joints</p>
                        </div>
                        <button
                          type="button"
                          id="toja-trio-toggle"
                          onClick={() => setPergola({ ...pergola, useTojaTrio: !pergola.useTojaTrio })}
                          className={`px-3 py-1 font-mono text-[10px] font-black border-2 border-black transition-all ${
                            pergola.useTojaTrio
                              ? 'bg-amber-400 text-black font-black'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {pergola.useTojaTrio ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      {pergola.useTojaTrio && (
                        <div className="pt-2 border-t border-dashed border-gray-400 flex items-center justify-between">
                          <label className="font-mono text-[10px] text-gray-600 uppercase font-bold">
                            Trio Sleeve Size:
                          </label>
                          <div className="flex border border-black divide-x divide-black bg-white select-none">
                            {(['4x4', '6x6'] as const).map((size) => (
                              <button
                                key={`trio-size-${size}`}
                                type="button"
                                id={`trio-size-${size}`}
                                onClick={() => setPergola({ ...pergola, tojaTrioSize: size })}
                                className={`px-2.5 py-0.5 text-center text-[11px] font-mono font-bold transition-all ${
                                  (pergola.tojaTrioSize || pergola.beamLumber || '6x6') === size
                                    ? 'bg-black text-white font-black'
                                    : 'hover:bg-gray-100 text-gray-650'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SOLO Post Footing Brackets Choice */}
                    <div className="space-y-2 border border-black p-2.5 bg-zinc-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-mono text-[11px] font-extrabold uppercase text-gray-900 leading-none">
                            SOLO Post Footing Brackets
                          </p>
                          <p className="text-[9px] text-gray-500 font-mono mt-0.5">Secures vertical post legs to concrete pad/deck</p>
                        </div>
                        <button
                          type="button"
                          id="toja-footing-toggle"
                          onClick={() => {
                            const newValue = !pergola.useTojaFooting;
                            setPergola({ 
                              ...pergola, 
                              useTojaFooting: newValue, 
                            });
                            if (newValue) {
                              setIsBuried(false);
                            }
                          }}
                          className={`px-3 py-1 font-mono text-[10px] font-black border-2 border-black transition-all ${
                            pergola.useTojaFooting
                              ? 'bg-amber-400 text-black font-black'
                              : 'bg-white text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {pergola.useTojaFooting ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </div>

                      {pergola.useTojaFooting && (
                        <div className="pt-2 border-t border-dashed border-gray-400 flex items-center justify-between">
                          <label className="font-mono text-[10px] text-gray-600 uppercase font-bold">
                            SOLO Footing Sleeve Size:
                          </label>
                          <div className="flex border border-black divide-x divide-black bg-white select-none">
                            {(['4x4', '6x6'] as const).map((size) => (
                              <button
                                key={`footing-size-${size}`}
                                type="button"
                                id={`footing-size-${size}`}
                                onClick={() => setPergola({ ...pergola, tojaFootingSize: size })}
                                className={`px-2.5 py-0.5 text-center text-[11px] font-mono font-bold transition-all ${
                                  (pergola.tojaFootingSize || pergola.postLumber || '6x6') === size
                                    ? 'bg-black text-white font-black'
                                    : 'hover:bg-gray-100 text-gray-650'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info block explaining default crossbar specs */}
                  <div className="border border-black p-3.5 bg-zinc-50 font-mono text-[10px] text-zinc-700 leading-relaxed space-y-1">
                    <p className="font-extrabold uppercase text-black text-[11px] tracking-wide">
                      Roof Crossbars & Supporting Beams:
                    </p>
                    <p>• Top structural rafters use standard heavy-duty <strong className="text-black">2x6 lumber</strong> spanning across the pergola structure as requested.</p>
                    {pergola.useTojaTrio ? (
                      <p>• Connected with premium Toja Grid <strong className="text-black">TRIO system</strong> steel corner brackets to create a flush, clean, modern nested frame.</p>
                    ) : (
                      <p>• Double longitudinal load-bearing girders use <strong className="text-black">2x8 timber boards</strong> sistered alongside the columns to carry the solar load.</p>
                    )}
                  </div>

                  {/* Overhang and interactive Rafter multi-axis spacing system */}
                  <div className="space-y-4">
                    <div>
                      <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                        Rafter Overhang (at columns)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          id="overhang-input"
                          value={pergola.overhang || ''}
                          onChange={(e) => handlePergolaInputChange('overhang', e.target.value)}
                          className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-8 outline-none rounded-none focus:bg-zinc-50"
                          placeholder="Overhang"
                          min="0"
                        />
                        <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                          &quot;
                        </span>
                      </div>
                    </div>

                    <div className="border-2 border-black p-3 bg-stone-50 space-y-4">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="font-mono text-[11px] font-bold uppercase text-gray-800">
                            Rafter System Orientation
                          </label>
                          <span className="font-mono text-[9px] font-black uppercase text-gray-500 border border-black bg-white px-1 py-0.5">
                            {pergola.rafterDirection || 'width'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 border border-black divide-x divide-black bg-white">
                          {[
                            { val: 'width', label: 'Spans Width (X)' },
                            { val: 'length', label: 'Spans Length (Y)' },
                            { val: 'both', label: 'Both (Cross Grid)' }
                          ].map((opt) => (
                            <button
                              key={`rafter-dir-${opt.val}`}
                              type="button"
                              onClick={() => setPergola(prev => ({ ...prev, rafterDirection: opt.val as any }))}
                              className={`py-1.5 text-center text-[10px] font-mono leading-tight transition-all uppercase select-none ${
                                (pergola.rafterDirection || 'width') === opt.val
                                  ? 'bg-black text-white font-black'
                                  : 'hover:bg-gray-100 text-black font-bold'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Width Spanning (X) Controls */}
                      {totalRaftersDetails.hasWidthRafters && (
                        <div className="space-y-2 border-t border-black border-dashed pt-3">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[10px] font-black text-black uppercase tracking-wider">
                              [X] Width-Spanning (Horizontal)
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setPergola(prev => ({ ...prev, raftersCountX: null }))}
                                className={`px-1.5 py-0.5 text-[9px] font-mono border border-black uppercase leading-none select-none ${
                                  pergola.raftersCountX === null || pergola.raftersCountX === undefined ? 'bg-black text-white font-bold' : 'bg-white hover:bg-gray-100'
                                }`}
                              >
                                Auto Spaced
                              </button>
                              <button
                                type="button"
                                onClick={() => setPergola(prev => ({ ...prev, raftersCountX: -1 }))}
                                className={`px-1.5 py-0.5 text-[9px] font-mono border border-black uppercase leading-none select-none ${
                                  pergola.raftersCountX !== null && pergola.raftersCountX !== undefined ? 'bg-black text-white font-bold' : 'bg-white hover:bg-gray-100'
                                }`}
                              >
                                Custom Qty
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-mono text-[10px] text-gray-500 block">Spacing (in)</span>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  value={pergola.crossbarSpacingX === undefined || pergola.crossbarSpacingX === null ? '' : pergola.crossbarSpacingX}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setPergola(prev => ({ ...prev, crossbarSpacingX: isNaN(val) ? null : val }));
                                  }}
                                  onBlur={() => {
                                    if (pergola.crossbarSpacingX !== undefined && pergola.crossbarSpacingX !== null && (pergola.crossbarSpacingX <= 0 || isNaN(pergola.crossbarSpacingX))) {
                                      setPergola(prev => ({ ...prev, crossbarSpacingX: 16 }));
                                    }
                                  }}
                                  disabled={pergola.raftersCountX !== null && pergola.raftersCountX !== undefined}
                                  className="w-full font-mono text-xs font-black border-2 border-black p-1.5 pr-8 outline-none rounded-none focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                  placeholder="16"
                                  min="4"
                                  max="48"
                                />
                                <span className="absolute right-2 font-mono text-[10px] text-gray-500 pointer-events-none">&quot;</span>
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-gray-500 block">Total Qty</span>
                              <input
                                type="number"
                                value={pergola.raftersCountX === undefined || pergola.raftersCountX === null || pergola.raftersCountX <= 0 ? '' : pergola.raftersCountX}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setPergola(prev => ({ ...prev, raftersCountX: isNaN(val) ? -1 : val }));
                                }}
                                onBlur={() => {
                                  if (pergola.raftersCountX === null || pergola.raftersCountX === undefined || isNaN(pergola.raftersCountX) || pergola.raftersCountX <= 0) {
                                    const autoCountX = Math.ceil((pergola.length * 12) / Math.max(1, pergola.crossbarSpacingX || pergola.crossbarSpacing || 16)) + 1;
                                    setPergola(prev => ({ ...prev, raftersCountX: autoCountX }));
                                  } else {
                                    setPergola(prev => ({ ...prev, raftersCountX: Math.max(2, pergola.raftersCountX as number) }));
                                  }
                                }}
                                disabled={pergola.raftersCountX === null || pergola.raftersCountX === undefined}
                                className="w-full font-mono text-xs font-black border-2 border-black p-1.5 outline-none rounded-none focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder={String(totalRaftersDetails.raftersCountX)}
                                min="2"
                                max="100"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Length Spanning (Y) Controls */}
                      {totalRaftersDetails.hasLengthRafters && (
                        <div className="space-y-2 border-t border-black border-dashed pt-3">
                          <div className="flex justify-between items-center">
                            <span className="font-mono text-[10px] font-black text-black uppercase tracking-wider">
                              [Y] Length-Spanning (Vertical)
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => setPergola(prev => ({ ...prev, raftersCountY: null }))}
                                className={`px-1.5 py-0.5 text-[9px] font-mono border border-black uppercase leading-none select-none ${
                                  pergola.raftersCountY === null || pergola.raftersCountY === undefined ? 'bg-black text-white font-bold' : 'bg-white hover:bg-gray-100'
                                }`}
                              >
                                Auto Spaced
                              </button>
                              <button
                                type="button"
                                onClick={() => setPergola(prev => ({ ...prev, raftersCountY: -1 }))}
                                className={`px-1.5 py-0.5 text-[9px] font-mono border border-black uppercase leading-none select-none ${
                                  pergola.raftersCountY !== null && pergola.raftersCountY !== undefined ? 'bg-black text-white font-bold' : 'bg-white hover:bg-gray-100'
                                }`}
                              >
                                Custom Qty
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-mono text-[10px] text-gray-500 block">Spacing (in)</span>
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  value={pergola.crossbarSpacingY === undefined || pergola.crossbarSpacingY === null ? '' : pergola.crossbarSpacingY}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setPergola(prev => ({ ...prev, crossbarSpacingY: isNaN(val) ? null : val }));
                                  }}
                                  onBlur={() => {
                                    if (pergola.crossbarSpacingY !== undefined && pergola.crossbarSpacingY !== null && (pergola.crossbarSpacingY <= 0 || isNaN(pergola.crossbarSpacingY))) {
                                      setPergola(prev => ({ ...prev, crossbarSpacingY: 16 }));
                                    }
                                  }}
                                  disabled={pergola.raftersCountY !== null && pergola.raftersCountY !== undefined}
                                  className="w-full font-mono text-xs font-black border-2 border-black p-1.5 pr-8 outline-none rounded-none focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                  placeholder="16"
                                  min="4"
                                  max="48"
                                />
                                <span className="absolute right-2 font-mono text-[10px] text-gray-500 pointer-events-none">&quot;</span>
                              </div>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] text-gray-500 block">Total Qty</span>
                              <input
                                type="number"
                                value={pergola.raftersCountY === undefined || pergola.raftersCountY === null || pergola.raftersCountY <= 0 ? '' : pergola.raftersCountY}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  setPergola(prev => ({ ...prev, raftersCountY: isNaN(val) ? -1 : val }));
                                }}
                                onBlur={() => {
                                  if (pergola.raftersCountY === null || pergola.raftersCountY === undefined || isNaN(pergola.raftersCountY) || pergola.raftersCountY <= 0) {
                                    const autoCountY = Math.ceil((pergola.width * 12) / Math.max(1, pergola.crossbarSpacingY || pergola.crossbarSpacing || 16)) + 1;
                                    setPergola(prev => ({ ...prev, raftersCountY: autoCountY }));
                                  } else {
                                    setPergola(prev => ({ ...prev, raftersCountY: Math.max(2, pergola.raftersCountY as number) }));
                                  }
                                }}
                                disabled={pergola.raftersCountY === null || pergola.raftersCountY === undefined}
                                className="w-full font-mono text-xs font-black border-2 border-black p-1.5 outline-none rounded-none focus:bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder={String(totalRaftersDetails.raftersCountY)}
                                min="2"
                                max="100"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Burial config selector type */}
                  <div className="flex items-center gap-3 bg-gray-50 p-2.5 border border-dashed border-gray-400">
                    <button
                      id="mounting-anchor-type"
                      onClick={() => {
                        const nextVal = !isBuried;
                        setIsBuried(nextVal);
                        if (nextVal) {
                          setPergola({ ...pergola, useTojaFooting: false });
                        }
                      }}
                      className={`w-5 h-5 border-2 border-black flex items-center justify-center transition ${
                        isBuried ? 'bg-black text-white' : 'bg-white'
                      }`}
                    >
                      {isBuried && <Check className="w-4 h-4" />}
                    </button>
                    <div>
                      <span className="font-mono text-xs font-bold text-gray-900 block leading-tight">
                        Deep Frost Post-Burial (+2 FT underground)
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        Extends upright timbers for deep sub-grade concrete footing pour.
                      </span>
                    </div>
                  </div>

                  {/* Flush-Mount Rafters with Metal brackets Option */}
                  <div className="flex items-center gap-3 bg-gray-50 p-2.5 border border-dashed border-gray-400">
                    <button
                      id="flush-mount-rafters-toggle"
                      onClick={() => setPergola(prev => ({ ...prev, flushMountRafters: !prev.flushMountRafters }))}
                      className={`w-5 h-5 border-2 border-black flex items-center justify-center transition ${
                        pergola.flushMountRafters ? 'bg-black text-white' : 'bg-white'
                      }`}
                    >
                      {pergola.flushMountRafters && <Check className="w-4 h-4" />}
                    </button>
                    <div>
                      <span className="font-mono text-xs font-bold text-gray-900 block leading-tight">
                        Flush-Mount Rafters (Metal Hangers)
                      </span>
                      <span className="text-[10px] font-mono text-gray-500">
                        Fits rafters level/inside headers using heavy-duty galvanized face-mount hanger brackets.
                      </span>
                    </div>
                  </div>

                </div>

                {/* 2. SOLAR PV PANELS CONFIGURATION */}
                <div className="border-2 border-black p-4 bg-white space-y-4">
                  <h3 className="font-mono text-sm font-bold bg-black text-white px-2 py-1 inline-block uppercase leading-none">
                    2. Choose Solar Panels Specification
                  </h3>

                  {/* Panel presets list */}
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1.5">
                      Select Standard PV Panel Module Presets
                    </label>
                    <select
                      id="preset-selection"
                      value={selectedPresetIndex}
                      onChange={(e) => handlePresetSelect(parseInt(e.target.value))}
                      className="w-full font-mono text-xs font-bold border-2 border-black bg-white p-1.5"
                    >
                      {SOLAR_PRESETS.map((preset, idx) => (
                        <option key={`preset-${idx}`} value={idx}>
                          {preset.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-gray-500 font-mono block mt-1">
                      {SOLAR_PRESETS[selectedPresetIndex].description}
                    </span>
                  </div>

                  {/* Panel Dimensions and Wattages custom tuning */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                          Panel Width
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            id="panel-width-input"
                            value={solar.width || ''}
                            onChange={(e) => handleSolarInputChange('width', e.target.value)}
                            className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                            placeholder="Width"
                            min="1"
                          />
                          <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                            mm
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                          Panel Length
                        </label>
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            id="panel-length-input"
                            value={solar.length || ''}
                            onChange={(e) => handleSolarInputChange('length', e.target.value)}
                            className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                            placeholder="Length"
                            min="1"
                          />
                          <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                            mm
                          </span>
                        </div>
                      </div>
                    </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                        Nominal Wattage
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          id="panel-wattage-input"
                          value={solar.wattage || ''}
                          onChange={(e) => handleSolarInputChange('wattage', e.target.value)}
                          className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-8 outline-none rounded-none focus:bg-zinc-50"
                          placeholder="Watts"
                          min="1"
                        />
                        <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                          W
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                        Spacing Gap (Clamps)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          id="panel-gap-input"
                          value={solar.gap || ''}
                          onChange={(e) => handleSolarInputChange('gap', e.target.value)}
                          className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                          placeholder="Gap"
                          min="0"
                        />
                        <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                          mm
                        </span>
                      </div>
                    </div>
                  </div>

                   <hr className="border-black border-dashed" />

                  {/* Panel Overhang Manual Tuning */}
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                      Allowed Panel Overhang (past pergola edge)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        id="panel-overhang-input"
                        value={solar.overhang ?? 0}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSolar(prev => ({
                            ...prev,
                            overhang: isNaN(val) ? 0 : val
                          }));
                        }}
                        className="w-full font-mono text-xs font-black border-2 border-black p-2.5 pr-10 outline-none rounded-none focus:bg-zinc-50"
                        placeholder="Overhang distance"
                        min="0"
                      />
                      <span className="absolute right-3 font-mono text-[11px] font-black text-gray-500 pointer-events-none select-none">
                        mm
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono block mt-1">
                      Let PV modules overhang the rafters to gain auxiliary roof surface surface area.
                    </span>
                  </div>

                  {/* Manual Panel overriding quantity selection */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="font-mono text-[11px] font-bold uppercase text-gray-800">
                        Choose Number of Panels
                      </label>
                      <span className="font-mono text-[11px] font-black underline bg-gray-100 border border-black px-1">
                        {panelsOverride === null ? 'AUTO (MAX)' : `${panelsOverride} PLACED`}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 border border-black divide-x divide-black bg-white text-center">
                      <button
                        type="button"
                        onClick={() => setPanelsOverride(null)}
                        className={`py-1.5 text-[10px] font-mono leading-none transition-all ${
                          panelsOverride === null ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                        }`}
                      >
                        MAX FIT ({maxPossibleResult.panels.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanelsOverride(Math.min(maxPossibleResult.panels.length, panelsOverride ?? 4))}
                        className={`py-1.5 text-[10px] font-mono leading-none transition-all ${
                          panelsOverride !== null ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                        }`}
                      >
                        CUSTOM OVERRIDE
                      </button>
                    </div>

                    {panelsOverride !== null && (
                      <div className="mt-3 p-3 border-2 border-black border-dashed bg-stone-50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-gray-500">Panel quantity clamp:</span>
                          <span className="font-mono text-xs font-black">{panelsOverride} / {maxPossibleResult.panels.length} Max</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max={maxPossibleResult.panels.length || 1}
                            value={Math.min(panelsOverride, maxPossibleResult.panels.length || 1)}
                            onChange={(e) => setPanelsOverride(parseInt(e.target.value))}
                            className="flex-1 h-1 bg-black rounded-none cursor-pointer accent-black"
                          />
                          <input
                            type="number"
                            value={panelsOverride === null ? '' : panelsOverride}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setPanelsOverride(isNaN(val) ? null : val);
                            }}
                            onBlur={() => {
                              if (panelsOverride === null || isNaN(panelsOverride) || panelsOverride <= 0) {
                                setPanelsOverride(Math.max(1, maxPossibleResult.panels.length));
                              } else {
                                setPanelsOverride(Math.max(1, Math.min(panelsOverride, maxPossibleResult.panels.length)));
                              }
                            }}
                            className="w-14 font-mono text-xs font-black border-2 border-black p-1 text-center"
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono block leading-tight">
                          We dynamically place panels starting from the structure center to maintain static balance.
                        </span>
                      </div>
                    )}
                  </div>

                  <hr className="border-black border-dashed" />

                  {/* Orientation solver algorithm options */}
                  <div>
                    <label className="font-mono text-[11px] font-bold uppercase text-gray-800 block mb-1">
                      Solar Array Placement Optimizer Target
                    </label>
                    <div className="grid grid-cols-3 border border-black divide-x divide-black bg-white text-center">
                      <button
                        id="align-portrait"
                        onClick={() => setForcedOrientation('portrait')}
                        className={`py-1.5 text-[10px] font-mono leading-none transition-all ${
                          forcedOrientation === 'portrait' ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                        }`}
                      >
                        PORTRAITS ON-CENT
                      </button>
                      <button
                        id="align-landscape"
                        onClick={() => setForcedOrientation('landscape')}
                        className={`py-1.5 text-[10px] font-mono leading-none transition-all ${
                          forcedOrientation === 'landscape' ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                        }`}
                      >
                        LANDSCAPES ON-CENT
                      </button>
                      <button
                        id="align-best"
                        onClick={() => setForcedOrientation('optimized')}
                        className={`py-1.5 text-[10px] font-mono leading-none transition-all flex items-center justify-center gap-0.5 ${
                          forcedOrientation === 'optimized' ? 'bg-black text-white font-black' : 'hover:bg-gray-100'
                        }`}
                      >
                        AUTO BEST DENSITY
                      </button>
                    </div>
                  </div>

                </div>

              </div>

              {/* RIGHT STATED DESIGN WORKSPACE & BLUEPRINT SCREEN */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* 1. Main Navigation Tabs */}
                <div id="workspace-tabs" className="flex border-b-2 border-black divide-x border-t border-r border-l divide-black border-black bg-stone-50 select-none">
                  <button
                    id="tab-btn-blueprint"
                    onClick={() => setActiveTab('blueprint')}
                    className={`flex-1 py-3 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 ${
                      activeTab === 'blueprint' ? 'bg-white border-b-4 border-b-black font-black' : 'hover:bg-gray-100'
                    }`}
                  >
                    <Layout className="w-4 h-4" />
                    Interactive Blueprint CAD
                  </button>
                  <button
                    id="tab-btn-solar"
                    onClick={() => setActiveTab('solar_opt')}
                    className={`flex-1 py-3 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 ${
                      activeTab === 'solar_opt' ? 'bg-white border-b-4 border-b-black font-black' : 'hover:bg-gray-100'
                    }`}
                  >
                    <Battery className="w-4 h-4" />
                    Active Solar Analysis
                  </button>
                  <button
                    id="tab-btn-lumber"
                    onClick={() => setActiveTab('lumber_cut')}
                    className={`flex-1 py-3 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 ${
                      activeTab === 'lumber_cut' ? 'bg-white border-b-4 border-b-black font-black' : 'hover:bg-gray-100'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    Timber & Cost Ledger
                  </button>
                  <button
                    id="tab-btn-assembly"
                    onClick={() => setActiveTab('assembly')}
                    className={`flex-1 py-3 text-xs font-mono font-bold uppercase transition flex items-center justify-center gap-2 ${
                      activeTab === 'assembly' ? 'bg-white border-b-4 border-b-black font-black' : 'hover:bg-gray-100'
                    }`}
                  >
                    <Hammer className="w-4 h-4" />
                    Assembly Notebook
                  </button>
                </div>

                {/* 2. Interactive CAD workspace container */}
                <div id="interactive-tablet-workspace">
                  
                  {activeTab === 'blueprint' && (
                    <div id="cad-pane" className="space-y-4">
                      {/* Embed the technical drawing vector viewport */}
                      <TechnicalSchematic 
                        pergola={pergola} 
                        solar={solar} 
                        placedPanels={optimizationResult.panels} 
                        isBuried={isBuried}
                      />
                      
                      {/* Real-time measurement metrics bottom tray */}
                      <div className="border-2 border-black bg-stone-50 p-3.5 font-mono text-xs grid grid-cols-2 sm:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-300">
                        <div className="pt-2 sm:pt-0">
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">Total Top Deck</span>
                          <strong className="text-sm">{(pergola.width * pergola.length).toFixed(2)} SQ FT</strong>
                          <span className="text-[9px] text-gray-400 block mt-0.5">{pergola.width}' × {pergola.length}'</span>
                        </div>
                        <div className="pt-2 sm:pt-0 sm:pl-4">
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">Active Solar Span</span>
                          <strong className="text-sm">{optimizationResult.panels.length} Panels</strong>
                          <span className="text-[9px] text-gray-400 block mt-0.5">{optimizationResult.efficiencyPercent.toFixed(2)}% roof coverage</span>
                        </div>
                        <div className="pt-2 sm:pt-0 sm:pl-4">
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">Rafter Count</span>
                          <strong className="text-sm border-b border-dashed border-gray-300">
                            {totalRaftersDetails.total} Spans
                          </strong>
                          <span className="text-[9px] text-gray-400 block mt-0.5">
                            {totalRaftersDetails.rafterDir === 'both' ? 'Cross grid' : 'Parallel run'}
                          </span>
                        </div>
                        <div className="pt-2 sm:pt-0 sm:pl-4">
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">Main Beams Length</span>
                          <strong className="text-sm">{pergola.length} FT beams</strong>
                          <span className="text-[9px] text-gray-400 block mt-0.5">Dual 2x8 sand.</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'solar_opt' && (
                    <div id="solar-analysis-pane" className="border-2 border-black p-5 bg-white space-y-6">
                      <div className="border-b-2 border-black pb-3">
                        <h4 className="font-serif text-lg font-black tracking-tight flex items-center gap-2">
                          <Sun className="w-5 h-5 text-black" />
                          PV Array Production & Utility Analysis
                        </h4>
                        <p className="font-mono text-[11px] text-gray-600">
                          Algorithmic calculations targeting standard off-grid usage arrays. Includes inverter buffer drops.
                        </p>
                      </div>

                      {/* Main Power Generation Block */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 border border-black p-4">
                        <div>
                          <span className="font-mono text-xs text-gray-500 block font-bold uppercase">Estimated Peak Energy Output</span>
                          <strong className="text-3xl font-mono font-black">{optimizationResult.totalWattage} Peak Watts</strong>
                          <div className="mt-2 font-mono text-[11px] text-gray-800 space-y-1">
                            <div>• Total panels: <strong>{optimizationResult.panels.length} panels</strong></div>
                            <div>• Average panel capacity: <strong>{solar.wattage}W</strong></div>
                            <div>• Mounting: <strong>Coplanar Flat Rails</strong></div>
                          </div>
                        </div>

                        <div className="border-t md:border-t-0 md:border-l border-gray-300 pt-4 md:pt-0 md:pl-6 flex flex-col justify-center">
                          <span className="font-mono text-xs text-gray-500 block font-bold uppercase">Expected Daily Solar Generation</span>
                          <strong className="text-3xl font-mono font-black text-black">{solarProductionDetails.dailyKWh.toFixed(2)} kWh/day</strong>
                          <span className="text-[11px] font-mono text-gray-600 block mt-1">
                            Approx. <strong>{solarProductionDetails.yearlyKWh.toFixed(2)} kWh/year</strong> of carbon-neutral clean energy.
                          </span>
                        </div>
                      </div>

                      {/* Power Off-Grid Appliance Loadings list */}
                      <div>
                        <h5 className="font-mono text-xs font-black uppercase text-gray-800 mb-2">
                          WHAT CAN YOU POWER DAILY? (Load Capacity Calculator)
                        </h5>
                        <div className="border border-black divide-y divide-black">
                          {solarProductionDetails.loads.map((app, idx) => (
                            <div key={`app-load-${idx}`} className="p-2.5 flex items-center justify-between font-mono text-xs hover:bg-gray-50">
                              <div>
                                <span className="font-bold text-black">{app.name}</span>
                                <span className="text-[10px] text-gray-400 block">Rating: {app.wattage}W • runs {app.hrs} hrs/day ({app.drawKWh.toFixed(2)} kWh)</span>
                              </div>
                              <div className="text-right">
                                {app.factor >= 1.0 ? (
                                  <span className="inline-block bg-black text-white font-black text-[10px] px-2 py-0.5">
                                    Runs continuously ({app.factor.toFixed(2)}x margin)
                                  </span>
                                ) : app.factor > 0.0 ? (
                                  <span className="inline-block border border-black font-bold text-[10px] px-2 py-0.5">
                                    Runs up to {(app.hrs * app.factor).toFixed(2)} hours/day
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-red-600 font-bold">Wattage exceeds capacity</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick advice message */}
                      <p className="font-mono text-[10px] text-gray-500 leading-tight">
                        * Note: Above estimations assume a solar irradiation rating of 4.8 Peak Sun Hours (typical for mid-latitudes). Real-world production may vary based on cloud density, seasonal azimuth tilt changes, and surrounding tree heights.
                      </p>
                    </div>
                  )}

                  {activeTab === 'lumber_cut' && (
                    <div id="lumber-cut-pane" className="border-2 border-black p-5 bg-white space-y-6">
                      <div className="border-b-2 border-black pb-3 flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <h4 className="font-serif text-lg font-black tracking-tight">
                            Lumber Cut List & Construction Ledger
                          </h4>
                          <p className="font-mono text-[11px] text-gray-600">
                            Pre-calculated timber, brackets, and active fastener units based on selected dimensions.
                          </p>
                        </div>
                        <button
                          onClick={handlePrintBlueprint}
                          className="px-3 py-1 bg-black text-white hover:bg-gray-800 font-mono text-xs font-bold uppercase transition flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print Ticket
                        </button>
                      </div>

                      {/* Material Table Listing */}
                      <div className="overflow-x-auto border border-black">
                        <table className="w-full text-left font-mono text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100 border-b border-black text-gray-900">
                              <th className="p-2 border-r border-black font-black uppercase">Category</th>
                              <th className="p-2 border-r border-black font-black uppercase">Material Specification</th>
                              <th className="p-2 border-r border-black font-black uppercase">Qty</th>
                              <th className="p-2 border-r border-black font-black uppercase">Est. Unit Code</th>
                              <th className="p-2 font-black uppercase text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black">
                            {materialListResult.materials.map((item, idx) => (
                              <tr key={`material-line-${idx}`} className="hover:bg-gray-50">
                                <td className="p-2 border-r border-black text-[10px] font-bold uppercase text-gray-500">
                                  {item.category}
                                </td>
                                <td className="p-2 border-r border-black">
                                  <div className="font-bold text-black">{item.name}</div>
                                  <div className="text-[10px] text-gray-500">{item.specification}</div>
                                </td>
                                <td className="p-2 border-r border-black font-bold">
                                  {item.quantity} {item.unit}
                                </td>
                                <td className="p-2 border-r border-black text-gray-600">
                                  ${item.unitPrice.toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-black">
                                  ${(item.quantity * item.unitPrice).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Cost Ledger Breakdown */}
                      <div className="border border-black p-4 bg-gray-50 space-y-3">
                        <h5 className="font-mono text-xs font-black uppercase tracking-tight text-gray-800">
                          RETAIL PROJECT COST SUMMARY
                        </h5>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
                          <div>
                            <span className="text-gray-500 text-[10px] block uppercase font-bold">Post & Beam Lumber</span>
                            <strong className="text-sm">${(materialListResult.summary.postsCost + materialListResult.summary.beamsCost).toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px] block uppercase font-bold">2x6 Rafter Spans</span>
                            <strong className="text-sm">${materialListResult.summary.crossbarsCost.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px] block uppercase font-bold">PV Modules & Racks</span>
                            <strong className="text-sm">${materialListResult.summary.panelsCost.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span className="text-gray-500 text-[10px] block uppercase font-bold">Hardware Bolts & Bases</span>
                            <strong className="text-sm">${materialListResult.summary.hardwareCost.toFixed(2)}</strong>
                          </div>
                        </div>

                        <hr className="border-black border-dashed" />

                        <div className="flex justify-between items-center font-mono pt-1">
                          <span className="text-sm font-black uppercase">Total Outlay projection:</span>
                          <span className="text-xl font-black underline">${materialListResult.summary.totalEstimated.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Help Alert */}
                      <p className="font-mono text-[10px] text-gray-500 leading-tight">
                        * Lumber prices estimated on Pressure-Treated Southern Yellow Pine average US retail hardware store values. Always obtain local structural calculations regarding heavy snow or seismic bracket reinforcement.
                      </p>
                    </div>
                  )}

                  {activeTab === 'assembly' && (
                    <div id="assembly-notebook" className="border-2 border-black p-5 bg-white space-y-6">
                      <div className="border-b-2 border-black pb-3">
                        <h4 className="font-serif text-lg font-black tracking-tight py-0.5">
                          Step-by-Step Framing & Array Assembly Guide
                        </h4>
                        <p className="font-mono text-[11px] text-gray-600">
                          Handy field checklist and active design notes to assist builders during framing.
                        </p>
                      </div>

                      {/* Milestones checklists */}
                      <div className="space-y-3">
                        <h5 className="font-mono text-xs font-black uppercase text-gray-800">
                          CONSTRUCTION CHECKLIST
                        </h5>
                        <div className="space-y-2">
                          {milestones.map((milestone) => (
                            <div 
                              key={milestone.id}
                              onClick={() => toggleMilestone(milestone.id)}
                              className="flex items-start gap-3 p-2.5 border border-black hover:bg-gray-50 cursor-pointer transition select-none"
                            >
                              <div className={`w-5 h-5 border-2 border-black flex items-center justify-center shrink-0 mt-0.5 ${
                                milestone.done ? 'bg-black text-white' : 'bg-white'
                              }`}>
                                {milestone.done && <Check className="w-3.5 h-3.5" />}
                              </div>
                              <span className={`font-mono text-xs ${
                                milestone.done ? 'line-through text-gray-400' : 'text-gray-900 font-bold'
                              }`}>
                                {milestone.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <hr className="border-black border-dashed" />

                      {/* User Notes Notebook Section */}
                      <div className="space-y-4">
                        <h5 className="font-mono text-xs font-black uppercase text-gray-800">
                          ACTIVE FIELD NOTES & COORDINATES (Notebook)
                        </h5>

                        {/* Existing user notes list */}
                        {activeNotes.length === 0 ? (
                          <p className="italic font-mono text-xs text-gray-400">No notes written inside notebook.</p>
                        ) : (
                          <div className="space-y-2 font-mono text-xs">
                            {activeNotes.map((note, index) => (
                              <div key={`field-note-${index}`} className="flex items-start justify-between p-2.5 bg-yellow-50/50 border border-yellow-200">
                                <span className="text-gray-800 flex-1 pr-4">{note}</span>
                                <button 
                                  onClick={() => handleClearNote(index)}
                                  className="text-gray-400 hover:text-black font-bold text-xs"
                                  title="Erase Note line"
                                >
                                  [Erase]
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add note tool form */}
                        <form onSubmit={handleAddNote} className="flex gap-2 border border-black p-1 bg-gray-50">
                          <input
                            type="text"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Write dimensions, drilling remarks, or series solar configuration..."
                            className="flex-1 bg-white border border-gray-300 px-2.5 py-1.5 font-mono text-xs"
                          />
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-black text-white hover:bg-gray-800 font-mono text-xs font-black uppercase shrink-0"
                          >
                            Add Note
                          </button>
                        </form>
                      </div>

                    </div>
                  )}

                </div>

              </div>

            </div>

            {/* Quick-tips bottom bar instruction sheet */}
            <div id="boox-help-panel" className="mt-8 pt-5 border-t-2 border-black flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-black text-white p-1">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-mono text-xs font-black uppercase tracking-wider block">
                    Structural Safety advisory
                  </span>
                  <span className="font-mono text-[10px] text-gray-500 leading-tight block">
                    Check maximum dynamic wind load lift capacity when installing flush rooftop arrays. Support with dual Ledger boards.
                  </span>
                </div>
              </div>

              {/* Dynamic stamp indicating state */}
              <div className="font-mono text-[10px] text-gray-700 bg-stone-100 border border-black p-2 leading-none">
                LAYOUT CODE: {pergola.width}x{pergola.length}-{pergola.postLumber}-{pergola.legsCount}LEGS-{solar.wattage}W-{forcedOrientation.toUpperCase()}
              </div>
            </div>

          </div>

        </div>

      <p className="mt-4 text-center font-mono text-xs text-gray-500">
        Google AI Studio Build • Custom clean layout. Press "THEME: E-INK ON/STARK COLOR" to convert visual styles.
      </p>

    </div>
  );
}
