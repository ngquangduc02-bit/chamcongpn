-- ============================================================
-- CHAMCONG - Attendance Tracking App
-- Supabase SQL Schema
-- ============================================================
-- This schema is designed for a small shop (5-7 employees).
-- Authentication is handled at the application level using a
-- simple admin password stored in the settings table.
-- Supabase Auth is NOT used; all operations use the anon key.
-- RLS is disabled on all tables for simplicity.
-- ============================================================


-- ============================================================
-- 1. EMPLOYEES TABLE
-- Stores employee information including name, PIN for device
-- registration, contact info, and salary configuration.
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    pin         TEXT NOT NULL,                                          -- 4-6 digit PIN used for device registration / check-in
    phone       TEXT,
    salary_type TEXT NOT NULL DEFAULT 'hourly'
                    CHECK (salary_type IN ('hourly', 'monthly')),      -- Pay model
    salary_rate NUMERIC NOT NULL DEFAULT 0,                            -- Hourly rate or monthly salary amount
    is_active   BOOLEAN DEFAULT true,                                  -- Soft-delete / deactivation flag
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure PIN is 4-6 digits
    CONSTRAINT chk_pin_format CHECK (pin ~ '^\d{4,6}$')
);

-- Index for quick lookups by active status
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees (is_active);

COMMENT ON TABLE  employees IS 'Employee master data – name, PIN, salary info';
COMMENT ON COLUMN employees.pin IS '4-6 digit numeric PIN for device registration';
COMMENT ON COLUMN employees.salary_type IS 'hourly = paid per hour worked; monthly = fixed monthly salary';
COMMENT ON COLUMN employees.salary_rate IS 'Dollar/VND amount per hour (hourly) or per month (monthly)';


-- ============================================================
-- 2. DEVICE TOKENS TABLE
-- Maps registered devices to employees. Each employee can
-- register one or more devices via QR code scan + PIN.
-- ============================================================
CREATE TABLE IF NOT EXISTS device_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    device_token  TEXT UNIQUE NOT NULL,                                 -- Unique browser/device fingerprint or generated token
    device_info   TEXT,                                                 -- Optional user-agent or device description
    is_active     BOOLEAN DEFAULT true,                                -- Revoke access without deleting
    registered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for looking up tokens by employee
CREATE INDEX IF NOT EXISTS idx_device_tokens_employee_id ON device_tokens (employee_id);

-- Index for fast token validation during check-in/out
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens (device_token) WHERE is_active = true;

COMMENT ON TABLE  device_tokens IS 'Registered devices linked to employees for attendance';
COMMENT ON COLUMN device_tokens.device_token IS 'Unique token generated during QR registration flow';


-- ============================================================
-- 3. ATTENDANCE TABLE
-- Records each check-in / check-out event with GPS coordinates,
-- IP address, and computed total working hours.
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Check-in details
    check_in      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    check_in_lat  NUMERIC,                                             -- Latitude at check-in
    check_in_lng  NUMERIC,                                             -- Longitude at check-in
    check_in_ip   TEXT,                                                -- Client IP at check-in

    -- Check-out details (NULL until employee checks out)
    check_out     TIMESTAMPTZ,
    check_out_lat NUMERIC,                                             -- Latitude at check-out
    check_out_lng NUMERIC,                                             -- Longitude at check-out
    check_out_ip  TEXT,                                                -- Client IP at check-out

    -- Computed / metadata
    total_hours   NUMERIC,                                             -- Auto-calculated via trigger
    note          TEXT,                                                 -- Optional note (e.g. reason for manual edit)
    is_edited     BOOLEAN DEFAULT false,                               -- Flag if record was manually edited by admin
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying attendance by employee
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance (employee_id);

-- Index for date-range queries (daily / weekly / monthly reports)
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance (check_in);

-- Composite index for common query: "all attendance for employee X in date range"
CREATE INDEX IF NOT EXISTS idx_attendance_employee_checkin ON attendance (employee_id, check_in);

