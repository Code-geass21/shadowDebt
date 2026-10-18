-- Create the users table safely
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_picture VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert the default admin user.
-- Username: admin | Password: admin123
INSERT INTO users (username, password_hash)
VALUES ('admin', '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjIQqiRQYm')
ON CONFLICT (username) DO NOTHING;

-- Grant permissions dynamically to whichever user owns the DB
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO CURRENT_USER;
