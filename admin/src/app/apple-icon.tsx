import { ImageResponse } from "next/og"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#fbfaf9",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#ffbb26",
          borderRadius: 58,
          color: "#121212",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          fontSize: 104,
          fontWeight: 700,
          height: 142,
          justifyContent: "center",
          letterSpacing: -6,
          lineHeight: 1,
          width: 142,
        }}
      >
        V
      </div>
    </div>,
    { ...size },
  )
}
