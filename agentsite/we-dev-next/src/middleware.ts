import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { verifyToken } from "./utils/auth";
import { Messages } from "./app/api/chat/action";
import { createI18nMiddleware } from "fumadocs-core/i18n";
import { i18n } from "@/lib/i18n";
import acceptLanguage from "accept-language";
import { locales, Language } from "./utils/lang";

acceptLanguage.languages(locales);

const DEFAULT_LANG = Language.English;
const DYNAMIC_LANG_COOKIE = "lang";

const PUBLIC_PATHS = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/github",
  "/api/auth/wechat",
  "/api/auth/github/callback",
  "/api/auth/register",
  "/api/auth/oauth",
  "/api/d2c",
  "/api/upload",
  "/api/chat",
  "/api/image",
  "/api/model",
  "/api/appInfo",
  "/api/exec",
  "/api/projects",
  "/api/preview",
  "/api/project-preview",
  "/api/quality",
  "/api/quality-jobs",
  "/api/workflow-jobs",
  "/api/publish",
  "/api/published",
  "/api/generate-image",
  "/wedev",
] as const;

const ALLOWED_ORIGINS = [
  "https://dv-cnc.ru",
  "https://www.dv-cnc.ru",
  "http://64.188.115.45:5173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

const CORS_HEADERS_BASE = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PATCH,DELETE,PUT",
  "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  "Access-Control-Allow-Credentials": "true",
} as const;

const addCorsHeaders = (response: NextResponse, request?: NextRequest): NextResponse => {
  const origin = request?.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin as any)
    ? origin
    : origin
      ? ""
      : ALLOWED_ORIGINS[0];
  if (allowed) response.headers.set("Access-Control-Allow-Origin", allowed);
  if (origin) response.headers.append("Vary", "Origin");
  for (const [k, v] of Object.entries(CORS_HEADERS_BASE)) response.headers.set(k, v);
  return response;
};

const createErrorResponse = (message: string, status: number): NextResponse => {
  return addCorsHeaders(
    new NextResponse(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
};

const i18nMiddleware = createI18nMiddleware(i18n);

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname, searchParams } = request.nextUrl;

  if (request.method === "OPTIONS") {
    return addCorsHeaders(new NextResponse(null, { status: 200 }), request);
  }

  if (pathname.startsWith("/api/")) {
    let token = request.headers.get("Authorization")?.split(" ")[1];

    if (!token) {
      const cookieToken = request.cookies.get("token")?.value;
      if (cookieToken) {
        token = cookieToken;
      }
    }

    if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
      if (token) {
        try {
          const decoded = await verifyToken(token);
          const requestHeaders = new Headers(request.headers);
          requestHeaders.set("userId", decoded.userId);
          return addCorsHeaders(NextResponse.next({ headers: requestHeaders }), request);
        } catch {}
      }
      return addCorsHeaders(NextResponse.next(), request);
    }

    if (!token) {
      return createErrorResponse("Authentication required", 401);
    }

    try {
      const decoded = await verifyToken(token);
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("userId", decoded.userId);
      return addCorsHeaders(NextResponse.next({ headers: requestHeaders }), request);
    } catch (error) {
      console.error("Token verification failed:", error);
      return createErrorResponse("Invalid token", 401);
    }
  }

  if (pathname.startsWith("/wedev")) {
    const response = NextResponse.rewrite(
      new URL("/wedev_public/index.html", request.url)
    );
    addCorsHeaders(response);
    response.headers.set("Cross-Origin-Embedder-Policy", "credentialless");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    return response;
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/projects";
    return NextResponse.redirect(url);
  }

  if (pathname === "/projects" || pathname === "/projects/") {
    return addCorsHeaders(NextResponse.next(), request);
  }

  return i18nMiddleware(request, event);
}




