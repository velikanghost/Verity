"use client"

import { useEffect, useState } from "react"
import { motion, useMotionValue } from "framer-motion"

interface DraggableFABProps {
  id: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function DraggableFAB({ id, children, className, onClick }: DraggableFABProps) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const [isMounted, setIsMounted] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(`fab-pos-${id}`)
    if (saved) {
      try {
        const { x: savedX, y: savedY } = JSON.parse(saved)
        x.set(savedX)
        y.set(savedY)
      } catch (e) {
        // ignore parse error
      }
    }
    setIsMounted(true)
  }, [id, x, y])

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    // Delay setting isDragging to false so we don't trigger a click event right after drag
    setTimeout(() => {
      setIsDragging(false)
    }, 100)
    localStorage.setItem(
      `fab-pos-${id}`,
      JSON.stringify({ x: x.get(), y: y.get() })
    )
  }

  if (!isMounted) return null

  return (
    <motion.div
      drag
      dragMomentum={false}
      style={{ x, y }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        if (isDragging) {
          e.preventDefault()
          e.stopPropagation()
          return
        }
        onClick?.()
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
