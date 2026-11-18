import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Lấy IP từ header x-forwarded-for (Vercel cung cấp, IP đầu tiên là của client)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : realIp || "127.0.0.1";

  // Lấy thông tin vị trí địa lý do Vercel tự động cung cấp
  const rawCity = request.headers.get("x-vercel-ip-city") || "";
  let city = "Unknown City";
  try {
    city = rawCity ? decodeURIComponent(rawCity) : "Unknown City";
  } catch {
    city = rawCity || "Unknown City";
  }

  const country = request.headers.get("x-vercel-ip-country") || "Unknown Country";
  const region = request.headers.get("x-vercel-ip-country-region") || "";
  const userAgent = request.headers.get("user-agent") || "Unknown Device";
  const path = request.nextUrl.pathname;
  const timestamp = new Date().toISOString();

  // In log ra console (hiển thị trực tiếp trong tab Logs của Vercel Dashboard)
  console.log(
    `[VISITOR] [${timestamp}] IP: ${clientIp} | Location: ${city}${region ? ` (${region})` : ""}, ${country} | Path: ${path} | UA: ${userAgent}`
  );

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Khớp tất cả request ngoại trừ static assets để tránh spam log:
     * - _next/static (tập tin tĩnh)
     * - _next/image (tối ưu hóa hình ảnh)
     * - favicon.ico, hình ảnh (.svg, .png, .jpg, .ico,...)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
