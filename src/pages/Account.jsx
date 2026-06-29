import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Avatar } from '../components/UserMenu'
import PlanBadge from '../components/PlanBadge'
import './Account.css'

export default function Account() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [sessions, setSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const avatarInputRef = useRef(null)
  const navigate = useNavigate()

  // ONE useEffect loads everything
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)

      // Decode session_id from JWT
      const payload = JSON.parse(atob(session.access_token.split('.')[1]))
      setCurrentSessionId(payload.session_id)

      // Load profile and sessions in parallel
      const [profileRes, sessionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('plan, created_at, avatar_url')
          .eq('id', session.user.id)
          .single(),
        supabase
          .from('user_sessions')
          .select('*')
          .order('last_active', { ascending: false })
      ])

      setProfile(profileRes.data)
      setAvatarUrl(profileRes.data?.avatar_url ?? null)
      setSessions(sessionsRes.data || [])

      setLoading(false)
      setSessionsLoading(false)
    }
    load()
  }, [navigate])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return alert('Image must be under 2MB.')

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Upload failed. Please try again.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path)

    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    await supabase
      .from('profiles')
      .update({ avatar_url: urlWithBust })
      .eq('id', user.id)

    setAvatarUrl(urlWithBust)
    setUploading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handleRevokeSession = async (sessionId) => {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revoke-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id: sessionId }),
    })
    setSessions(prev => prev.filter(s => s.session_id !== sessionId))
  }

  const handleRevokeAllOthers = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.auth.signOut({ scope: 'others' })
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/revoke-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: currentSessionId,
        revoke_all_others: true,
      }),
    })
    setSessions(prev => prev.filter(s => s.session_id === currentSessionId))
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      }
    )
    if (res.ok) {
      await supabase.auth.signOut()
      navigate('/')
    } else {
      alert('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  if (loading) return <div className="account-page"><p>Loading...</p></div>

  return (
    <div className="account-page">
      <div className="account-card">

        <div className="account-header">
          <span className="account-email">{user.email}</span>
          <PlanBadge plan={profile?.plan} />
        </div>

        <div className="avatar-section">
          <div className="avatar-preview">
            <Avatar user={user} profileAvatarUrl={avatarUrl} size={72} />
            {uploading && (
              <div className="avatar-uploading-overlay">
                <div className="spinner" />
              </div>
            )}
          </div>
          <div className="avatar-info">
            <p className="avatar-name">
              {user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]}
            </p>
            <button
              className="btn-change-avatar"
              onClick={() => avatarInputRef.current.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Change photo'}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
          </div>
        </div>

        {profile?.plan !== 'paid' && (
          <div className="upgrade-banner">
            <h3>Unlock full-resolution downloads</h3>
            <p>Upgrade to access image upscaling and other paid tools.</p>
            <button className="btn-upgrade" onClick={() => navigate('/pricing')}>
              Upgrade
            </button>
          </div>
        )}

        {/* Active Sessions */}
        <div className="account-section">
          <div className="sessions-header">
            <h4>Active sessions</h4>
            {sessions.length > 1 && (
              <button className="btn-revoke-all" onClick={handleRevokeAllOthers}>
                Sign out all other devices
              </button>
            )}
          </div>

          {sessionsLoading ? (
            <p className="sessions-loading">Loading sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="sessions-loading">No sessions found.</p>
          ) : (
            <div className="sessions-list">
              {sessions.map(s => (
                <div key={s.id} className="session-row">
                  <div className="session-icon">
                    {s.device_type === 'Mobile' ? '📱' : s.device_type === 'Tablet' ? '📟' : '💻'}
                  </div>
                  <div className="session-info">
                    <span className="session-device">
                      {s.browser} on {s.os}
                      {s.session_id === currentSessionId && (
                        <span className="session-current">Current</span>
                      )}
                    </span>
                    <span className="session-location">
                      {s.city !== 'Unknown' ? `${s.city}, ` : ''}{s.country}
                      {' · '}
                      {new Date(s.last_active).toLocaleDateString('en-NG', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </span>
                  </div>
                  {s.session_id !== currentSessionId && (
                    <button
                      className="btn-revoke"
                      onClick={() => handleRevokeSession(s.session_id)}
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="account-section">
          <h4>Account</h4>
          <button className="account-row" onClick={handleLogout}>Log out</button>
        </div>

        <div className="account-section">
          <h4 className="danger-heading">Danger zone</h4>
          <button className="account-row danger-row" onClick={() => setShowDeleteModal(true)}>
            Delete account
          </button>
        </div>

      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Delete your account?</h3>
            <p>This permanently deletes your Nextew account and all data. This cannot be undone.</p>
            <p className="modal-instruction">Type <strong>DELETE</strong> to confirm.</p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button
                className="btn-danger"
                disabled={confirmText !== 'DELETE' || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}