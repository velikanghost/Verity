import { ImageResponse } from "next/og"

export const size = {
  width: 64,
  height: 64,
}

export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "transparent",
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
          borderRadius: 22,
          color: "#121212",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          fontSize: 36,
          fontWeight: 700,
          height: 56,
          justifyContent: "center",
          letterSpacing: -2,
          lineHeight: 1,
          width: 56,
        }}
      >
        V
      </div>
    </div>,
    { ...size },
  )
}
