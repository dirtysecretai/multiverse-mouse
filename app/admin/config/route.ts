// src/app/api/admin/config/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Look for the specific row you created in Prisma Studio
    const state = await prisma.systemState.findUnique({ where: { id: 1 } });
    
    // CRUCIAL: Always return a valid object even if the DB is empty
    return NextResponse.json({
      isShopOpen: state?.isShopOpen ?? false,
      isMaintenanceMode: state?.isMaintenanceMode ?? false,
    });
  } catch (error) {
    console.error("GET config error:", error);
    return NextResponse.json({ isShopOpen: false, isMaintenanceMode: false });
  }
}

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
    console.error("POST config error:", error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}