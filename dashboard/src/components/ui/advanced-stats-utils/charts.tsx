import React, { useState } from 'react';

interface DataPoint {
  day: string;
  logged: number;
  resolved: number;
}

const DEFAULT_DATA: DataPoint[] = [
  { day: 'Mon', logged: 12, resolved: 8 },
  { day: 'Tue', logged: 18, resolved: 14 },
  { day: 'Wed', logged: 15, resolved: 16 },
  { day: 'Thu', logged: 25, resolved: 20 },
  { day: 'Fri', logged: 22, resolved: 24 },
  { day: 'Sat', logged: 14, resolved: 17 },
  { day: 'Sun', logged: 8, resolved: 10 },
];

export const ClippedAreaChart: React.FC = () => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(4);
  const data = DEFAULT_DATA;

  // ViewBox dimensions
  const width = 680;
  const height = 240;
  const paddingX = 40;
  const paddingY = 30;

  const maxVal = Math.max(...data.map((d) => Math.max(d.logged, d.resolved))) + 5;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * chartWidth;
    const yLogged = height - paddingY - (d.logged / maxVal) * chartHeight;
    const yResolved = height - paddingY - (d.resolved / maxVal) * chartHeight;
    return { x, yLogged, yResolved, ...d };
  });

  // Smooth cubic Bezier curve path generator
  const getCurvedPath = (key: 'yLogged' | 'yResolved') => {
    return points.reduce((acc, curr, i, arr) => {
      if (i === 0) return `M ${curr.x} ${curr[key]}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev[key];
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr[key];
      return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr[key]}`;
    }, '');
  };

  const linePathLogged = getCurvedPath('yLogged');
  const areaPathLogged = `${linePathLogged} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  const linePathResolved = getCurvedPath('yResolved');

  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="w-full h-full flex flex-col justify-between select-none">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
            Hazard Velocity & Resolution
          </p>
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 mt-0.5">
            Weekly Inspection Activity
          </h3>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-black rounded-full" />
            <span className="text-zinc-600 font-medium">Reported Hazards</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-zinc-400 border-b border-dashed border-zinc-600" />
            <span className="text-zinc-500 font-medium">Resolved & Signed Off</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full aspect-[2.8/1] min-h-[220px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.00" />
            </linearGradient>
            <clipPath id="chartClip">
              <rect x={paddingX} y={paddingY} width={chartWidth} height={chartHeight} />
            </clipPath>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + ratio * chartHeight;
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Shaded Area */}
          <path d={areaPathLogged} fill="url(#areaGradient)" />

          {/* Lines */}
          <path
            d={linePathLogged}
            fill="none"
            stroke="#000000"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <path
            d={linePathResolved}
            fill="none"
            stroke="#71717a"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />

          {/* Interactive Hover Guides & Circles */}
          {points.map((p, idx) => (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoverIndex(idx)}
            >
              {/* Invisible wide hit area */}
              <rect
                x={p.x - 18}
                y={paddingY}
                width={36}
                height={chartHeight}
                fill="transparent"
              />

              {hoverIndex === idx && (
                <>
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={height - paddingY}
                    stroke="#a1a1aa"
                    strokeWidth="1"
                  />
                  <circle
                    cx={p.x}
                    cy={p.yLogged}
                    r={5}
                    fill="#000000"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <circle
                    cx={p.x}
                    cy={p.yResolved}
                    r={4}
                    fill="#71717a"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </>
              )}

              {/* X Axis label */}
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight={hoverIndex === idx ? '600' : '400'}
                fill={hoverIndex === idx ? '#000000' : '#71717a'}
                fontFamily="Inter, sans-serif"
              >
                {p.day}
              </text>
            </g>
          ))}
        </svg>

        {/* Hover Tooltip */}
        {activePoint && (
          <div
            className="absolute pointer-events-none transition-all duration-150 rounded-xl bg-black text-white p-2.5 shadow-xl text-xs z-20"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.yLogged / height) * 70}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <p className="text-[10px] uppercase font-mono text-zinc-400 font-bold mb-1">
              {activePoint.day} Summary
            </p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-300">Reported:</span>
              <span className="font-bold text-white">{activePoint.logged}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-zinc-400">Resolved:</span>
              <span className="font-bold text-zinc-300">{activePoint.resolved}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
