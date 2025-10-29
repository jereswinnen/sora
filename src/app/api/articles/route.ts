import { NextRequest, NextResponse } from "next/server";

// TODO: Import convex client and validation schemas

export async function GET(request: NextRequest) {
  // TODO: Implement GET handler for listing articles
  return NextResponse.json({ message: "List articles" });
}

export async function POST(request: NextRequest) {
  // TODO: Implement POST handler for saving articles
  return NextResponse.json({ message: "Save article" }, { status: 201 });
}
