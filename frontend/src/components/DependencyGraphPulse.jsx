import { useEffect, useState, useRef, useMemo } from 'react';

// Node positions laid out as a real dependency tree: Root App -> Direct Dependencies -> Transitive Dependencies
const baseNodes = [
  { id: 'app', x: 60, y: 190, label: 'your-app', version: 'v2.4.0', tier: 0, type: 'root' },
  { id: 'a', x: 200, y: 80, label: 'express', version: '4.19.2', tier: 1, type: 'direct' },
  { id: 'b', x: 200, y: 190, label: 'react', version: '18.3.1', tier: 1, type: 'direct' },
  { id: 'c', x: 200, y: 300, label: 'axios', version: '1.7.2', tier: 1, type: 'direct' },
  { id: 'a1', x: 370, y: 45, label: 'body-parser', version: '1.20.2', tier: 2, type: 'transitive' },
  { id: 'a2', x: 370, y: 115, label: 'cookie', version: '0.6.0', tier: 2, type: 'transitive' },
  { id: 'b1', x: 370, y: 190, label: 'scheduler', version: '0.23.2', tier: 2, type: 'transitive' },
  { id: 'c1', x: 370, y: 260, label: 'follow-redirects', version: '1.15.6', tier: 2, type: 'transitive' },
  { id: 'evil', x: 370, y: 335, label: 'lodahs', version: '0.7.21', tier: 2, type: 'malicious', malicious: true, original: 'lodash' },
];

const edges = [
  ['app', 'a'], ['app', 'b'], ['app', 'c'],
  ['a', 'a1'], ['a', 'a2'],
  ['b', 'b1'],
  ['c', 'c1'], ['c', 'evil'],
];

