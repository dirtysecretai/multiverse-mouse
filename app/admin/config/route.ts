import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET current settings
export async function GET() {
  try {
    const state = await prisma.systemState.findUnique({ where: { id: 1 } });
    // Default to closed if not found
    return NextResponse.json(state || { isShopOpen: false, isMaintenanceMode: false });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// UPDATE settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updatedState = await prisma.systemState.upsert({
      where: { id: 1 },
      update: {
        isShopOpen: body.isShopOpen,
        isMaintenanceMode: body.isMaintenanceMode,
      },
      create: {
        id: 1,
        isShopOpen: body.isShopOpen,
        isMaintenanceMode: body.isMaintenanceMode,
      },
    });
    return NextResponse.json(updatedState);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}