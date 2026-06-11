import { useState } from 'react'
import './Navbar.css'
import { Link } from 'react-router-dom'

function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    }


    return (
        <nav className="navbar">
            {/* logo */}
            <Link to="/" className="navbar-logo">
                Next<span>ew</span>
            </Link>
            {/* Nav links */}
            <ul className={`navbar-links ${isOpen ? 'open' : ''}`}>

                {/* Auth buttons - mobile only, sits at top */}
                <li className="mobile-auth">
                    <button className="btn-login">Login</button>
                    <button className="btn-signup">Sign Up</button>
                </li>

                <li><Link to="/" onClick={() => setIsOpen(false)}>Home</Link></li>
                <li><Link to="/convert" onClick={() => setIsOpen(false)}>Convert</Link></li>
                <li><Link to="/svg-converter" onClick={() => setIsOpen(false)}>SVG</Link></li>
                <li><Link to="/remove-bg" onClick={() => setIsOpen(false)}>Remove BG</Link></li>
                <li><Link to="/resize" onClick={() => setIsOpen(false)}>Resize</Link></li>
                <li><Link to="/pricing" onClick={() => setIsOpen(false)}>Pricing</Link></li>
            </ul>
            {/* auth buttons */}
            <div className="navbar-auth">
                <button className="btn-login">Login</button>
                <button className="btn-signup">Sign Up</button>
            </div>
            {/* hamburger menu */}
            <button className="hamburger" onClick={toggleMenu}>
                <span className={`bar ${isOpen ? 'open' : ''}`}></span>
                <span className={`bar ${isOpen ? 'open' : ''}`}></span>
                <span className={`bar ${isOpen ? 'open' : ''}`}></span>
            </button>
        </nav>
    )
}

export default Navbar;