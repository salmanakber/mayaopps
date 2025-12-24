import { db } from "@/lib/db"
import { verify } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const user = await verify(request)

    if (!["Owner", "Company Admin", "Manager"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    const result = await db.query(
      `SELECT id, user_id, title, message, type, status, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId || user.id, limit],
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch notifications" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verify(request)

    if (!["Owner", "Company Admin", "Manager"].includes(user.role)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 })
    }

    const { userId, title, message, type } = await request.json()

    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, status, created_at)
       VALUES ($1, $2, $3, $4, 'unread', NOW())
       RETURNING *`,
      [userId, title, message, type],
    )

    // TODO: Send email notification based on user preferences
    // TODO: Trigger webhook for external notification services

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error("Error creating notification:", error)
    return NextResponse.json({ success: false, error: "Failed to create notification" }, { status: 500 })
  }
}
