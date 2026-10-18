import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function Profile() {
    const [user, setUser] = useState({ username: '', profile_picture: null });
    const [passwords, setPasswords] = useState({ old_password: '', new_password: '' });

    useEffect(() => {
        api.get('/auth/me').then(r => setUser(r.data)).catch(() => {});
    }, []);

    const changePassword = async () => {
        try {
            await api.post('/auth/change-password', passwords);
            toast.success('Password updated safely');
            setPasswords({ old_password: '', new_password: '' });
        } catch (e) {
            toast.error(e.response?.data?.detail || 'Failed to update password');
        }
    };

    const uploadAvatar = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' }});
            setUser({ ...user, profile_picture: res.data.profile_picture });
            toast.success('Profile picture updated');
            window.location.reload(); // Refresh to update sidebar
        } catch { toast.error('Upload failed'); }
    };

    return (
        <div>
        <div className="page-header">
        <div className="page-title">Admin Profile</div>
        </div>

        <div className="grid-2">
        <div className="card">
        <div className="card-title">Profile Picture</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {user.profile_picture ? (
            <img src={`/uploads/${user.profile_picture}`} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700 }}>
            {user.username.charAt(0).toUpperCase()}
            </div>
        )}
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
        Upload New Picture
        <input type="file" style={{ display: 'none' }} accept="image/*" onChange={uploadAvatar} />
        </label>
        </div>
        </div>

        <div className="card">
        <div className="card-title">Change Password</div>
        <input className="input" type="password" placeholder="Current Password" value={passwords.old_password} onChange={e => setPasswords({...passwords, old_password: e.target.value})} style={{ marginBottom: 12 }} />
        <input className="input" type="password" placeholder="New Password" value={passwords.new_password} onChange={e => setPasswords({...passwords, new_password: e.target.value})} style={{ marginBottom: 16 }} />
        <button className="btn btn-primary" onClick={changePassword}>Update Password</button>
        </div>
        </div>
        </div>
    );
}
