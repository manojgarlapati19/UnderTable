'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getAvatarGradient } from '@/lib/utils/avatar-color'

interface TypingIndicatorProps {
  users: string[]
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null

  const text =
    users.length === 1
      ? `${users[0]} is typing`
      : users.length === 2
      ? `${users[0]} and ${users[1]} are typing`
      : `${users[0]} and ${users.length - 1} others are typing`

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-[#8888A0]">
      <div className="relative">
        <Avatar className="h-6 w-6">
          <AvatarFallback
            style={{ background: getAvatarGradient(users[0]) }}
            className="text-white text-[8px]"
          >
            {users[0].charAt(0)}
          </AvatarFallback>
        </Avatar>
      </div>
      <span>{text}</span>
      <div className="flex items-center gap-1">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}
