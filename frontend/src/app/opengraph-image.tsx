import { ImageResponse } from 'next/og'

export const alt = 'Verity social prediction markets preview'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#fbfaf9',
          color: '#121212',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Arial, sans-serif',
          height: '100%',
          justifyContent: 'space-between',
          overflow: 'hidden',
          padding: 64,
          position: 'relative',
          width: '100%',
        }}
      >
        <Blob color="#ff3e00" left={78} top={86} rotate="-8deg" />
        <Blob color="#00ca48" left={990} top={94} rotate="9deg" />
        <Blob color="#0090ff" left={870} top={456} rotate="-12deg" />
        <Coin left={948} top={298} />
        <Star left={142} top={420} />

        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 18,
          }}
        >
          <div
            style={{
              alignItems: 'center',
              background: '#ffbb26',
              borderRadius: 24,
              color: '#121212',
              display: 'flex',
              fontSize: 44,
              fontWeight: 700,
              height: 72,
              justifyContent: 'center',
              letterSpacing: -3,
              width: 72,
            }}
          >
            V
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                color: '#343433',
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -1.2,
              }}
            >
              Verity
            </div>
            <div
              style={{
                color: '#848281',
                fontSize: 20,
                letterSpacing: -0.2,
              }}
            >
              Opinions backed by conviction
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 820,
          }}
        >
          <h1
            style={{
              color: '#121212',
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: -4.4,
              lineHeight: 0.95,
              margin: 0,
            }}
          >
            Social posts that can become real markets.
          </h1>
          <p
            style={{
              color: '#474645',
              fontSize: 30,
              letterSpacing: -0.8,
              lineHeight: 1.25,
              margin: '28px 0 0',
              maxWidth: 720,
            }}
          >
            Upvote, Downvote, fund pools, provide liquidity, and trade outcomes with Arc testnet USDC.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
          }}
        >
          <Pill color="#121212" text="Launch pools" textColor="#ffffff" />
          <Pill color="#f2f0ed" text="Upvote / Downvote" textColor="#343433" />
          <Pill color="#f2f0ed" text="USDC markets" textColor="#343433" />
        </div>
      </div>
    ),
    { ...size },
  )
}

function Pill({
  color,
  text,
  textColor,
}: {
  color: string
  text: string
  textColor: string
}) {
  return (
    <div
      style={{
        background: color,
        borderRadius: 999,
        color: textColor,
        display: 'flex',
        fontSize: 22,
        fontWeight: 700,
        letterSpacing: -0.4,
        padding: '16px 24px',
      }}
    >
      {text}
    </div>
  )
}

function Blob({
  color,
  left,
  rotate,
  top,
}: {
  color: string
  left: number
  rotate: string
  top: number
}) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: color,
        borderRadius: '48% 58% 45% 62%',
        display: 'flex',
        height: 126,
        justifyContent: 'center',
        left,
        position: 'absolute',
        top,
        transform: `rotate(${rotate})`,
        width: 126,
      }}
    >
      <div
        style={{
          background: '#121212',
          borderRadius: 999,
          height: 12,
          marginRight: 18,
          width: 12,
        }}
      />
      <div
        style={{
          background: '#121212',
          borderRadius: 999,
          height: 12,
          width: 12,
        }}
      />
    </div>
  )
}

function Coin({ left, top }: { left: number; top: number }) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: '#ffbb26',
        border: '8px solid #d48f00',
        borderRadius: 999,
        color: '#121212',
        display: 'flex',
        fontSize: 52,
        fontWeight: 700,
        height: 112,
        justifyContent: 'center',
        left,
        position: 'absolute',
        top,
        width: 112,
      }}
    >
      $
    </div>
  )
}

function Star({ left, top }: { left: number; top: number }) {
  return (
    <div
      style={{
        color: '#ffbb26',
        fontSize: 96,
        fontWeight: 700,
        left,
        lineHeight: 1,
        position: 'absolute',
        top,
      }}
    >
      *
    </div>
  )
}
