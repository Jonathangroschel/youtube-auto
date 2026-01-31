"use client"

import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

interface RenderCanvasProps {
  // Animation configuration
  trails?: number
  size?: number
  friction?: number
  dampening?: number
  tension?: number

  // Visual properties
  lineWidth?: number
  colorHue?: number
  colorSaturation?: number
  colorLightness?: number
  opacity?: number

  // Wave animation for color cycling
  enableColorCycle?: boolean
  colorCycleSpeed?: number
  colorCycleAmplitude?: number

  // Canvas dimensions
  width?: number
  height?: number

  // Styling
  className?: string
}

export function RenderCanvas({
  trails = 80,
  size = 50,
  friction = 0.5,
  dampening = 0.025,
  tension = 0.99,
  lineWidth = 10,
  colorHue = 285,
  colorSaturation = 100,
  colorLightness = 50,
  opacity = 0.025,
  enableColorCycle = true,
  colorCycleSpeed = 0.0015,
  colorCycleAmplitude = 85,
  width = 1400,
  height = 900,
  className = "",
}: RenderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<{
    ctx:
      | (CanvasRenderingContext2D & { running?: boolean; frame?: number })
      | null
    cleanup: () => void
  }>({ ctx: null, cleanup: () => {} })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D & {
      running?: boolean
      frame?: number
    }
    if (!ctx) return

    ctx.running = true
    ctx.frame = 1
    animationRef.current.ctx = ctx

    // Initialize variables
    const pos = { x: canvas.width / 2, y: canvas.height / 2 }
    
    // Wave class for color cycling
    class WaveFunction {
      phase: number
      offset: number
      frequency: number
      amplitude: number
      
      constructor(config: { phase?: number; offset?: number; frequency?: number; amplitude?: number }) {
        this.phase = config.phase || 0
        this.offset = config.offset || 0
        this.frequency = config.frequency || 0.001
        this.amplitude = config.amplitude || 1
      }
      
      update() {
        this.phase += this.frequency
        return this.offset + Math.sin(this.phase) * this.amplitude
      }
    }

    // Node class for trail points
    class Node {
      x = 0
      y = 0
      vx = 0
      vy = 0
    }

    // Line class for trail effects
    class Line {
      spring: number
      friction: number
      nodes: Node[]
      
      constructor(config: { spring: number }) {
        this.spring = config.spring + 0.1 * Math.random() - 0.05
        this.friction = friction + 0.01 * Math.random() - 0.005
        this.nodes = []
        for (let i = 0; i < size; i++) {
          const node = new Node()
          node.x = pos.x
          node.y = pos.y
          this.nodes.push(node)
        }
      }
      
      update() {
        let spring = this.spring
        let node = this.nodes[0]
        node.vx += (pos.x - node.x) * spring
        node.vy += (pos.y - node.y) * spring

        for (let i = 0; i < this.nodes.length; i++) {
          node = this.nodes[i]
          if (i > 0) {
            const prevNode = this.nodes[i - 1]
            node.vx += (prevNode.x - node.x) * spring
            node.vy += (prevNode.y - node.y) * spring
            node.vx += prevNode.vx * dampening
            node.vy += prevNode.vy * dampening
          }
          node.vx *= this.friction
          node.vy *= this.friction
          node.x += node.vx
          node.y += node.vy
          spring *= tension
        }
      }
      
      draw() {
        if (this.nodes.length < 2) return

        let x = this.nodes[0].x
        let y = this.nodes[0].y
        ctx.beginPath()
        ctx.moveTo(x, y)

        for (let i = 1; i < this.nodes.length - 2; i++) {
          const node = this.nodes[i]
          const nextNode = this.nodes[i + 1]
          x = 0.5 * (node.x + nextNode.x)
          y = 0.5 * (node.y + nextNode.y)
          ctx.quadraticCurveTo(node.x, node.y, x, y)
        }

        if (this.nodes.length >= 2) {
          const secondLast = this.nodes[this.nodes.length - 2]
          const last = this.nodes[this.nodes.length - 1]
          ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y)
        }

        ctx.stroke()
        ctx.closePath()
      }
    }

    let colorWave: WaveFunction | null = null
    let lines: Line[] = []

    if (enableColorCycle) {
      colorWave = new WaveFunction({
        phase: Math.random() * 2 * Math.PI,
        amplitude: colorCycleAmplitude,
        frequency: colorCycleSpeed,
        offset: colorHue,
      })
    }

    function createLines() {
      lines = []
      for (let i = 0; i < trails; i++) {
        lines.push(new Line({ spring: 0.45 + (i / trails) * 0.025 }))
      }
    }

    // ✅ Fix cursor offset using bounding rect with proper scaling
    function handleMouseMove(e: MouseEvent | TouchEvent) {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      // Scale mouse position to canvas internal dimensions
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      
      if ("touches" in e && e.touches) {
        pos.x = (e.touches[0].clientX - rect.left) * scaleX
        pos.y = (e.touches[0].clientY - rect.top) * scaleY
      } else {
        const mouseEvent = e as MouseEvent
        pos.x = (mouseEvent.clientX - rect.left) * scaleX
        pos.y = (mouseEvent.clientY - rect.top) * scaleY
      }
      e.preventDefault()
    }

    function handleTouchStart(e: TouchEvent) {
      if (!canvas) return
      if (e.touches.length === 1) {
        const rect = canvas.getBoundingClientRect()
        const scaleX = canvas.width / rect.width
        const scaleY = canvas.height / rect.height
        pos.x = (e.touches[0].clientX - rect.left) * scaleX
        pos.y = (e.touches[0].clientY - rect.top) * scaleY
      }
    }

    function render() {
      if (!ctx.running) return

      ctx.globalCompositeOperation = "source-over"
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      ctx.globalCompositeOperation = "lighter"

      if (enableColorCycle && colorWave) {
        ctx.strokeStyle = `hsla(${Math.round(colorWave.update())},${colorSaturation}%,${colorLightness}%,${opacity})`
      } else {
        ctx.strokeStyle = `hsla(${colorHue},${colorSaturation}%,${colorLightness}%,${opacity})`
      }

      ctx.lineWidth = lineWidth

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        line.update()
        line.draw()
      }

      if (ctx.frame !== undefined) ctx.frame++
      requestAnimationFrame(render)
    }

    function resizeCanvas() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      // Use displayed size for proper mouse tracking
      canvas.width = rect.width || width
      canvas.height = rect.height || height
    }

    function initializeAnimation() {
      createLines()
      render()
    }

    // Set up event listeners
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("touchmove", handleMouseMove)
    document.addEventListener("touchstart", handleTouchStart)
    window.addEventListener("resize", resizeCanvas)
    
    // Auto-initialize on mount
    initializeAnimation()

    const handleFocus = () => {
      if (!ctx.running) {
        ctx.running = true
        render()
      }
    }

    const handleBlur = () => {
      ctx.running = false
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("blur", handleBlur)

    resizeCanvas()

    // Cleanup function
    animationRef.current.cleanup = () => {
      ctx.running = false
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("touchmove", handleMouseMove)
      document.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("resize", resizeCanvas)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("blur", handleBlur)
    }

    return () => {
      animationRef.current.cleanup()
    }
  }, [
    trails,
    size,
    friction,
    dampening,
    tension,
    lineWidth,
    colorHue,
    colorSaturation,
    colorLightness,
    opacity,
    enableColorCycle,
    colorCycleSpeed,
    colorCycleAmplitude,
    width,
    height,
  ])

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        id="canvas"
        className="absolute inset-0 h-full w-full cursor-default"
      />
    </div>
  )
}
