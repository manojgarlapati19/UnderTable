import ChatLayoutClient from '../chat/ChatLayoutClient'

export default function BookmarksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ChatLayoutClient>
      {children}
    </ChatLayoutClient>
  )
}
