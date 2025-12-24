import { db } from "@/lib/db"
import { verify } from "@/lib/auth"
import { type NextRequest, NextResponse } from "next/server"

interface CoordinatePair {
  lat: number
  lng: number
}

function calculateDistance(coord1: CoordinatePair, coord2: CoordinatePair): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180
  const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c * 1000 // Convert to meters
}

export async function POST(request: NextRequest) {
  try {
    const user = await verify(request)

    const { taskId, cleanerLat, cleanerLng, companyId } = await request.json()

    // Get task location
    const taskResult = await db.query(
      `SELECT p.latitude, p.longitude FROM tasks t
       JOIN properties p ON t.property_id = p.id
       WHERE t.id = $1`,
      [taskId],
    )

    if (taskResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 })
    }

    // Get geofence radius from config
    const configResult = await db.query(`SELECT geofence_radius FROM admin_configurations WHERE company_id = $1`, [
      companyId,
    ])

    const geofenceRadius = configResult.rows[0]?.geofence_radius || 150

    const taskLocation: CoordinatePair = {
      lat: taskResult.rows[0].latitude,
      lng: taskResult.rows[0].longitude,
    }
    const cleanerLocation: CoordinatePair = { lat: cleanerLat, lng: cleanerLng }

    const distance = calculateDistance(taskLocation, cleanerLocation)
    const isWithinGeofence = distance <= geofenceRadius

    // Log location check
    await db.query(
      `INSERT INTO location_logs (task_id, user_id, latitude, longitude, distance_from_property, within_geofence, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [taskId, user.id, cleanerLng, cleanerLat, distance, isWithinGeofence],
    )

    return NextResponse.json({
      success: true,
      isWithinGeofence,
      distance,
      geofenceRadius,
    })
  } catch (error) {
    console.error("Error checking geolocation:", error)
    return NextResponse.json({ success: false, error: "Failed to check geolocation" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verify(request)
    const searchParams = request.nextUrl.searchParams
    const taskId = searchParams.get("taskId")

    const result = await db.query(
      `SELECT id, task_id, user_id, latitude, longitude, distance_from_property, within_geofence, created_at
       FROM location_logs
       WHERE task_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [taskId],
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error("Error fetching location logs:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch location logs" }, { status: 500 })
  }
}
