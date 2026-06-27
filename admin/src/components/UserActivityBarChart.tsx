"use client"

import React, { useMemo, useState } from "react"

interface ActivityPoint {
  label: string
  signups: number
  trades: number
  tickets: number
}

interface UserActivityBarChartProps {
  activityTimeline: ActivityPoint[]
}

export default function UserActivityBarChart({ activityTimeline }: UserActivityBarChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const safeTimeline = useMemo(() => {
    return Array.isArray(activityTimeline) ? activityTimeline : []
  }, [activityTimeline])

  // 1. Calculate max height across all activities for scaling
  const maxVal = useMemo(() => {
    let max = 5 // fallback minimum
    for (const pt of safeTimeline) {
      const highest = Math.max(pt.signups, pt.trades, pt.tickets)
      if (highest > max) {
        max = highest
      }
    }
    return Math.ceil(max * 1.15) // 15% padding at top
  }, [safeTimeline])

  // Canvas Layout
  const width = 800
  const height = 250
  const padding = { top: 25, right: 30, bottom: 40, left: 50 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  // Scales
  const yScale = (v: number) => {
    if (maxVal <= 0) return height - padding.bottom
    return height - padding.bottom - (v / maxVal) * plotHeight
  }

  // Grid levels
  const gridLines = useMemo(() => {
    const lines = []
    const count = 4
    for (let i = 0; i < count; i++) {
      lines.push((maxVal * i) / (count - 1))
    }
    return lines
  }, [maxVal])

  // Bar sizes
  const groupWidth = safeTimeline.length > 0 ? plotWidth / safeTimeline.length : plotWidth
  const barWidth = Math.max(4, Math.min(16, (groupWidth * 0.6) / 3))
  const groupSpacing = groupWidth - barWidth * 3

  return (
    <div className="flex flex-col gap-4 bg-white border border-stone-250/70 p-5 rounded-2xl shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            User Platform Activity
          </h3>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
              <span className="w-2.5 h-2.5 rounded-xs bg-indigo-500" /> Signups
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" /> Trades
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-stone-500">
              <span className="w-2.5 h-2.5 rounded-xs bg-violet-500" /> PvP Tickets
            </span>
          </div>
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[500px] h-auto select-none">
          {/* Y Axis Grid Lines */}
          <g>
            {gridLines.map((val, idx) => (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={yScale(val)}
                  x2={width - padding.right}
                  y2={yScale(val)}
                  stroke="#f1f0ee"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={yScale(val) + 3}
                  textAnchor="end"
                  className="fill-stone-400 font-mono text-[10px] font-semibold"
                >
                  {Math.round(val)}
                </text>
              </g>
            ))}
          </g>

          {/* Grouped Bars */}
          <g>
            {safeTimeline.map((pt, idx) => {
              const groupX = padding.left + idx * groupWidth
              const centerX = groupX + groupSpacing / 2

              // Calculate bar coordinates
              const signupX = centerX
              const signupHeight = (pt.signups / maxVal) * plotHeight
              const signupY = height - padding.bottom - signupHeight

              const tradeX = centerX + barWidth
              const tradeHeight = (pt.trades / maxVal) * plotHeight
              const tradeY = height - padding.bottom - tradeHeight

              const ticketX = centerX + barWidth * 2
              const ticketHeight = (pt.tickets / maxVal) * plotHeight
              const ticketY = height - padding.bottom - ticketHeight

              const isHovered = hoveredIdx === idx

              return (
                <g
                  key={idx}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer"
                >
                  {/* Subtle column hover background highlights */}
                  {isHovered && (
                    <rect
                      x={groupX + 2}
                      y={padding.top}
                      width={groupWidth - 4}
                      height={plotHeight}
                      fill="#fafaf9"
                      opacity="0.8"
                      rx="4"
                    />
                  )}

                  {/* Signups Bar */}
                  <rect
                    x={signupX}
                    y={signupY}
                    width={barWidth - 1}
                    height={signupHeight}
                    fill={isHovered ? "#4f46e5" : "#6366f1"}
                    rx="1.5"
                    className="transition-all duration-200"
                  />

                  {/* Trades Bar */}
                  <rect
                    x={tradeX}
                    y={tradeY}
                    width={barWidth - 1}
                    height={tradeHeight}
                    fill={isHovered ? "#059669" : "#10b981"}
                    rx="1.5"
                    className="transition-all duration-200"
                  />

                  {/* PvP Tickets Bar */}
                  <rect
                    x={ticketX}
                    y={ticketY}
                    width={barWidth - 1}
                    height={ticketHeight}
                    fill={isHovered ? "#7c3aed" : "#8b5cf6"}
                    rx="1.5"
                    className="transition-all duration-200"
                  />

                  {/* X Axis Labels */}
                  <text
                    x={centerX + barWidth * 1.5}
                    y={height - padding.bottom + 18}
                    textAnchor="middle"
                    className={`font-medium text-[10px] ${
                      isHovered ? "fill-stone-900 font-bold" : "fill-stone-500"
                    }`}
                  >
                    {pt.label}
                  </text>
                </g>
              )
            })}
          </g>

          {/* Interactive Tooltip Overlay */}
          {hoveredIdx !== null && safeTimeline[hoveredIdx] && (
            <g>
              {(() => {
                const pt = safeTimeline[hoveredIdx]
                const groupX = padding.left + hoveredIdx * groupWidth
                const tooltipW = 140
                const tooltipH = 90
                let tooltipX = groupX + groupWidth / 2 - tooltipW / 2
                let tooltipY = yScale(Math.max(pt.signups, pt.trades, pt.tickets)) - tooltipH - 8

                // Prevent overflow boundaries
                if (tooltipX < padding.left) tooltipX = padding.left
                if (tooltipX + tooltipW > width - padding.right) {
                  tooltipX = width - padding.right - tooltipW
                }
                if (tooltipY < padding.top) {
                  tooltipY = yScale(Math.max(pt.signups, pt.trades, pt.tickets)) + 8
                }

                return (
                  <foreignObject
                    x={tooltipX}
                    y={tooltipY}
                    width={tooltipW}
                    height={tooltipH}
                    className="pointer-events-none"
                  >
                    <div className="bg-stone-900 border border-stone-800 text-white rounded-lg p-2.5 flex flex-col gap-1 shadow-lg text-left">
                      <p className="text-[10px] font-bold text-stone-300">
                        {pt.label} Summary
                      </p>
                      <div className="h-px bg-stone-850 my-0.5" />
                      <div className="flex justify-between text-[9px]">
                        <span className="text-stone-400">Signups:</span>
                        <span className="font-bold text-indigo-400">{pt.signups}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-stone-400">Trades:</span>
                        <span className="font-bold text-emerald-400">{pt.trades}</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-stone-400">Tickets:</span>
                        <span className="font-bold text-violet-400">{pt.tickets}</span>
                      </div>
                    </div>
                  </foreignObject>
                )
              })()}
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
