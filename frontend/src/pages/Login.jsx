import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [avatar, setAvatar] = useState(null);

    // 👇 Dynamic Avatar Fetcher
    useEffect(() => {
        if (!username.trim()) {
            setAvatar(null);
            return;
        }

        // Wait 500ms after the user stops typing before asking the database
        const delayDebounceFn = setTimeout(async () => {
            try {
                const res = await fetch(`/api/auth/avatar/${username}`);
                if (res.ok) {
                    const data = await res.json();
                    setAvatar(data.profile_picture);
                } else {
                    setAvatar(null);
                }
            } catch {
                setAvatar(null);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [username]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.access_token);
                window.location.href = '/dashboard';
            } else {
                toast.error(data.detail || 'Login failed');
            }
        } catch {
            toast.error('Network Error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-sidebar)' }}>
        <div className="card" style={{ width: 400, padding: '40px 30px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', border: '1px solid #1e293b' }}>

        {/* 👇 BIG PROFILE PICTURE UI 👇 */}
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
        {avatar ? (
            <img
            src={`/uploads/${avatar}`}
            alt="User Avatar"
            style={{
                width: 130, height: 130, borderRadius: '50%', objectFit: 'cover',
                border: '4px solid #2563eb', boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                   transition: 'all 0.3s ease-in-out'
            }}
            />
        ) : (
            <div style={{
                width: 130, height: 130, borderRadius: '50%', background: '#0f172a',
                border: '4px solid #334155', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all 0.3s ease-in-out'
            }}>
            {/* Default Eagle Logo */}
            <svg viewBox="0 0 24 24" fill="#334155" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
            <path d="M22 2C22 2 14.5 4 12 8C9.5 4 2 2 2 2C2 2 6.5 8 5 14C8 12 12 16 12 16C12 16 16 12 19 14C17.5 8 22 2 22 2Z" />
            </svg>
            </div>
        )}
        </div>

        <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Welcome Back</h2>

        <form onSubmit={handleLogin}>
        <input
        className="input"
        placeholder="Username"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ marginBottom: 16, textAlign: 'center', fontSize: 16, padding: '12px' }}
        autoComplete="username"
        />
        <input
        className="input"
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ marginBottom: 24, textAlign: 'center', fontSize: 16, padding: '12px' }}
        autoComplete="current-password"
        />
        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 16, fontWeight: 700 }}>
        {loading ? 'Authenticating...' : 'Secure Login'}
        </button>
        </form>
        </div>
        </div>
    );
}
