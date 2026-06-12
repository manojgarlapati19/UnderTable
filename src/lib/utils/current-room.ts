'use client'

import { useEffect, useState } from 'react'

let currentRoomId: string | null = null
const subscribers = new Set<(id: string | null) => void>()

export function setCurrentRoom(id: string | null) {
  currentRoomId = id
  subscribers.forEach((cb) => cb(id))
}

export function useCurrentRoomId(): string | null {
  const [roomId, setRoomId] = useState<string | null>(currentRoomId)
  useEffect(() => {
    const cb = (id: string | null) => setRoomId(id)
    subscribers.add(cb)
    setRoomId(currentRoomId)
    return () => { subscribers.delete(cb) }
  }, [])
  return roomId
}