COMMENT ON TABLE  attendance IS 'Clock-in / clock-out records with location verification';
COMMENT ON COLUMN attendance.total_hours IS 'Automatically computed when check_out is set (trigger)';
COMMENT ON COLUMN attendance.is_edited IS 'True if admin manually modified this record';


-- ============================================================
-- 4. SETTINGS TABLE (single-row configuration)
-- Stores shop-wide settings: name, GPS center, allowed radius,
-- allowed IPs, and the admin password hash.
-- Only one row should ever exist in this table.
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name       TEXT DEFAULT 'Quán của tôi',                       -- Display name of the shop
    shop_lat        NUMERIC,                                           -- Shop center latitude for geo-fencing
    shop_lng        NUMERIC,                                           -- Shop center longitude for geo-fencing
    allowed_radius  NUMERIC DEFAULT 200,                               -- Max distance in meters from shop center
    allowed_ips     TEXT[] DEFAULT '{}',                                -- Whitelist of allowed IP addresses
    admin_password  TEXT DEFAULT '',                                    -- Hashed admin password for app-level auth
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  settings IS 'Single-row shop configuration (geo-fence, IPs, admin password)';
COMMENT ON COLUMN settings.allowed_radius IS 'Maximum allowed distance (meters) from shop for check-in/out';
COMMENT ON COLUMN settings.allowed_ips IS 'Array of allowed IP addresses; empty = allow all';
COMMENT ON COLUMN settings.admin_password IS 'Hashed admin password for application-level authentication';


-- ============================================================
-- 5. TRIGGER: Auto-calculate total_hours on check-out
-- When check_out is updated from NULL to a timestamp,
-- compute the difference in hours (rounded to 2 decimals).
-- ============================================================
CREATE OR REPLACE FUNCTION fn_calculate_total_hours()
RETURNS TRIGGER AS $$
BEGIN
    -- Only recalculate when check_out is set or changed
    IF NEW.check_out IS NOT NULL THEN
        NEW.total_hours := ROUND(
            EXTRACT(EPOCH FROM (NEW.check_out - NEW.check_in)) / 3600.0,
            2
        );
    ELSE
        NEW.total_hours := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_calculate_total_hours
    BEFORE INSERT OR UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION fn_calculate_total_hours();

COMMENT ON FUNCTION fn_calculate_total_hours() IS
    'Calculates total_hours as the difference between check_out and check_in in hours';


-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- Since this is a small shop app using the anon key with
-- application-level auth (admin password), we DISABLE RLS
-- on all tables. The app itself enforces access control.
-- ============================================================

-- Disable RLS on all tables (anon key has full access)
ALTER TABLE employees     DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance    DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings      DISABLE ROW LEVEL SECURITY;

-- Grant full access to anon and authenticated roles
-- (Supabase uses these roles for API access)
GRANT ALL ON employees     TO anon, authenticated;
GRANT ALL ON device_tokens TO anon, authenticated;
GRANT ALL ON attendance    TO anon, authenticated;
GRANT ALL ON settings      TO anon, authenticated;


-- ============================================================
-- 7. DEFAULT DATA
-- Insert a default settings row so the app always has
-- configuration to read on first load.
-- ============================================================
INSERT INTO settings (shop_name, allowed_radius, allowed_ips, admin_password)
VALUES (
    'Quán của tôi',          -- Default shop name
    200,                     -- 200 meter radius
    '{}',                    -- No IP restrictions
    ''                       -- Empty password (admin should set on first login)
)
ON CONFLICT DO NOTHING;     -- Prevent duplicate inserts on re-run


-- ============================================================
-- SCHEMA COMPLETE
-- ============================================================
-- Summary of objects created:
--   Tables:    employees, device_tokens, attendance, settings
--   Indexes:   6 indexes for performance on common queries
--   Trigger:   trg_calculate_total_hours (auto-compute hours)
--   RLS:       Disabled on all tables (app-level auth)
--   Defaults:  One settings row with shop defaults
-- ============================================================
