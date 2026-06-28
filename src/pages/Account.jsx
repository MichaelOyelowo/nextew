import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRef } from 'react'
import { Avatar } from '../components/UserMenu'
import PlanBadge from '../components/PlanBadge'
import './Account.css'

export default function Account() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const avatarInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        navigate('/login')
        return
      }
      setUser(session.user)

      const { data } = await supabase
        .from('profiles')
        .select('plan, created_at, avatar_url')
        .eq('id', session.user.id)
        .single()

      setProfile(data)
      setAvatarUrl(data?.avatar_url ?? null)
      setLoading(false)
    }
    load()
  }, [navigate])

  const handleAvatarUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  // Enforce reasonable size limit client-side
  if (file.size > 2 * 1024 * 1024) {
    return alert('Image must be under 2MB.')
  }

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

  // Add cache-busting so the new image shows immediately
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
            {uploading && <div className="avatar-uploading-overlay"><div className="spinner" /></div>}
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