export default function DependencyGraphPulse() {
  const [phase, setPhase] = useState('traveling'); // 'traveling' | 'intercepted' | 'blocked'
  const [activeNode, setActiveNode] = useState(null);
  const [scanStats, setScanStats] = useState({ scanned: 8, depth: 2, latency: 14 });
  const [cycleCount, setCycleCount] = useState(0);

  const containerRef = useRef(null);
  const startTimeRef = useRef(performance.now());
  const [pulsePos, setPulsePos] = useState({ x: 60, y: 190 });
  const [dynamicNodes, setDynamicNodes] = useState(baseNodes);

  // Cycle animation states
  useEffect(() => {
    startTimeRef.current = performance.now();
    setPhase('traveling');

    const t1 = setTimeout(() => {
      setPhase('intercepted');
      setScanStats(s => ({ ...s, latency: 9 }));
    }, 2200);

    const t2 = setTimeout(() => {
      setPhase('blocked');
    }, 3600);

    const t3 = setTimeout(() => {
      setCycleCount(c => c + 1);
    }, 4800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [cycleCount]);

  // Ultra-smooth 60fps organic float + scanning pulse traversal
  useEffect(() => {
    let rafId;

    const animate = (time) => {
      // 1. Organic breathing floating positions
      const updatedNodes = baseNodes.map((n, idx) => {
        const floatX = Math.sin(time * 0.0012 + idx * 1.1) * 3 + Math.cos(time * 0.0007 + idx * 0.5) * 2;
        const floatY = Math.cos(time * 0.0014 + idx * 0.9) * 3.5 + Math.sin(time * 0.0009 + idx * 1.3) * 2;
        return {
          ...n,
          curX: n.x + floatX,
          curY: n.y + floatY,
        };
      });
      setDynamicNodes(updatedNodes);

      // 2. Pulse beam progression
      const elapsed = time - startTimeRef.current;
      const duration = 2200; // time to reach evil node

      const appNode = updatedNodes[0];
      const axiosNode = updatedNodes[3];
      const evilNode = updatedNodes[8];

      let currentX = appNode.curX;
      let currentY = appNode.curY;

      if (elapsed > 0 && elapsed < duration) {
        const progress = elapsed / duration;
        if (progress < 0.48) {
          // Segment 1: your-app -> axios
          const segProgress = progress / 0.48;
          currentX = appNode.curX + (axiosNode.curX - appNode.curX) * segProgress;
          currentY = appNode.curY + (axiosNode.curY - appNode.curY) * segProgress;
        } else {
          // Segment 2: axios -> lodahs
          const segProgress = (progress - 0.48) / 0.52;
          currentX = axiosNode.curX + (evilNode.curX - axiosNode.curX) * segProgress;
          currentY = axiosNode.curY + (evilNode.curY - axiosNode.curY) * segProgress;
        }
      } else if (elapsed >= duration) {
        currentX = evilNode.curX;
        currentY = evilNode.curY;
      }

      setPulsePos({ x: currentX, y: currentY });
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full max-w-[540px] rounded-2xl bg-[#130F23]/95 border border-[#2B2342] shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl p-5 overflow-hidden select-none transition-all duration-300"
    >
      {/* Radiant ambient glow spots inside card */}
      <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-[#FF2E93]/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-[#8B5CF6]/15 blur-3xl pointer-events-none" />

      {/* Header HUD Bar */}
      <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-[#241D38]">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10B981]" />
          <span className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase">
            Transitive Graph Inspection
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <span className="hidden sm:inline">Depth: <strong className="text-white">2 Levels</strong></span>
          <span className="hidden sm:inline">Speed: <strong className="text-emerald-400">{scanStats.latency}ms</strong></span>
          <span className="px-2 py-0.5 rounded-full bg-[#201938] border border-[#352B55] text-[#D946EF] font-semibold text-[10px]">
            Real-time AST
          </span>
        </div>
      </div>

      {/* SVG Canvas for interactive nodes & pulse lines */}
      <div className="relative w-full aspect-[480/380]">
        <svg 
          viewBox="0 0 460 380" 
          className="w-full h-full overflow-visible"
          role="img" 
          aria-label="Interactive graph analyzing package dependencies and blocking malicious typosquats"
        >
          <defs>
            {/* Glow filters */}
            <filter id="laserGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="threatGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Gradient definitions */}
            <linearGradient id="threatPathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
              <stop offset="60%" stopColor="#D946EF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FF2E93" stopOpacity="1" />
            </linearGradient>

            <linearGradient id="safePathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B325A" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4C4172" stopOpacity="0.7" />
            </linearGradient>

            <radialGradient id="packetGlow" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="40%" stopColor="#D946EF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FF2E93" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Render curved bezier connection lines between packages */}
          {edges.map(([fromId, toId], i) => {
            const from = dynamicNodes.find(n => n.id === fromId);
            const to = dynamicNodes.find(n => n.id === toId);
            if (!from || !to) return null;

            const isThreatBranch = toId === 'evil' || (fromId === 'c' && toId === 'evil');
            
            // Curved cubic bezier path for sleek high-tech aesthetics
            const dx = to.curX - from.curX;
            const pathD = `M ${from.curX} ${from.curY} C ${from.curX + dx * 0.45} ${from.curY}, ${from.curX + dx * 0.55} ${to.curY}, ${to.curX} ${to.curY}`;

            return (
              <g key={i}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isThreatBranch ? 'url(#threatPathGrad)' : 'url(#safePathGrad)'}
                  strokeWidth={isThreatBranch ? (phase === 'intercepted' || phase === 'blocked' ? 2.5 : 2) : 1.25}
                  strokeDasharray={isThreatBranch ? 'none' : '4 3'}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {/* Traveling Scanner Pulse with Trail */}
          <circle 
            cx={pulsePos.x} 
            cy={pulsePos.y} 
            r="16" 
            fill="url(#packetGlow)" 
            opacity={phase === 'traveling' ? 0.9 : 0.4}
            className="pointer-events-none"
          />
          <circle 
            cx={pulsePos.x} 
            cy={pulsePos.y} 
            r="5" 
            fill="#FFFFFF" 
            filter="url(#laserGlow)"
            className="pointer-events-none"
          />

          {/* Threat Shockwave Ping Rings on Interception */}
          {(phase === 'intercepted' || phase === 'blocked') && (
            <g>
              <circle
                cx={dynamicNodes[8].curX}
                cy={dynamicNodes[8].curY}
                r="30"
                fill="none"
                stroke="#FF2E93"
                strokeWidth="2"
                opacity="0.8"
                className="animate-ping"
              />
              <circle
                cx={dynamicNodes[8].curX}
                cy={dynamicNodes[8].curY}
                r="44"
                fill="none"
                stroke="#FF2E93"
                strokeWidth="1.5"
                opacity="0.4"
                className="animate-pulse"
              />
            </g>
          )}

          {/* Render Interactive Nodes */}
          {dynamicNodes.map((n) => {
            const isEvil = n.id === 'evil';
            const isRoot = n.id === 'app';
            const isHovered = activeNode?.id === n.id;

            return (
              <g 
                key={n.id}
                onMouseEnter={() => setActiveNode(n)}
                onMouseLeave={() => setActiveNode(null)}
                className="cursor-pointer group"
              >
                {/* Node halo */}
                {isEvil && (
                  <circle
                    cx={n.curX}
                    cy={n.curY}
                    r={isHovered ? 26 : 22}
                    fill={phase === 'intercepted' || phase === 'blocked' ? '#FF2E93' : '#8B5CF6'}
                    opacity="0.25"
                    filter="url(#threatGlow)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Node circular border */}
                <circle
                  cx={n.curX}
                  cy={n.curY}
                  r={isRoot ? 11 : isEvil ? 10 : 8}
                  fill={
                    isEvil 
                      ? (phase === 'intercepted' || phase === 'blocked' ? '#FF2E93' : '#8B5CF6') 
                      : isRoot 
                      ? '#FFFFFF' 
                      : '#1C162E'
                  }
                  stroke={
                    isEvil 
                      ? '#FF2E93' 
                      : isRoot 
                      ? '#D946EF' 
                      : isHovered 
                      ? '#8B5CF6' 
                      : '#3F355E'
                  }
                  strokeWidth={isHovered ? 2.5 : 1.75}
                  filter={isEvil ? 'url(#laserGlow)' : undefined}
                  className="transition-all duration-200"
                />

                {/* Inner dot */}
                {!isEvil && !isRoot && (
                  <circle
                    cx={n.curX}
                    cy={n.curY}
                    r="3.5"
                    fill={isHovered ? '#D946EF' : '#8B5CF6'}
                  />
                )}

                {/* Label */}
                <text
                  x={n.curX}
                  y={n.curY + 22}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="10"
                  fontWeight={isEvil || isRoot ? '700' : '500'}
                  fill={isEvil ? '#FF4F9E' : isHovered ? '#FFFFFF' : '#B8ACCB'}
                  className="transition-colors duration-150"
                >
                  {n.label}
                </text>

                {/* Semver / Warning pill below node */}
                <text
                  x={n.curX}
                  y={n.curY + 33}
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontSize="8"
                  fontWeight="600"
                  fill={isEvil ? '#F43F5E' : '#72648C'}
                >
                  {isEvil ? '⚠️ TYPOSQUAT' : n.version}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Live Interactive Node Tooltip */}
        {activeNode && (
          <div 
            className="absolute z-20 pointer-events-none bg-[#1F1735]/95 border border-[#483A70] rounded-xl px-3 py-2 shadow-2xl backdrop-blur-md transition-all duration-150"
            style={{
              left: `${Math.min(360, Math.max(10, activeNode.x - 30))}px`,
              top: `${Math.max(10, activeNode.y - 70)}px`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeNode.malicious ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'}`} />
              <strong className="text-xs font-mono text-white font-bold">{activeNode.label}</strong>
              <span className="text-[10px] font-mono text-slate-400">{activeNode.version}</span>
            </div>
            <p className="text-[10px] text-slate-300 mt-1">
              {activeNode.malicious ? (
                <span className="text-rose-400 font-semibold">
                  Typo-squatting attack mimicking legitimate package <strong className="text-white">lodash</strong>.
                </span>
              ) : activeNode.type === 'root' ? (
                'Application source manifest (package.json)'
              ) : (
                `Verified component in supply chain (${activeNode.type})`
              )}
            </p>
          </div>
        )}
      </div>

      {/* Dynamic Status HUD Footer */}
      <div className="mt-2 pt-3 border-t border-[#231C37] flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2">
          {phase === 'traveling' && (
            <>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-slate-300 text-[11px]">
                Tracing deep dependency branches in memory…
              </span>
            </>
          )}

          {phase === 'intercepted' && (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-rose-300 font-bold text-[11px]">
                Threat Caught: <span className="underline decoration-rose-500">lodahs</span> (Levenshtein distance: 1)
              </span>
            </>
          )}

          {phase === 'blocked' && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#D946EF] shadow-[0_0_8px_#D946EF]" />
              <span className="text-emerald-400 font-bold text-[11px]">
                CI/CD Policy Gate: <strong className="text-white bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/50">BLOCKED (Exit 1)</strong>
              </span>
            </>
          )}
        </div>

        <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase">
          SLSA Level 3
        </div>
      </div>
    </div>
  );
}
