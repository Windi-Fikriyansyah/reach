import { NextResponse } from "next/server";


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fbId = searchParams.get("fbId");
  const targetUrl = fbId
    ? `https://graph.facebook.com/${fbId}/picture?type=large`
    : searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    if (res.url && res.url.includes("84628273_176159830277856")) {
      return new NextResponse(null, { status: 404 });
    }

    const contentType = res.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await res.arrayBuffer();

    // Placeholder silhouette Facebook Meta default berukuran <= 2500 bytes
    if (arrayBuffer.byteLength <= 2500) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
