import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { siteConfig } from "./site-config";

const [brandMark, brandLogo] = await Promise.all([
  readFile(join(process.cwd(), "docs/assets/imgs/mark-color.svg")),
  readFile(join(process.cwd(), "docs/assets/imgs/logo-light.svg")),
]);
const brandMarkDataUrl = `data:image/svg+xml;base64,${brandMark.toString("base64")}`;
const brandLogoDataUrl = `data:image/svg+xml;base64,${brandLogo.toString("base64")}`;

export const socialImageAlt =
  "agentdesktop: open-source control plane for AI developer tools";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export const socialImageContentType = "image/png";

function Device({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: 190,
        padding: "16px 18px",
        color: "#d8dbea",
        background: "#24293b",
        border: "1px solid #4a5068",
        borderRadius: 6,
        fontSize: 20,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          marginRight: 12,
          background: "#8a3ffc",
        }}
      />
      {label}
    </div>
  );
}

export function createSocialImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 62,
        color: "#151927",
        background: "#f6f7fb",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: "53%",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingRight: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 28 }}>
          {/* ImageResponse renders embedded SVG data URLs through native images. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brandMarkDataUrl}
            width={62}
            height={62}
            alt=""
            style={{
              marginRight: 16,
            }}
          />
          <strong>{siteConfig.name}</strong>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              maxWidth: 560,
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.02,
            }}
          >
            Open-source control plane for AI developer tools.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              color: "#4a5068",
              fontSize: 25,
              lineHeight: 1.35,
            }}
          >
            See installed tools and apply managed configuration across your
            fleet. Connect each device to your inference gateway.
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: "47%",
          alignItems: "center",
          justifyContent: "center",
          padding: 36,
          color: "#f6f7fb",
          background: "#0b0e18",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Device label="Claude Code · installed" />
          <Device label="Codex · installed" />
          <Device label="OpenCode · installed" />
        </div>
        <div
          style={{
            display: "flex",
            width: 42,
            height: 2,
            background: "#8a3ffc",
          }}
        />
        <div
          style={{
            display: "flex",
            width: 205,
            minHeight: 240,
            flexDirection: "column",
            justifyContent: "center",
            padding: 24,
            background: "#20263a",
            border: "2px solid #8a3ffc",
            borderRadius: 6,
          }}
        >
          <div style={{ display: "flex", color: "#b997ff", fontSize: 18 }}>
            DISCOVERY + CONFIG
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brandLogoDataUrl}
            width={157}
            height={41}
            alt="agentdesktop"
            style={{ marginTop: 12 }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              marginTop: 22,
              color: "#c8cce0",
              fontSize: 18,
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: "flex" }}>Tools + versions</div>
            <div style={{ display: "flex" }}>MCP + skills</div>
            <div style={{ display: "flex" }}>Managed settings</div>
          </div>
        </div>
      </div>
    </div>,
    socialImageSize,
  );
}