'use client'

import { useEffect, useRef, useState, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function ProgressInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const prevRouteRef = useRef(pathname + searchParams.toString())

  useEffect(() => {
    const current = pathname + searchParams.toString()
    if (current !== prevRouteRef.current) {
      prevRouteRef.current = current
      if (intervalRef.current) clearInterval(intervalRef.current)
      setWidth(100)
      timeoutRef.current = setTimeout(() => {
        setVisible(false)
        setWidth(0)
      }, 350)
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [pathname, searchParams])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') ?? ''
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('http') ||
        href.startsWith('mailto') ||
        anchor.target === '_blank'
      ) return

      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      setVisible(true)
      setWidth(20)

      let current = 20
      intervalRef.current = setInterval(() => {
        current += Math.random() * 12 + 3
        if (current >= 85) {
          clearInterval(intervalRef.current)
          current = 85
        }
        setWidth(current)
      }, 250)
    }

    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[2px] bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
      style={{
        width: `${width}%`,
        transition: width === 100
          ? 'width 150ms ease-out'
          : 'width 250ms ease-in-out',
      }}
    />
  )
}

export function NavigationProgress() {
  return (
    <Suspense>
      <ProgressInner />
    </Suspense>
  )
}
