import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase chưa được cấu hình! Hãy tạo file .env với VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// ============================================================
// EMPLOYEES
// ============================================================

export async function getEmployees(activeOnly = true) {
  let query = supabase.from('employees').select('*').order('name');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getEmployeeById(id) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createEmployee(employee) {
  const { data, error } = await supabase
    .from('employees')
    .insert(employee)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEmployee(id, updates) {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEmployee(id) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DEVICE TOKENS
// ============================================================

export async function getDeviceByToken(token) {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*, employees(*)')
    .eq('device_token', token)
    .eq('is_active', true)
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

export async function registerDevice(employeeId, deviceToken, deviceInfo) {
  const { data, error } = await supabase
    .from('device_tokens')
    .insert({
      employee_id: employeeId,
      device_token: deviceToken,
      device_info: deviceInfo,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getDevicesByEmployee(employeeId) {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*')
    .eq('employee_id', employeeId)
    .order('registered_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllDevices() {
  const { data, error } = await supabase
    .from('device_tokens')
    .select('*, employees(name)')
    .order('registered_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function deactivateDevice(id) {
  const { error } = await supabase
    .from('device_tokens')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

export async function verifyEmployeePin(employeeId, pin) {
  const { data, error } = await supabase
    .from('employees')
    .select('id, pin')
    .eq('id', employeeId)
    .eq('pin', pin)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return !!data;
}

// ============================================================
// ATTENDANCE
// ============================================================

export async function checkIn(employeeId, lat, lng, ip) {
  const { data, error } = await supabase
    .from('attendance')
    .insert({
      employee_id: employeeId,
      check_in: new Date().toISOString(),
      check_in_lat: lat,
      check_in_lng: lng,
      check_in_ip: ip,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function checkOut(attendanceId, lat, lng, ip) {
  const checkOutTime = new Date().toISOString();
  const { data, error } = await supabase
    .from('attendance')
    .update({
      check_out: checkOutTime,
      check_out_lat: lat,
      check_out_lng: lng,
      check_out_ip: ip,
    })
    .eq('id', attendanceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActiveAttendance(employeeId) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .is('check_out', null)
    .order('check_in', { ascending: false })
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getAttendanceByDate(startDate, endDate, employeeId = null) {
  let query = supabase
    .from('attendance')
    .select('*, employees(name)')
    .gte('check_in', startDate)
    .lte('check_in', endDate)
    .order('check_in', { ascending: false });

  if (employeeId) {
    query = query.eq('employee_id', employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTodayAttendance() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getAttendanceByDate(today.toISOString(), tomorrow.toISOString());
}

export async function updateAttendance(id, updates) {
  const { data, error } = await supabase
    .from('attendance')
    .update({ ...updates, is_edited: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createManualAttendance(record) {
  const { data, error } = await supabase
    .from('attendance')
    .insert({ ...record, is_edited: true, note: record.note || 'Thêm thủ công bởi admin' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAttendance(id) {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// SETTINGS
// ============================================================

export async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateSettings(updates) {
  const settings = await getSettings();
  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('id', settings.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// ADMIN AUTH (simple password-based)
// ============================================================

const ADMIN_SESSION_KEY = 'chamcong_admin_session';

export function isAdminLoggedIn() {
  const session = localStorage.getItem(ADMIN_SESSION_KEY);
  if (!session) return false;
  try {
    const { expiry } = JSON.parse(session);
    return new Date(expiry) > new Date();
  } catch {
    return false;
  }
}

export function setAdminSession() {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 8); // 8 hour session
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expiry: expiry.toISOString() }));
}

export function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function verifyAdminPassword(password) {
  const settings = await getSettings();
  return settings.admin_password === password;
}
