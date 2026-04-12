"use client"

import dynamic from "next/dynamic"

const PortalV2 = dynamic(() => import("@/app/admin/portal-v2/page"), { ssr: false })

export default function Page() {
  return <PortalV2 />
}
