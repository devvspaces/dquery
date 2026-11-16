import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared 1200×630 social card: logo, headline, subline, optional price badge. */
export function ogCard({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#0d1117",
          backgroundImage: "radial-gradient(circle at 85% 0%, rgba(25,194,160,0.30), rgba(13,17,23,0) 60%)",
          color: "#f3f4f6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 512 512">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#19c2a0" />
                <stop offset="1" stopColor="#0b7a66" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" rx="116" fill="url(#g)" />
            <circle cx="234" cy="234" r="118" fill="none" stroke="#fff" strokeWidth="54" />
            <path d="M318 318 L398 398" stroke="#fff" strokeWidth="58" strokeLinecap="round" />
            <circle cx="234" cy="234" r="36" fill="#fff" />
          </svg>
          <span style={{ fontSize: 40, fontWeight: 700 }}>DQuery</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 30, color: "#9ca3af", maxWidth: 980 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {badge && (
            <div style={{ display: "flex", padding: "12px 24px", borderRadius: 999, background: "rgba(25,194,160,0.16)", color: "#19c2a0", fontSize: 30, fontWeight: 700 }}>
              {badge}
            </div>
          )}
          <div style={{ fontSize: 26, color: "#6b7280" }}>dquery.bytechain.dev</div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
