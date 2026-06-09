-- ============================================================
-- Seed Data - Dữ liệu mẫu ban đầu
-- Chạy script này trong SQL Editor của Supabase sau khi chạy schema.sql
-- ============================================================

-- 1. Đăng ký một vài nhân viên mẫu để test
-- Mỗi nhân viên có một mã PIN riêng để đăng ký thiết bị lần đầu
INSERT INTO public.employees (name, pin, phone, salary_type, salary_rate, is_active)
VALUES 
  (N'Nguyễn Văn A', '1234', '0912345678', 'hourly', 30000, true),
  (N'Trần Thị B', '5678', '0987654321', 'hourly', 35000, true),
  (N'Lê Văn C', '0000', '0905111222', 'monthly', 6500000, true)
ON CONFLICT DO NOTHING;

-- 2. Cài đặt quán mặc định và mật khẩu quản trị viên
-- Mật khẩu mặc định: admin123
-- Tọa độ mặc định: 21.0285, 105.8542 (Hồ Hoàn Kiếm, Hà Nội) - Hãy cập nhật lại trong trang Cài đặt
INSERT INTO public.settings (shop_name, shop_lat, shop_lng, allowed_radius, allowed_ips, admin_password)
VALUES 
  (N'Quán Cà Phê Của Tôi', 21.028511, 105.854224, 200, '{}', 'admin123')
ON CONFLICT (id) DO UPDATE 
SET 
  shop_name = EXCLUDED.shop_name,
  shop_lat = EXCLUDED.shop_lat,
  shop_lng = EXCLUDED.shop_lng,
  allowed_radius = EXCLUDED.allowed_radius,
  admin_password = EXCLUDED.admin_password;

-- 3. Tạo một vài dữ liệu chấm công mẫu trong quá khứ (để test thống kê và tính lương)
-- Đoạn SQL này chèn chấm công cho 3 ngày trước của Nguyễn Văn A
DO $$
DECLARE
  emp_a_id UUID;
  emp_b_id UUID;
BEGIN
  -- Lấy ID của Nguyễn Văn A
  SELECT id INTO emp_a_id FROM public.employees WHERE name = N'Nguyễn Văn A' LIMIT 1;
  -- Lấy ID của Trần Thị B
  SELECT id INTO emp_b_id FROM public.employees WHERE name = N'Trần Thị B' LIMIT 1;

  IF emp_a_id IS NOT NULL THEN
    -- Ngày hôm kia: làm 8 tiếng (8h - 16h)
    INSERT INTO public.attendance (employee_id, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, note)
    VALUES (
      emp_a_id,
      NOW() - INTERVAL '2 days' - INTERVAL '4 hours', -- check-in lúc 8h sáng
      NOW() - INTERVAL '2 days' + INTERVAL '4 hours', -- check-out lúc 16h
      21.0285, 105.8542,
      21.0285, 105.8542,
      N'Chấm công mẫu ngày hôm kia'
    );

    -- Ngày hôm qua: làm 7.5 tiếng (8h30 - 16h)
    INSERT INTO public.attendance (employee_id, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, note)
    VALUES (
      emp_a_id,
      NOW() - INTERVAL '1 day' - INTERVAL '3 hours 30 minutes',
      NOW() - INTERVAL '1 day' + INTERVAL '4 hours',
      21.0285, 105.8542,
      21.0285, 105.8542,
      N'Chấm công mẫu ngày hôm qua'
    );
  END IF;

  IF emp_b_id IS NOT NULL THEN
    -- Trần Thị B làm ngày hôm qua: 9 tiếng (9h - 18h)
    INSERT INTO public.attendance (employee_id, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, note)
    VALUES (
      emp_b_id,
      NOW() - INTERVAL '1 day' - INTERVAL '3 hours',
      NOW() - INTERVAL '1 day' + INTERVAL '6 hours',
      21.0285, 105.8542,
      21.0285, 105.8542,
      N'Bản ghi mẫu NV B'
    );
  END IF;
END $$;
