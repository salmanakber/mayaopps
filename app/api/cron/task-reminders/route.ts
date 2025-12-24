import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendTaskReminderNotification } from "@/lib/notifications"
import { sendEmail } from "@/lib/email"

// GET /api/cron/task-reminders
// Cron job to send 24h and 1h reminders before tasks
// Should be called every hour via Vercel Cron or similar
export async function GET(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Find tasks scheduled in 1 hour
    const oneHourTasks = await prisma.task.findMany({
      where: {
        scheduledDate: {
          gte: now,
          lte: oneHourLater,
        },
        status: {
          in: ["ASSIGNED", "PLANNED"],
        },
        assignedUserId: { not: null },
      },
      include: {
        assignedUser: true,
        property: true,
      },
    })

    // Find tasks scheduled in 24 hours
    const twentyFourHourTasks = await prisma.task.findMany({
      where: {
        scheduledDate: {
          gte: now,
          lte: twentyFourHoursLater,
        },
        status: {
          in: ["ASSIGNED", "PLANNED"],
        },
        assignedUserId: { not: null },
      },
      include: {
        assignedUser: true,
        property: true,
      },
    })

    const results = {
      oneHourReminders: [] as any[],
      twentyFourHourReminders: [] as any[],
      errors: [] as string[],
    }

    // Send 1-hour reminders
    for (const task of oneHourTasks) {
      if (!task.assignedUser || !task.scheduledDate) continue

      const hoursUntil = Math.round((task.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60))
      
      // Only send if within 1-2 hour window (to avoid duplicates)
      if (hoursUntil >= 0.5 && hoursUntil <= 1.5) {
        try {
          await sendTaskReminderNotification(task.id, 1)
          
          // Also send email
          if (task.assignedUser.email) {
            await sendEmail({
              to: task.assignedUser.email,
              subject: `Task Reminder - 1 Hour: ${task.title}`,
              html: `
                <h2>Task Reminder - 1 Hour</h2>
                <p>You have a task scheduled in approximately 1 hour:</p>
                <ul>
                  <li><strong>Task:</strong> ${task.title}</li>
                  <li><strong>Property:</strong> ${task.property?.address || "N/A"}</li>
                  <li><strong>Scheduled:</strong> ${task.scheduledDate.toLocaleString()}</li>
                </ul>
              `,
            })
          }

          results.oneHourReminders.push({ taskId: task.id, userId: task.assignedUser.id })
        } catch (error) {
          results.errors.push(`Failed to send 1h reminder for task ${task.id}: ${error}`)
        }
      }
    }

    // Send 24-hour reminders
    for (const task of twentyFourHourTasks) {
      if (!task.assignedUser || !task.scheduledDate) continue

      const hoursUntil = Math.round((task.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60))
      
      // Only send if within 23-25 hour window (to avoid duplicates)
      if (hoursUntil >= 23 && hoursUntil <= 25) {
        try {
          await sendTaskReminderNotification(task.id, 24)
          
          // Also send email
          if (task.assignedUser.email) {
            await sendEmail({
              to: task.assignedUser.email,
              subject: `Task Reminder - 24 Hours: ${task.title}`,
              html: `
                <h2>Task Reminder - 24 Hours</h2>
                <p>You have a task scheduled tomorrow:</p>
                <ul>
                  <li><strong>Task:</strong> ${task.title}</li>
                  <li><strong>Property:</strong> ${task.property?.address || "N/A"}</li>
                  <li><strong>Scheduled:</strong> ${task.scheduledDate.toLocaleString()}</li>
                </ul>
              `,
            })
          }

          results.twentyFourHourReminders.push({ taskId: task.id, userId: task.assignedUser.id })
        } catch (error) {
          results.errors.push(`Failed to send 24h reminder for task ${task.id}: ${error}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        summary: {
          oneHourCount: results.oneHourReminders.length,
          twentyFourHourCount: results.twentyFourHourReminders.length,
          errorCount: results.errors.length,
        },
      },
    })
  } catch (error) {
    console.error("Task reminders cron error:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}



