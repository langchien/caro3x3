import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export interface GPSCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface VisitorLogData {
  ip: string;
  city: string;
  region: string;
  country: string;
  userAgent: string;
  path?: string;
  action?: string;
  timestamp: string;
  coords?: GPSCoords;
  realAddress?: string;
  mapsUrl?: string;
}

/**
 * Trích xuất thông tin khách truy cập từ Headers của Vercel
 */
function extractVisitorInfo(request: NextRequest, customAction?: string): VisitorLogData {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";

  const rawCity = request.headers.get("x-vercel-ip-city") || "";
  let city = "Unknown City";
  try {
    city = rawCity ? decodeURIComponent(rawCity) : "Unknown City";
  } catch {
    city = rawCity || "Unknown City";
  }

  const region = request.headers.get("x-vercel-ip-country-region") || "";
  const country = request.headers.get("x-vercel-ip-country") || "Unknown Country";
  const userAgent = request.headers.get("user-agent") || "Unknown Device";
  const path = request.nextUrl.pathname;
  const timestamp = new Date().toISOString();

  return {
    ip,
    city,
    region,
    country,
    userAgent,
    path,
    action: customAction || "api_call",
    timestamp,
  };
}

/**
 * Phân giải toạ độ GPS thành địa chỉ thực tế (Reverse Geocoding)
 * Sử dụng OpenStreetMap Nominatim API (Hoàn toàn miễn phí, hỗ trợ tiếng Việt)
 */
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // Giới hạn 4s tránh treo request

    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "Caro3x3App/1.0 (contact: info@caro3x3.local)",
          "Accept-Language": "vi,en",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return data.display_name || null;
    }
  } catch (error) {
    // Trường hợp mạng chậm, timeout hoặc lỗi kết nối ngoài
    console.warn("[Reverse Geocode] Không thể phân giải toạ độ GPS:", error);
  }
  return null;
}

// Xử lý GET request (ping hoặc test)
export async function GET(request: NextRequest) {
  const data = extractVisitorInfo(request, "page_ping");

  console.log(
    `[VISITOR API] [${data.timestamp}] IP: ${data.ip} | Location: ${data.city}${data.region ? ` (${data.region})` : ""}, ${data.country} | UA: ${data.userAgent}`
  );

  return NextResponse.json({
    status: "ok",
    data,
  });
}

// Xử lý POST request: Nhận toạ độ GPS và ghi log địa chỉ thực tế
export async function POST(request: NextRequest) {
  let bodyAction = "custom_event";
  let coords: GPSCoords | undefined;
  let clientAddress: string | undefined;

  try {
    const body = await request.json();
    if (body) {
      if (typeof body.action === "string") bodyAction = body.action;
      if (body.coords && typeof body.coords.latitude === "number" && typeof body.coords.longitude === "number") {
        coords = {
          latitude: body.coords.latitude,
          longitude: body.coords.longitude,
          accuracy: typeof body.coords.accuracy === "number" ? body.coords.accuracy : undefined,
        };
      }
      if (typeof body.address === "string") {
        clientAddress = body.address;
      }
    }
  } catch {
    // Không có JSON body
  }

  const data = extractVisitorInfo(request, bodyAction);

  // Nếu có toạ độ GPS từ client
  if (coords) {
    data.coords = coords;
    data.mapsUrl = `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;

    // Tìm địa chỉ thực tế từ toạ độ GPS (ưu tiên server reverse geocode, fallback client)
    const resolvedAddress = (await reverseGeocode(coords.latitude, coords.longitude)) || clientAddress || "Không phân giải được địa chỉ chi tiết";
    data.realAddress = resolvedAddress;

    // Ghi log nổi bật ra Console của Vercel / Next.js Server
    console.log(`
====================== 📍 [GPS LOCATION DETECTED] ======================
🕒 Thời gian      : ${data.timestamp}
🌐 IP Client      : ${data.ip} (Vercel IP Geo: ${data.city}, ${data.country})
🛰️ Toạ độ GPS     : ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)} (Sai số: ±${Math.round(coords.accuracy || 0)}m)
🏠 Địa chỉ thực tế: ${resolvedAddress}
🗺️ Google Maps    : ${data.mapsUrl}
📱 Thiết bị       : ${data.userAgent}
========================================================================
`);
  } else {
    // Log sự kiện thông thường không có GPS
    console.log(
      `[VISITOR EVENT] [${data.timestamp}] IP: ${data.ip} | Location: ${data.city}, ${data.country} | Action: ${data.action}`
    );
  }

  return NextResponse.json({
    status: "ok",
    data,
  });
}
