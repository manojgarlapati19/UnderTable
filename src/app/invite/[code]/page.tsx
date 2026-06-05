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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center glass-auth space-y-6">
          <div className="text-6xl">🚫</div>
          <div>
            <h1 className="text-[26px] font-semibold text-white">
              Invalid Invite Link
            </h1>
            <p className="text-[13px] text-[rgba(255,255,255,0.6)] mt-1">
              This invite link is invalid or has expired. Please ask your admin for a new one.
            </p>
          </div>
        </div>
      </div>
    )
  }

  redirect(`/signup?code=${params.code}`)
}
