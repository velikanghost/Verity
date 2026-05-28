"use client"

import { useEffect, useRef } from "react"
import { io, Socket } from "socket.io-client"
import { useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5050/api"
const SOCKET_URL = API_BASE_URL.replace(/\/api$/, "") + "/socket"

let socketInstance: Socket | null = null

const getSocket = (): Socket => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ["websocket"],
      autoConnect: false,
    })
  }
  return socketInstance
}

export function useSocket() {
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const socket = getSocket()
    socketRef.current = socket

    if (!socket.connected) {
      socket.connect()
    }

    // Set up global event listeners
    const handleFeedUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["feed"] })
    }

    const handlePostUpdated = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["feed"] })
      if (data?.postId) {
        queryClient.invalidateQueries({ queryKey: ["post", data.postId] })
        queryClient.invalidateQueries({ queryKey: ["comments", data.postId] })
      }
    }

    const handleMarketUpdated = (data: any) => {
      if (data?.marketId) {
        queryClient.invalidateQueries({ queryKey: ["market-detail", data.marketId] })
        queryClient.invalidateQueries({ queryKey: ["pool-state", data.marketId] })
        queryClient.invalidateQueries({ queryKey: ["market-positions", data.marketId] })
      }
    }

    const handleNotificationCreated = (notification: any) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
      // Play a subtle sound or trigger toast
      toast(notification.body, {
        icon: "🔔",
        duration: 4000,
        style: {
          background: "#1E1E24",
          color: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.08)",
        },
      })
    }

    const handleUserUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] })
      queryClient.invalidateQueries({ queryKey: ["wallet-profile"] })
      queryClient.invalidateQueries({ queryKey: ["user-positions"] })
    }

    socket.on("feed-updated", handleFeedUpdated)
    socket.on("post-updated", handlePostUpdated)
    socket.on("market-updated", handleMarketUpdated)
    socket.on("notification-created", handleNotificationCreated)
    socket.on("user-updated", handleUserUpdated)

    return () => {
      socket.off("feed-updated", handleFeedUpdated)
      socket.off("post-updated", handlePostUpdated)
      socket.off("market-updated", handleMarketUpdated)
      socket.off("notification-created", handleNotificationCreated)
      socket.off("user-updated", handleUserUpdated)
    }
  }, [queryClient])

  const joinRoom = (roomName: string) => {
    const socket = getSocket()
    if (socket) {
      if (!socket.connected) {
        socket.connect()
      }
      socket.emit("join-room", roomName)
    }
  }

  const leaveRoom = (roomName: string) => {
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit("leave-room", roomName)
    }
  }

  return {
    socket: socketRef.current,
    joinRoom,
    leaveRoom,
  }
}
