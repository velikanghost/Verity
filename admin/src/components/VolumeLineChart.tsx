"use client"

import React, { useMemo, useState, useRef } from "react"

interface Trade {
  marketId: string
  marketQuestion: string
  amountUsdc: number
  createdAt: string
}

interface VolumeLineChartProps {
  trades: Trade[]
  timeframe: string
}

const PALETTE = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#14b8a6", // Teal
]

export default function VolumeLineChart({ trades, timeframe }: VolumeLineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<{
    marketName: string
    timestamp: number
    amount: number
    cumulative: number
    x: number
    y: number
    color: string
  } | null>(null)

  const safeTrades = useMemo(() => {
    return Array.isArray(trades) ? trades : []
  }, [trades])

  // 1. Calculate timeframe boundaries
  const timeRange = useMemo(() => {
    const end = Date.now()
    let start = end - 7 * 24 * 60 * 60 * 1000 // 7d default
    if (timeframe === "1h") {
      start = end - 60 * 60 * 1000
    } else if (timeframe === "1d") {
      start = end - 24 * 60 * 60 * 1000
    } else if (timeframe === "30d") {
      start = end - 30 * 24 * 60 * 60 * 1000
    }
    return { start, end }
  }, [timeframe, safeTrades])

  // 2. Group trades by market and compute cumulative volumes
  const { marketSeries, hiddenMarketsCount } = useMemo(() => {
    const groups: Record<string, { marketId: string; marketQuestion: string; trades: Trade[] }> = {}
    for (const trade of safeTrades) {
      if (!groups[trade.marketId]) {
        groups[trade.marketId] = {
          marketId: trade.marketId,
          marketQuestion: trade.marketQuestion,
          trades: [],
        }
      }
      groups[trade.marketId].trades.push(trade)
    }

    const numIntervals = 20
    const step = (timeRange.end - timeRange.start) / (numIntervals - 1)

    const seriesList = Object.values(groups).map((group) => {
      // Sort trades chronologically
      const sorted = [...group.trades].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      // Compute cumulative volume at each of the 20 interval boundaries
      const points: { timestamp: number; amount: number; cumulative: number }[] = []
      let lastCumulative = 0

      for (let i = 0; i < numIntervals; i++) {
        const t = timeRange.start + i * step
        // Sum up all trades that happened before or at t
        const tradesBeforeT = sorted.filter((tr) => new Date(tr.createdAt).getTime() <= t)
        const cumulativeAtT = tradesBeforeT.reduce((sum, tr) => sum + tr.amountUsdc, 0)
        
        points.push({
          timestamp: t,
          amount: i === 0 ? cumulativeAtT : cumulativeAtT - lastCumulative,
          cumulative: cumulativeAtT,
        })
        lastCumulative = cumulativeAtT
      }

      return {
        marketId: group.marketId,
        marketQuestion: group.marketQuestion,
        points,
        color: "#ffffff", // fallback, will be assigned below
        totalVolume: lastCumulative,
      }
    })

    const sortedAll = seriesList.sort((a, b) => b.totalVolume - a.totalVolume)

    if (sortedAll.length <= 7) {
      // Assign colors from PALETTE
      sortedAll.forEach((s, idx) => {
        s.color = PALETTE[idx % PALETTE.length]
      })
      return { marketSeries: sortedAll, hiddenMarketsCount: 0 }
    }

    const topSeries = sortedAll.slice(0, 6)
    const otherSeries = sortedAll.slice(6)

    // Assign colors from PALETTE to top series so they are consistent
    topSeries.forEach((s, idx) => {
      s.color = PALETTE[idx % PALETTE.length]
    })

    // Compute points for "Others (Combined)" by summing up otherSeries points at each interval
    const otherPoints = Array.from({ length: numIntervals }, (_, i) => {
      const t = timeRange.start + i * step
      let cumulativeAtT = 0
      let amountAtT = 0
      for (const s of otherSeries) {
        const pt = s.points[i]
        if (pt) {
          cumulativeAtT += pt.cumulative
          amountAtT += pt.amount
        }
      }
      return {
        timestamp: t,
        amount: amountAtT,
        cumulative: cumulativeAtT,
      }
    })

    topSeries.push({
      marketId: "others",
      marketQuestion: "Others (Combined)",
      points: otherPoints,
      color: "#94a3b8", // Slate-400
      totalVolume: otherPoints[numIntervals - 1].cumulative,
    })

    return { marketSeries: topSeries, hiddenMarketsCount: otherSeries.length }
  }, [safeTrades, timeRange])

  // 3. Compute chart scales
  const maxVolume = useMemo(() => {
    let maxVal = 100 // fallback
    for (const s of marketSeries) {
      for (const p of s.points) {
        if (p.cumulative > maxVal) {
          maxVal = p.cumulative
        }
      }
    }
    return maxVal * 1.15 // 15% padding at top
  }, [marketSeries])

  // Canvas details
  const width = 1000
  const height = 350
  const padding = { top: 20, right: 200, bottom: 40, left: 60 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  const xScale = (t: number) => {
    const range = timeRange.end - timeRange.start
    if (range <= 0) return padding.left
    return padding.left + ((t - timeRange.start) / range) * plotWidth
  }

  const yScale = (v: number) => {
    if (maxVolume <= 0) return height - padding.bottom
    return height - padding.bottom - (v / maxVolume) * plotHeight
  }

  // 4. Generate X-axis labels based on timeframe
  const xLabels = useMemo(() => {
    const labels: { text: string; timestamp: number }[] = []
    const count = 5
    const step = (timeRange.end - timeRange.start) / (count - 1)

    for (let i = 0; i < count; i++) {
      const ts = timeRange.start + i * step
      const date = new Date(ts)
      let text = ""

      if (timeframe === "1h") {
        text = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
      } else if (timeframe === "1d") {
        text = `${String(date.getHours()).padStart(2, "0")}:00`
      } else if (timeframe === "30d") {
        text = `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`
      } else {
        text = `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`
      }

      labels.push({ text, timestamp: ts })
    }
    return labels
  }, [timeRange, timeframe])

  // 5. Generate Y-axis grid markers
  const yLabels = useMemo(() => {
    const markers = []
    const count = 5
    for (let i = 0; i < count; i++) {
      markers.push((maxVolume * i) / (count - 1))
    }
    return markers
  }, [maxVolume])

  // 6. Handle Mouse Hover Interaction
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || marketSeries.length === 0) return

    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    // Scale mouse position to original SVG coordinates
    const scaleX = width / rect.width
    const svgMouseX = mouseX * scaleX

    if (svgMouseX < padding.left || svgMouseX > width - padding.right) {
      setHoveredPoint(null)
      return
    }

    // Convert X position back to timestamp
    const tPercent = (svgMouseX - padding.left) / plotWidth
    const targetTimestamp = timeRange.start + tPercent * (timeRange.end - timeRange.start)

    // Find the absolute closest point in any market series
    let closestPoint: any = null
    let minDiff = Infinity

    for (const s of marketSeries) {
      // Find point in this series closest to targetTimestamp
      for (const p of s.points) {
        if (p.timestamp < timeRange.start || p.timestamp > timeRange.end) continue
        const diff = Math.abs(p.timestamp - targetTimestamp)
        if (diff < minDiff && p.cumulative > 0) {
          minDiff = diff
          closestPoint = {
            marketName: s.marketQuestion,
            timestamp: p.timestamp,
            amount: p.amount,
            cumulative: p.cumulative,
            x: xScale(p.timestamp),
            y: yScale(p.cumulative),
            color: s.color,
          }
        }
      }
    }

    // Limit tooltip triggering to reasonable proximity
    if (closestPoint && minDiff < (timeRange.end - timeRange.start) / 10) {
      setHoveredPoint(closestPoint)
    } else {
      setHoveredPoint(null)
    }
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  // Helper for line smoothing to draw curvy paths
  const getBezierPath = (points: [number, number][]) => {
    if (points.length === 0) return ""
    if (points.length === 1) return `M ${points[0][0]},${points[0][1]}`

    // Simple line angle and distance
    const getLine = (p1: [number, number], p2: [number, number]) => {
      const dx = p2[0] - p1[0]
      const dy = p2[1] - p1[1]
      return {
        length: Math.sqrt(dx * dx + dy * dy),
        angle: Math.atan2(dy, dx),
      }
    }

    // Calculate control point coordinates
    const getControlPoint = (
      current: [number, number],
      prev: [number, number] | undefined,
      next: [number, number] | undefined,
      isReverse?: boolean
    ): [number, number] => {
      const p = prev || current
      const n = next || current
      const smoothing = 0.2
      const o = getLine(p, n)
      const angle = o.angle + (isReverse ? Math.PI : 0)
      const length = o.length * smoothing
      const x = current[0] + Math.cos(angle) * length
      const y = current[1] + Math.sin(angle) * length
      return [x, y]
    }

    let d = `M ${points[0][0]},${points[0][1]}`
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i]
      const nextPoint = points[i + 1]
      const prev = points[i - 1]
      const nextNext = points[i + 2]

      const cp1 = getControlPoint(curr, prev, nextPoint, false)
      const cp2 = getControlPoint(nextPoint, curr, nextNext, true)

      d += ` C ${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${nextPoint[0]},${nextPoint[1]}`
    }
    return d
  }

  // 7. Compile line SVG path tags
  const renderPaths = marketSeries.map((series) => {
    if (series.points.length === 0) return null
    
    // Map points to [x, y] coordinates
    const pts = series.points.map((p) => [xScale(p.timestamp), yScale(p.cumulative)] as [number, number])
    const d = getBezierPath(pts)

    return (
      <g key={series.marketId}>
        {/* Shadow glow background path */}
        <path
          d={d}
          fill="none"
          stroke={series.color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
          className="transition-all duration-300"
        />
        {/* Draw subtle endpoints */}
        {series.points.length > 2 && (
          <circle
            cx={xScale(series.points[series.points.length - 2].timestamp)}
            cy={yScale(series.points[series.points.length - 2].cumulative)}
            r="4.5"
            fill={series.color}
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        )}
      </g>
    )
  })

  return (
    <div className="flex flex-col gap-4 bg-white border border-stone-250/70 p-5 rounded-2xl shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
          All Markets Cumulative Volume (USDC)
        </h3>
        {safeTrades.length === 0 && (
          <span className="text-[10px] text-stone-400 font-semibold uppercase">No trades in this window</span>
        )}
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[700px] h-auto select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grids and Axes */}
          <g>
            {yLabels.map((val, idx) => (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={yScale(val)}
                  x2={width - padding.right}
                  y2={yScale(val)}
                  stroke="#f1f0ee"
                  strokeWidth="1"
                  strokeDasharray={idx === 0 ? "0" : "4 4"}
                />
                <text
                  x={padding.left - 8}
                  y={yScale(val) + 3}
                  textAnchor="end"
                  className="fill-stone-400 font-mono text-[10px] font-semibold"
                >
                  {val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
              </g>
            ))}
          </g>

          {/* X axis labels */}
          <g>
            {xLabels.map((lbl, idx) => (
              <g key={idx}>
                <line
                  x1={xScale(lbl.timestamp)}
                  y1={height - padding.bottom}
                  x2={xScale(lbl.timestamp)}
                  y2={height - padding.bottom + 4}
                  stroke="#e4e2de"
                  strokeWidth="1"
                />
                <text
                  x={xScale(lbl.timestamp)}
                  y={height - padding.bottom + 16}
                  textAnchor="middle"
                  className="fill-stone-500 font-medium text-[10px]"
                >
                  {lbl.text}
                </text>
              </g>
            ))}
          </g>

          {/* Main line series paths */}
          <g>{renderPaths}</g>

          {/* Interactive Hover Guides & Tooltips */}
          {hoveredPoint && (
            <g>
              <line
                x1={hoveredPoint.x}
                y1={padding.top}
                x2={hoveredPoint.x}
                y2={height - padding.bottom}
                stroke="#d1cfca"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="7"
                fill={hoveredPoint.color}
                stroke="#ffffff"
                strokeWidth="2.5"
                className="shadow-xs"
              />

              {/* Tooltip Overlay Panel */}
              <foreignObject
                x={hoveredPoint.x > width - padding.right - 180 ? hoveredPoint.x - 195 : hoveredPoint.x + 15}
                y={hoveredPoint.y > height - padding.bottom - 110 ? hoveredPoint.y - 110 : hoveredPoint.y - 10}
                width="180"
                height="105"
                className="pointer-events-none"
              >
                <div
                  className="bg-stone-900 border border-stone-800 text-white rounded-xl p-3 flex flex-col gap-1.5 shadow-xl text-left"
                  style={{ backdropFilter: "blur(4px)" }}
                >
                  <p className="text-[10px] font-bold text-stone-300 truncate">
                    {hoveredPoint.marketName}
                  </p>
                  <div className="h-px bg-stone-800 my-0.5" />
                  <div className="flex justify-between text-[10px]">
                    <span className="text-stone-400">Trade Amount:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      +{hoveredPoint.amount.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-stone-400">Cumulative:</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {hoveredPoint.cumulative.toFixed(2)} USDC
                    </span>
                  </div>
                  <div className="flex justify-between text-[9px] text-stone-500 mt-0.5">
                    <span>Date:</span>
                    <span>
                      {new Date(hoveredPoint.timestamp).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </foreignObject>
            </g>
          )}

          {/* Right Column Legend Inside Canvas */}
          <g transform={`translate(${width - padding.right + 20}, ${padding.top})`}>
            {marketSeries.map((s, idx) => (
              <g key={s.marketId} transform={`translate(0, ${idx * 38})`}>
                <rect x="0" y="2" width="10" height="10" rx="3" fill={s.color} />
                <text
                  x="16"
                  y="11"
                  className="fill-stone-800 font-bold text-[11px] truncate w-[160px]"
                >
                  {s.marketQuestion.length > 20 ? `${s.marketQuestion.slice(0, 20)}...` : s.marketQuestion}
                </text>
                <text
                  x="16"
                  y="24"
                  className="fill-stone-450 font-mono text-[9px]"
                >
                  Vol: {s.totalVolume.toFixed(1)} USDC
                </text>
              </g>
            ))}
            {hiddenMarketsCount > 0 && (
              <text x="0" y={marketSeries.length * 38 + 10} className="fill-stone-400 text-[10px] italic">
                + {hiddenMarketsCount} more markets combined
              </text>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}
