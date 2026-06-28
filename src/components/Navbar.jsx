import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import UserMenu, { Avatar } from './UserMenu'
import './Navbar.css'

function Navbar() {
    const [isOpen, setIsOpen] = useState(false)
    const [user, setUser] = useState(null)
    const [profileAvatarUrl, setProfileAvatarUrl] = useState(null)

    const fetchAvatar = async (userId) => {
        const { data } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', userId)
            .single()
        setProfileAvatarUrl(data?.avatar_url ?? null)
    }

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) fetchAvatar(session.user.id)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) fetchAvatar(session.user.id)
            else setProfileAvatarUrl(null)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setIsOpen(false)
    }

    const toggleMenu = () => setIsOpen(!isOpen)

    return (
        <nav className="navbar" aria-label="Primary navigation">
            <Link to="/" className="navbar-logo">
                Next<span>ew</span>
            </Link>

            <ul id="navbar-links" className={`navbar-links ${isOpen ? 'open' : ''}`}>
                <li className="mobile-auth">
                    {!user ? (
                        <>
                            <Link to="/login" className="btn-login" onClick={() => setIsOpen(false)}>Login</Link>
                            <Link to="/signup" className="btn-signup" onClick={() => setIsOpen(false)}>Sign Up</Link>
                        </>
                    ) : (
                        <div className="mobile-user-block">
                            <Link to="/account" className="mobile-user-row" onClick={() => setIsOpen(false)}>
                                <Avatar user={user} profileAvatarUrl={profileAvatarUrl} size={32} />
                                <span>{user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0]}</span>
                            </Link>
                            <button onClick={handleLogout} className="btn-login">Logout</button>
                        </div>
                    )}
                </li>

                <li><Link to="/" onClick={() => setIsOpen(false)}>Home</Link></li>
                <li><Link to="/upscale" onClick={() => setIsOpen(false)}>Upscale</Link></li>
                <li><Link to="/svg-converter" onClick={() => setIsOpen(false)}>SVG</Link></li>
                <li><Link to="/remove-bg" onClick={() => setIsOpen(false)}>Remove BG</Link></li>
                <li><Link to="/resize" onClick={() => setIsOpen(false)}>Resize</Link></li>
                <li><Link to="/pricing" onClick={() => setIsOpen(false)}>Pricing</Link></li>
            </ul>

            <div className="navbar-auth">
                {!user ? (
                    <>
                        <Link to="/login" className="btn-login">Login</Link>
                        <Link to="/signup" className="btn-signup">Sign Up</Link>
                    </>
                ) : (
                    <UserMenu user={user} />
                )}
            </div>

            <button
                type="button"
                className="hamburger"
                onClick={toggleMenu}
                aria-expanded={isOpen}
                aria-controls="navbar-links"
                aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
                <span className={`bar ${isOpen ? 'open' : ''}`}></span>
                <span className={`bar ${isOpen ? 'open' : ''}`}></span>
                <span className={`bar ${isOpen ? 'open' : ''}`}></span>
            </button>
        </nav>
    )
}

export default Navbar