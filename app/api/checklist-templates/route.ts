import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/rbac';
import { UserRole } from '@prisma/client';

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { tokenUser } = auth;

  try {
    const where: any = {};
    
    if (![UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.DEVELOPER].includes(tokenUser.role as UserRole)) {
      where.companyId = tokenUser.companyId;
    }

    const templates = await prisma.checklistTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: { templates } });
  } catch (error) {
    console.error('Checklist templates GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  const { tokenUser } = auth;
  const role = tokenUser.role as UserRole;

  if (![UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.DEVELOPER, UserRole.COMPANY_ADMIN, UserRole.MANAGER].includes(role)) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, description, items, isDefault } = body;

    if (!name || !items) {
      return NextResponse.json({ success: false, message: 'Name and items are required' }, { status: 400 });
    }

    const companyId = tokenUser.companyId!;
    
    // If setting as default, unset other defaults for the company
    if (isDefault) {
      await prisma.checklistTemplate.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        companyId,
        name,
        description: description || undefined,
        items: typeof items === 'string' ? items : JSON.stringify(items),
        isDefault: isDefault || false,
      },
    });

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (error) {
    console.error('Checklist templates POST error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
