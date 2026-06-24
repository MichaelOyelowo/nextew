import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PlanBadge from './PlanBadge'
import './UserMenu.css'

const COLORS = ['#22d3ee', '#a855f7', '#f97316', '#10b981', '#ec4899', '#6366f1']

function colorForString(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function getInitials(name) {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

export function Avatar({ user, profileAvatarUrl = null, size = 36 }) {
  const [imgError, setImgError] = useState(false)
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email
  // Google provides avatar_url in metadata; email users use profiles.avatar_url
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || profileAvatarUrl

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="user-avatar-img"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="user-avatar-initials"
      style={{ width: size, height: size, background: colorForString(user.id), fontSize: size * 0.4 }}
    >
      {getInitials(name)}
    </div>
  )
}

export default function UserMenu({ user }) {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState(null)
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(null)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]

  useEffect(() => {
    supabase
      .from('profiles')
      .select('plan, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setPlan(data?.plan ?? 'free')
        setProfileAvatarUrl(data?.avatar_url ?? null)
      })
  }, [user.id])

  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    const handleKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/')
  }

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar user={user} profileAvatarUrl={profileAvatarUrl} />
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">
            <Avatar user={user} profileAvatarUrl={profileAvatarUrl} size={44} />
            <div className="user-menu-info">
              <span className="user-menu-name">{displayName}</span>
              <span className="user-menu-email">{user.email}</span>
            </div>
            <div className="user-menu-badge"><PlanBadge plan={plan} /></div>
          </div>

          <div className="user-menu-divider" />

          <Link to="/account" role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
            Account & Billing
          </Link>
          <button role="menuitem" className="user-menu-item user-menu-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}