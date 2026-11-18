import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export interface VisitorLogData {
  ip: string;
  city: string;
  region: string;
  country: string;
  userAgent: string;
  path?: string;
  action?: string;
  timestamp: string;
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

// Xử lý GET request (ví dụ: client ping để log hoặc kiểm tra)
export async function GET(request: NextRequest) {
  const data = extractVisitorInfo(request, "page_ping");

  // In log đồng bộ định dạng với proxy.ts
  console.log(
    `[VISITOR API] [${data.timestamp}] IP: ${data.ip} | Location: ${data.city}${data.region ? ` (${data.region})` : ""}, ${data.country} | Action: ${data.action} | UA: ${data.userAgent}`
  );

  return NextResponse.json({
    status: "ok",
    data,
  });
}

// Xử lý POST request (cho phép client gửi thêm sự kiện tùy biến: ví dụ kết thúc ván cờ, bắt đầu chơi...)
export async function POST(request: NextRequest) {
  let bodyAction = "custom_event";
  try {
    const body = await request.json();
    if (body && typeof body.action === "string") {
      bodyAction = body.action;
    }
  } catch {
    // Không có body hoặc body không phải JSON
  }

  const data = extractVisitorInfo(request, bodyAction);

  console.log(
    `[VISITOR EVENT] [${data.timestamp}] IP: ${data.ip} | Location: ${data.city}${data.region ? ` (${data.region})` : ""}, ${data.country} | Action: ${data.action}`
  );

  return NextResponse.json({
    status: "ok",
    data,
  });
}
