import { NextResponse } from "next/server";
import services from "./services.json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(services);
}
