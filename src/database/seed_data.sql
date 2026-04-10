-- ============================================
-- TUTOK PITIK STUDIOS - SEED DATA
-- Initial data for testing and development
-- ============================================

-- ============================================
-- ADMIN ACCOUNTS (3 accounts)
-- ============================================

-- Note: In Supabase, users are created via auth.users table
-- These are the metadata entries that go into your custom users table

-- 1. SUPER ADMIN ACCOUNT
-- Email: superadmin@tutokpitik.com
-- Password: SuperAdmin123!
-- Role: superadmin
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001', -- UUID for superadmin
    'superadmin@tutokpitik.com',
    'Super Administrator',
    'superadmin',
    'superadmin',
    '',
    NOW(),
    NOW()
);

-- 2. ADMIN ACCOUNT
-- Email: admin@tutokpitik.com
-- Password: Admin123!
-- Role: admin
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000002', -- UUID for admin
    'admin@tutokpitik.com',
    'Studio Administrator',
    'studioadmin',
    'admin',
    '',
    NOW(),
    NOW()
);

-- 3. STAFF ACCOUNT
-- Email: staff@tutokpitik.com
-- Password: Staff123!
-- Role: staff
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000003', -- UUID for staff
    'staff@tutokpitik.com',
    'Studio Staff Member',
    'staffmember',
    'staff',
    '',
    NOW(),
    NOW()
);

-- ============================================
-- DUMMY CLIENT ACCOUNTS (5 customers)
-- ============================================

-- CLIENT 1: Juan Dela Cruz
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'juan.delacruz@gmail.com',
    'Juan Dela Cruz',
    'juandc',
    'customer',
    '',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
);

-- CLIENT 2: Maria Santos
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000002',
    'maria.santos@yahoo.com',
    'Maria Santos',
    'mariasantos',
    'customer',
    '',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
);

-- CLIENT 3: Pedro Reyes
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000003',
    'pedro.reyes@outlook.com',
    'Pedro Reyes',
    'pedroreyes',
    'customer',
    '',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days'
);

-- CLIENT 4: Ana Garcia
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000004',
    'ana.garcia@gmail.com',
    'Ana Garcia',
    'anagarcia',
    'customer',
    '',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days'
);

-- CLIENT 5: Carlos Mendoza
INSERT INTO users (
    id,
    email,
    full_name,
    username,
    role,
    profile_picture_url,
    created_at,
    updated_at
) VALUES (
    '10000000-0000-0000-0000-000000000005',
    'carlos.mendoza@hotmail.com',
    'Carlos Mendoza',
    'carlosmendoza',
    'customer',
    '',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
);

-- ============================================
-- BOOKINGS (10 bookings across 5 clients)
-- ============================================

-- BOOKING 1: Juan Dela Cruz - Wedding Photography (Confirmed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Juan Dela Cruz',
    'juan.delacruz@gmail.com',
    '+639171234567',
    'Wedding Photography',
    '2025-05-15',
    '14:00',
    '22:00',
    8,
    'Manila Hotel, Manila',
    25000.00,
    2000.00,
    27000.00,
    'confirmed',
    'Outdoor garden wedding ceremony',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '20 days'
);

-- BOOKING 2: Juan Dela Cruz - Pre-Wedding Shoot (Completed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    'Juan Dela Cruz',
    'juan.delacruz@gmail.com',
    '+639171234567',
    'Pre-Wedding Shoot',
    '2025-04-20',
    '06:00',
    '10:00',
    4,
    'Tagaytay, Cavite',
    12000.00,
    1500.00,
    13500.00,
    'completed',
    'Sunrise shoot at Taal Lake viewpoint',
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '25 days'
);

-- BOOKING 3: Maria Santos - Birthday Photography (Confirmed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000002',
    'Maria Santos',
    'maria.santos@yahoo.com',
    '+639281234567',
    'Birthday Photography',
    '2025-04-30',
    '15:00',
    '19:00',
    4,
    'The Peninsula Manila, Makati',
    8000.00,
    1000.00,
    9000.00,
    'confirmed',
    '18th birthday party, elegant theme',
    NOW() - INTERVAL '23 days',
    NOW() - INTERVAL '15 days'
);

