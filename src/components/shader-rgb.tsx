"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

interface ShaderRGBProps {
  className?: string
}

export function ShaderRGB({ className = "" }: ShaderRGBProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    scene: THREE.Scene | null
    camera: THREE.OrthographicCamera | null
    renderer: THREE.WebGLRenderer | null
    mesh: THREE.Mesh | null
    uniforms: any
    animationId: number | null
    canvas: HTMLCanvasElement | null
  }>({
    scene: null,
    camera: null,
    renderer: null,
    mesh: null,
    uniforms: null,
    animationId: null,
    canvas: null,
  })

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const { current: refs } = sceneRef

    // Create canvas programmatically
    const canvas = document.createElement("canvas")
    Object.assign(canvas.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
    })
    container.appendChild(canvas)
    refs.canvas = canvas

    const vertexShader = `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
        
        float d = length(p) * distortion;
        
        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);
        
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `

    const initScene = () => {
      const width = container.clientWidth || 800
      const height = container.clientHeight || 600
      
      refs.scene = new THREE.Scene()
      refs.renderer = new THREE.WebGLRenderer({ canvas, alpha: true })
      refs.renderer.setPixelRatio(window.devicePixelRatio)
      refs.renderer.setClearColor(new THREE.Color(0x000000))

      refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, -1)

      refs.uniforms = {
        resolution: { value: [width, height] },
        time: { value: 0.0 },
        xScale: { value: 1.0 },
        yScale: { value: 0.5 },
        distortion: { value: 0.05 },
      }

      const position = [
        -1.0, -1.0, 0.0, 1.0, -1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0,
        1.0, 0.0, 1.0, 1.0, 0.0,
      ]

      const positions = new THREE.BufferAttribute(new Float32Array(position), 3)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute("position", positions)

      const material = new THREE.RawShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: refs.uniforms,
        side: THREE.DoubleSide,
      })

      refs.mesh = new THREE.Mesh(geometry, material)
      refs.scene.add(refs.mesh)

      handleResize()
    }

    const animate = () => {
      if (refs.uniforms) refs.uniforms.time.value += 0.01
      if (refs.renderer && refs.scene && refs.camera) {
        refs.renderer.render(refs.scene, refs.camera)
      }
      refs.animationId = requestAnimationFrame(animate)
    }

    const handleResize = () => {
      if (!refs.renderer || !refs.uniforms) return
      const width = container.clientWidth || 1
      const height = container.clientHeight || 1
      if (width > 1 && height > 1) {
        refs.renderer.setSize(width, height, false)
        refs.uniforms.resolution.value = [width, height]
      }
    }

    initScene()
    animate()
    
    // Use ResizeObserver for better container dimension tracking
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(container)
    
    // Initial resize with slight delay to ensure layout
    requestAnimationFrame(handleResize)

    return () => {
      resizeObserver.disconnect()
      if (refs.animationId) cancelAnimationFrame(refs.animationId)
      if (refs.mesh) {
        refs.scene?.remove(refs.mesh)
        refs.mesh.geometry.dispose()
        if (refs.mesh.material instanceof THREE.Material) {
          refs.mesh.material.dispose()
        }
      }
      // Properly dispose WebGL context
      if (refs.renderer) {
        refs.renderer.forceContextLoss()
        refs.renderer.dispose()
      }
      // Remove canvas from DOM
      if (refs.canvas && container.contains(refs.canvas)) {
        container.removeChild(refs.canvas)
      }
    }
  }, [])

  return (
    <div ref={containerRef} className={`absolute inset-0 h-full w-full ${className}`} />
  )
}
