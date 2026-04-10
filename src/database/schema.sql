-- ============================================
-- TUTOK PITIK STUDIOS - DATABASE SCHEMA
-- Complete SQL schema for PostgreSQL/Supabase
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'customer',
    -- Roles: superadmin, admin, staff, customer, guest
    profile_picture_url TEXT,
    phone VARCHAR(20),
    address TEXT,
    status VARCHAR(20) DEFAULT 'active',
    -- Status: active, inactive, suspended
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_role CHECK (role IN ('superadmin', 'admin', 'staff', 'customer', 'guest')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- Index for faster queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Customer Information
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    
    -- Booking Details
    service VARCHAR(100) NOT NULL,
    -- Services: Wedding Photography, Birthday Photography, Corporate Event Photography, 
    --           Pre-Wedding Shoot, Engagement Shoot, Family Portrait, Graduation Photography,
    --           Christening Photography, Product Photography, Portrait Photography
    
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration INTEGER NOT NULL, -- in hours
    
    -- Location
    location TEXT NOT NULL,
    
    -- Pricing
    base_price DECIMAL(10, 2) NOT NULL,
    transportation_fee DECIMAL(10, 2) DEFAULT 0.00,
    total_price DECIMAL(10, 2) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',
    -- Status: pending, confirmed, completed, cancelled
    
    -- Additional Information
    notes TEXT,
    special_requests TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_booking_status CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'))
);

-- Indexes for faster queries
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_email ON bookings(email);

-- ============================================
-- PORTFOLIO IMAGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS portfolio_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Image Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL, -- Can be base64 or URL
    
    -- Categories (5 main categories)
    category VARCHAR(50) NOT NULL,
    -- Categories: Wedding, Birthday, Corporate, Family, Studio
    
    -- Subcategories (5 per category = 25 total)
    subcategory VARCHAR(50) NOT NULL,
    -- Wedding: Outdoor, Indoor, Church, Beach, Garden
    -- Birthday: Kids, Adult, Debut, Themed, Milestone
    -- Corporate: Conference, Product, Headshot, Team, Event
    -- Family: Portrait, Reunion, Newborn, Maternity, Extended
    -- Studio: Fashion, Editorial, Commercial, Personal, Creative
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_featured BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    
    CONSTRAINT valid_category CHECK (category IN ('Wedding', 'Birthday', 'Corporate', 'Family', 'Studio')),
    CONSTRAINT valid_subcategory CHECK (
        (category = 'Wedding' AND subcategory IN ('Outdoor', 'Indoor', 'Church', 'Beach', 'Garden')) OR
        (category = 'Birthday' AND subcategory IN ('Kids', 'Adult', 'Debut', 'Themed', 'Milestone')) OR
        (category = 'Corporate' AND subcategory IN ('Conference', 'Product', 'Headshot', 'Team', 'Event')) OR
        (category = 'Family' AND subcategory IN ('Portrait', 'Reunion', 'Newborn', 'Maternity', 'Extended')) OR
        (category = 'Studio' AND subcategory IN ('Fashion', 'Editorial', 'Commercial', 'Personal', 'Creative'))
    )
);

-- Indexes for faster queries
CREATE INDEX idx_portfolio_category ON portfolio_images(category);
CREATE INDEX idx_portfolio_subcategory ON portfolio_images(subcategory);
CREATE INDEX idx_portfolio_featured ON portfolio_images(is_featured);
CREATE INDEX idx_portfolio_created_by ON portfolio_images(created_by);

-- ============================================
-- FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    portfolio_image_id UUID REFERENCES portfolio_images(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, portfolio_image_id) -- Prevent duplicate favorites
);

-- Indexes for faster queries
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_image_id ON favorites(portfolio_image_id);

-- ============================================
-- SESSIONS TABLE (for user login tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    device_id TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for faster queries
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to bookings table
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to portfolio_images table
CREATE TRIGGER update_portfolio_images_updated_at BEFORE UPDATE ON portfolio_images
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'admin', 'staff')
        )
    );

-- Bookings table policies
CREATE POLICY "Users can view their own bookings"
    ON bookings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own bookings"
    ON bookings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all bookings"
    ON bookings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'admin', 'staff')
        )
    );

CREATE POLICY "Admins can update bookings"
    ON bookings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'admin', 'staff')
        )
    );

-- Portfolio images policies
CREATE POLICY "Anyone can view portfolio images"
    ON portfolio_images FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Admins can manage portfolio images"
    ON portfolio_images FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('superadmin', 'admin')
        )
    );

-- Favorites policies
CREATE POLICY "Users can view their own favorites"
    ON favorites FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can add favorites"
    ON favorites FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove favorites"
    ON favorites FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- View: Booking statistics by status
CREATE OR REPLACE VIEW booking_statistics AS
SELECT
    COUNT(*) AS total_bookings,
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_bookings,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_bookings,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_bookings,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_bookings,
    SUM(total_price) FILTER (WHERE status = 'completed') AS total_revenue,
    AVG(total_price) FILTER (WHERE status = 'completed') AS average_booking_value
FROM bookings;

-- View: User statistics by role
CREATE OR REPLACE VIEW user_statistics AS
SELECT
    COUNT(*) AS total_users,
    COUNT(*) FILTER (WHERE role = 'superadmin') AS superadmin_count,
    COUNT(*) FILTER (WHERE role = 'admin') AS admin_count,
    COUNT(*) FILTER (WHERE role = 'staff') AS staff_count,
    COUNT(*) FILTER (WHERE role = 'customer') AS customer_count,
    COUNT(*) FILTER (WHERE status = 'active') AS active_users,
    COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_users
FROM users;

-- View: Portfolio statistics by category
CREATE OR REPLACE VIEW portfolio_statistics AS
SELECT
    category,
    subcategory,
    COUNT(*) AS image_count,
    COUNT(*) FILTER (WHERE is_featured = true) AS featured_count
FROM portfolio_images
GROUP BY category, subcategory
ORDER BY category, subcategory;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bookings TO authenticated;
GRANT SELECT ON portfolio_images TO authenticated;
GRANT SELECT, INSERT, DELETE ON favorites TO authenticated;

-- Grant access to service role (for server-side operations)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================
-- SAMPLE QUERIES FOR TESTING
-- ============================================

-- Get all bookings for a specific user
-- SELECT * FROM bookings WHERE user_id = 'user-uuid-here' ORDER BY booking_date DESC;

-- Get all pending bookings
-- SELECT * FROM bookings WHERE status = 'pending' ORDER BY booking_date ASC;

-- Get total revenue
-- SELECT SUM(total_price) FROM bookings WHERE status = 'completed';

-- Get portfolio images by category
-- SELECT * FROM portfolio_images WHERE category = 'Wedding' ORDER BY created_at DESC;

-- Get user's favorite images
-- SELECT pi.* FROM portfolio_images pi
-- JOIN favorites f ON pi.id = f.portfolio_image_id
-- WHERE f.user_id = 'user-uuid-here';

-- ============================================
-- SCHEMA COMPLETE
-- ============================================
-- This schema supports:
-- ✅ 5 user roles (superadmin, admin, staff, customer, guest)
-- ✅ Full CRUD operations on all tables
-- ✅ 5 categories × 5 subcategories = 25 portfolio classifications
-- ✅ Row Level Security (RLS) for data protection
-- ✅ Automatic timestamp updates
-- ✅ Foreign key relationships
-- ✅ Indexes for performance
-- ✅ Views for reporting
-- ✅ Ready for SQL database migration
-- ============================================
