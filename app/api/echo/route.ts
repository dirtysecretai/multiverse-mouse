import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    console.log('Echo POST received:', { 
      name: body.name, 
      messageLength: body.message?.length,
      imageCount: body.images?.length || 0
    });
    
    // Upload images to Vercel Blob if provided
    const imageUrls: string[] = [];
    if (body.images && Array.isArray(body.images) && body.images.length > 0) {
      console.log('Uploading', body.images.length, 'images to blob storage...');
      
      for (let i = 0; i < body.images.length; i++) {
        const base64Data = body.images[i];
        const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
        
        if (matches) {
          const extension = matches[1];
          const base64Content = matches[2];
          const buffer = Buffer.from(base64Content, 'base64');
          
          const filename = `echo-${Date.now()}-${i}.${extension}`;
          const blob = await put(filename, buffer, {
            access: 'public',
            contentType: `image/${extension}`
          });
          
          imageUrls.push(blob.url);
          console.log(`Image ${i + 1} uploaded:`, blob.url);
        }
      }
    }
    
    const newMessage = await prisma.echoMessage.create({
      data: {
        name: body.name || "Anonymous",
        message: body.message,
        visibleName: body.visibleName || false,
        imageUrls: imageUrls,
      },
    });
    
    console.log('Echo message saved:', newMessage.id, 'with', imageUrls.length, 'images');
    return NextResponse.json(newMessage);
  } catch (error) {
    console.error('Echo POST error:', error);
    return NextResponse.json({ 
      error: 'Failed to send message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    const messages = await prisma.echoMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        message: true,
        visibleName: true,
        name: true,
        imageUrls: true,
        createdAt: true,
      }
    });
    
    console.log('Echo GET: returning', messages.length, 'messages')
    return NextResponse.json(messages);
  } catch (error) {
    console.error('Echo GET error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch messages',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}