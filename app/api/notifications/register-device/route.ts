import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/rbac';

/**
 * POST /api/notifications/register-device
 * Register device push token for push notifications
 */
export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { expoPushToken, deviceId, platform } = body;
    const userId = auth.tokenUser.userId;

    if (!expoPushToken) {
      return NextResponse.json({ success: false, message: 'expoPushToken is required' }, { status: 400 });
    }

    // Validate Expo push token format
    const { Expo } = require('expo-server-sdk');
    if (!Expo.isExpoPushToken(expoPushToken)) {
      return NextResponse.json({ success: false, message: 'Invalid Expo push token format' }, { status: 400 });
    }

    // Upsert device token (create if doesn't exist, update if exists)
    await prisma.deviceToken.upsert({
      where: {
        userId_expoPushToken: {
          userId,
          expoPushToken,
        },
      },
      create: {
        userId,
        expoPushToken,
        deviceId: deviceId || null,
        platform: platform || null,
        isActive: true,
      },
      update: {
        isActive: true,
        deviceId: deviceId || undefined,
        platform: platform || undefined,
      },
    });

    console.log(`Device token registered for user ${userId}: ${expoPushToken.substring(0, 20)}...`);

    return NextResponse.json({ success: true, message: 'Device registered successfully' });
  } catch (error) {
    console.error('Device registration error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

