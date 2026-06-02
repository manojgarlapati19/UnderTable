import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

interface InvitePageProps {
  params: { code: string }
}

export default async function InvitePage({ params }: InvitePageProps) {
  const supabase = await createServerSupabaseClient()

  const { data: invite } = await supabase
    .from('invite_links')
    .select('*')
    .eq('code', params.code)
    .single()

  if (
    !invite ||
    !invite.is_active ||
    (invite.max_uses && invite.uses_count >= invite.max_uses)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-sm px-4">
          <div className="text-6xl mb-6">🚫</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Invalid Invite Link
          </h1>
          <p className="text-muted-foreground">
            This invite link is invalid or has expired. Please ask your admin for a new one.
          </p>
        </div>
      </div>
    )
  }

  // Valid invite - redirect to signup with code
  redirect(`/signup?code=${params.code}`)
}
