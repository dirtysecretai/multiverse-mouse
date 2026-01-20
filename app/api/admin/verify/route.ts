import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}