-- BOOKING 4: Maria Santos - Family Portrait (Pending)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000002',
    'Maria Santos',
    'maria.santos@yahoo.com',
    '+639281234567',
    'Family Portrait',
    '2025-05-10',
    '10:00',
    '12:00',
    2,
    'Rizal Park, Manila',
    5000.00,
    500.00,
    5500.00,
    'pending',
    'Family of 6, outdoor shoot',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
);

-- BOOKING 5: Pedro Reyes - Corporate Event (Completed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000003',
    'Pedro Reyes',
    'pedro.reyes@outlook.com',
    '+639391234567',
    'Corporate Event Photography',
    '2025-04-10',
    '08:00',
    '17:00',
    9,
    'SMX Convention Center, Pasay',
    18000.00,
    1500.00,
    19500.00,
    'completed',
    'Annual company conference, 500+ attendees',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '30 days'
);

-- BOOKING 6: Pedro Reyes - Product Photography (Confirmed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000003',
    'Pedro Reyes',
    'pedro.reyes@outlook.com',
    '+639391234567',
    'Product Photography',
    '2025-05-05',
    '13:00',
    '17:00',
    4,
    'Tutok Pitik Studios, Quezon City',
    10000.00,
    0.00,
    10000.00,
    'confirmed',
    'E-commerce product catalog - 50 items',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '12 days'
);

-- BOOKING 7: Ana Garcia - Graduation Photography (Pending)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000004',
    'Ana Garcia',
    'ana.garcia@gmail.com',
    '+639401234567',
    'Graduation Photography',
    '2025-05-20',
    '09:00',
    '13:00',
    4,
    'University of the Philippines, Diliman',
    7000.00,
    800.00,
    7800.00,
    'pending',
    'College graduation, individual and family shots',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
);

-- BOOKING 8: Ana Garcia - Portrait Session (Confirmed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000004',
    'Ana Garcia',
    'ana.garcia@gmail.com',
    '+639401234567',
    'Portrait Photography',
    '2025-04-25',
    '14:00',
    '16:00',
    2,
    'Tutok Pitik Studios, Quezon City',
    4500.00,
    0.00,
    4500.00,
    'confirmed',
    'Professional headshots for LinkedIn',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '10 days'
);

-- BOOKING 9: Carlos Mendoza - Christening (Confirmed)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000005',
    'Carlos Mendoza',
    'carlos.mendoza@hotmail.com',
    '+639511234567',
    'Christening Photography',
    '2025-05-08',
    '11:00',
    '15:00',
    4,
    'San Agustin Church, Intramuros',
    6500.00,
    1000.00,
    7500.00,
    'confirmed',
    'Baby christening ceremony and reception',
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '6 days'
);

-- BOOKING 10: Carlos Mendoza - Engagement Shoot (Pending)
INSERT INTO bookings (
    id,
    user_id,
    full_name,
    email,
    phone,
    service,
    booking_date,
    start_time,
    end_time,
    duration,
    location,
    base_price,
    transportation_fee,
    total_price,
    status,
    notes,
    created_at,
    updated_at
) VALUES (
    '20000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000005',
    'Carlos Mendoza',
    'carlos.mendoza@hotmail.com',
    '+639511234567',
    'Engagement Shoot',
    '2025-05-25',
    '16:00',
    '19:00',
    3,
    'Bonifacio Global City, Taguig',
    9000.00,
    1200.00,
    10200.00,
    'pending',
    'Urban engagement photos, sunset golden hour',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
);

-- ============================================
-- SUMMARY OF SEED DATA
-- ============================================
-- Admin Accounts: 3
--   - Super Admin: superadmin@tutokpitik.com
--   - Admin: admin@tutokpitik.com
--   - Staff: staff@tutokpitik.com
--
-- Customer Accounts: 5
--   - Juan Dela Cruz (2 bookings)
--   - Maria Santos (2 bookings)
--   - Pedro Reyes (2 bookings)
--   - Ana Garcia (2 bookings)
--   - Carlos Mendoza (2 bookings)
--
-- Total Bookings: 10
--   - Pending: 3
--   - Confirmed: 5
--   - Completed: 2
--   - Cancelled: 0
--
-- Total Revenue (Completed): ₱33,000.00
-- ============================================
