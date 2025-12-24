import { Expo } from 'expo-server-sdk';
import prisma from './prisma';

const expo = new Expo();

export interface ExpoPushMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: any;
  badge?: number;
}

/**
 * Send Expo push notification to a user
 */
export async function sendExpoPushNotification(
  userId: number,
  title: string,
  body: string,
  data?: any
): Promise<boolean> {
  try {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      console.warn(`User ${userId} not found for push notification`);
      return false;
    }

    // Get active device tokens for this user
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        expoPushToken: true,
      },
    });

    if (deviceTokens.length === 0) {
      console.log(`No active device tokens found for user ${userId}`);
      return false;
    }

    // Check user preferences for push notifications
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
      select: { pushNotifications: true },
    });

    if (preferences && !preferences.pushNotifications) {
      console.log(`Push notifications disabled for user ${userId}`);
      return false;
    }

    // Prepare messages for all device tokens
    const messages = deviceTokens
      .filter(dt => Expo.isExpoPushToken(dt.expoPushToken))
      .map(dt => ({
        to: dt.expoPushToken,
        sound: 'default' as const,
        title,
        body,
        data: data || {},
        badge: 1,
      }));

    if (messages.length === 0) {
      console.warn(`No valid Expo push tokens for user ${userId}`);
      return false;
    }

    // Send push notifications
    await sendBulkExpoPushNotifications(messages);
    
    console.log(`📱 Push notification sent to ${messages.length} device(s) for user ${userId}: ${title}`);
    
    return true;
  } catch (error) {
    console.error('Error sending Expo push notification:', error);
    return false;
  }
}

/**
 * Send push notifications to multiple users
 */
export async function sendBulkExpoPushNotifications(
  messages: ExpoPushMessage[]
): Promise<void> {
  try {
    // Filter out invalid tokens
    const validMessages = messages.filter(message => 
      Expo.isExpoPushToken(message.to)
    );

    if (validMessages.length === 0) {
      console.warn('No valid Expo push tokens found');
      return;
    }

    // Send in chunks (Expo allows up to 100 messages per request)
    const chunks = expo.chunkPushNotifications(validMessages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    // Check ticket receipts
    const receiptIds = tickets
      .filter(ticket => ticket.status === 'ok' && ticket.id)
      .map(ticket => ticket.id!);

    if (receiptIds.length > 0) {
      const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);
      
      for (const receiptId in receipts) {
        const receipt = receipts[receiptId];
        if (receipt.status === 'error') {
          console.error(`Push notification error for ${receiptId}:`, receipt.message);
        }
      }
    }
  } catch (error) {
    console.error('Error sending bulk Expo push notifications:', error);
  }
}

