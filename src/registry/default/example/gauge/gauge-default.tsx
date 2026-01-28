"use client"

import { Gauge } from "@/registry/default/components/gauge"

export default function Component() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Gauge value={62} primary="#9aed00" secondary="rgba(154, 237, 0, 0.2)" />
    </div>
  )
}
