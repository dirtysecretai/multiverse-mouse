import { NextResponse } from 'next/server';

// This endpoint automatically detects the environment:
// - Local: Uses file system
// - Vercel: Uses Vercel Blob

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log('Upload request received:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images allowed.' }, { status: 400 });
    }

    // Validate file size (max 50MB - increased from 10MB)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Max ${MAX_SIZE / (1024 * 1024)}MB.`,
        details: `Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`
      }, { status: 400 });
    }

    // Check if we're on Vercel (has BLOB_READ_WRITE_TOKEN)
    const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;
    console.log('Environment:', isVercel ? 'Vercel (Blob)' : 'Local (File System)');

    if (isVercel) {
      // VERCEL: Use Vercel Blob Storage
      console.log('Using Vercel Blob storage...');
      
      const { put } = await import('@vercel/blob');
      
      const blob = await put(file.name, file, {
        access: 'public',
      });

      console.log('Blob upload successful:', blob.url);

      return NextResponse.json({ 
        success: true, 
        imageUrl: blob.url,
        filename: file.name,
        storage: 'vercel-blob'
      });

    } else {
      // LOCAL: Use file system
      console.log('Using local file system...');
      
      const { writeFile, mkdir } = await import('fs/promises');
      const { join } = await import('path');
      const { existsSync } = await import('fs');

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create uploads directory if it doesn't exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'galleries');
      
      if (!existsSync(uploadsDir)) {
        console.log('Creating uploads directory...');
        await mkdir(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}-${originalName}`;
      const filepath = join(uploadsDir, filename);

      console.log('Writing to:', filepath);

      // Write file
      await writeFile(filepath, buffer);

      console.log('File written successfully!');

      // Return URL path (relative to public/)
      const imageUrl = `/uploads/galleries/${filename}`;

      return NextResponse.json({ 
        success: true, 
        imageUrl,
        filename,
        storage: 'local-filesystem'
      });
    }

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

// DELETE endpoint to remove uploaded images
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('imageUrl');
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'No imageUrl provided' }, { status: 400 });
    }

    console.log('Delete request for:', imageUrl);

    // Check if we're on Vercel
    const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;

    if (isVercel && imageUrl.includes('vercel-storage.com')) {
      // VERCEL: Delete from Blob storage
      const { del } = await import('@vercel/blob');
      await del(imageUrl);
      console.log('Blob deleted successfully');

      return NextResponse.json({ success: true, storage: 'vercel-blob' });

    } else {
      // LOCAL: Delete from file system
      const { unlink } = await import('fs/promises');
      const { join } = await import('path');

      // Extract filename from URL
      const filename = imageUrl.split('/').pop();
      if (!filename) {
        return NextResponse.json({ error: 'Invalid imageUrl' }, { status: 400 });
      }

      const filepath = join(process.cwd(), 'public', 'uploads', 'galleries', filename);
      
      await unlink(filepath);
      console.log('File deleted successfully');

      return NextResponse.json({ success: true, storage: 'local-filesystem' });
    }

  } catch (error: any) {
    console.error('Delete error:', error);
    return NextResponse.json({ 
      error: 'Delete failed', 
      details: error.message 
    }, { status: 500 });
  }
}

