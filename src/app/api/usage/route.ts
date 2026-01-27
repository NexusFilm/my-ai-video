import { NextRequest } from "next/server";
import { getCurrentUsage } from "@/lib/token-tracker";

export async function GET(request: NextRequest) {
  const clientId = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous";
  const usage = getCurrentUsage(clientId);
  
  return Response.json(usage);
}
