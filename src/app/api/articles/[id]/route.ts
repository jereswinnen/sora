import { NextRequest, NextResponse } from "next/server";

// TODO: Import convex client

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // TODO: Implement GET handler for single article
  return NextResponse.json({ message: `Get article ${params.id}` });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // TODO: Implement DELETE handler for articles
  return NextResponse.json({ message: `Delete article ${params.id}` });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // TODO: Implement PATCH handler for adding tags
  return NextResponse.json({ message: `Update article ${params.id}` });
}
