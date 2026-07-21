// ============================================================
// Location Utilities - GPS + IP Verification
// ============================================================

/**
 * Haversine formula - tính khoảng cách giữa 2 tọa độ GPS (mét)
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Bán kính Trái Đất (mét)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Lấy vị trí GPS hiện tại
 * @returns {Promise<{lat: number, lng: number}>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ GPS'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Bạn chưa cấp quyền truy cập vị trí. Vui lòng bật GPS và cho phép truy cập.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Không thể xác định vị trí. Vui lòng kiểm tra GPS.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Hết thời gian chờ lấy vị trí. Vui lòng thử lại.'));
            break;
          default:
            reject(new Error('Lỗi không xác định khi lấy vị trí.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache 1 phút
      }
    );
  });
}

export async function getIPInfo() {
  // Danh sách các dịch vụ lấy IP dự phòng
  const providers = [
    {
      url: 'https://api.ipify.org?format=json',
      parse: (data) => ({ ip: data.ip, city: '', country: '' })
    },
    {
      url: 'https://ipapi.co/json/',
      parse: (data) => ({ ip: data.ip, city: data.city || '', country: data.country_name || '' })
    },
    {
      url: 'https://ipinfo.io/json',
      parse: (data) => ({ ip: data.ip, city: data.city || '', country: data.country || '' })
    }
  ];

  for (const provider of providers) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // Giới hạn chờ 4 giây mỗi API

      const response = await fetch(provider.url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const info = provider.parse(data);
        if (info.ip) {
          return info;
        }
      }
    } catch (error) {
      console.warn(`Lấy IP từ ${provider.url} không thành công, đang thử nguồn dự phòng...`, error);
    }
  }

  console.error('Tất cả các nguồn lấy IP đều thất bại.');
  return { ip: 'unknown', city: '', country: '' };
}

/**
 * Kiểm tra vị trí có hợp lệ không
 * @param {number} lat - Vĩ độ hiện tại
 * @param {number} lng - Kinh độ hiện tại
 * @param {number} shopLat - Vĩ độ quán
 * @param {number} shopLng - Kinh độ quán
 * @param {number} allowedRadius - Bán kính cho phép (mét)
 * @returns {{valid: boolean, distance: number}}
 */
export function verifyLocation(lat, lng, shopLat, shopLng, allowedRadius) {
  const distance = calculateDistance(lat, lng, shopLat, shopLng);
  return {
    valid: distance <= allowedRadius,
    distance: Math.round(distance),
  };
}

/**
 * Kiểm tra IP có trong danh sách cho phép không
 */
export function verifyIP(currentIP, allowedIPs) {
  if (!allowedIPs || allowedIPs.length === 0) return true; // Bỏ qua nếu chưa cài đặt
  return allowedIPs.includes(currentIP);
}
