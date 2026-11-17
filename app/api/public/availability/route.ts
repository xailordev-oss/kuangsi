import { connection } from "next/server";
import { errorResponse, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getAvailability } from "@/lib/booking/availability";
import { availabilityQuerySchema } from "@/lib/booking/schemas";

// GET /api/public/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(req: Request) {
  await connection();
  const query = parseQuery(req, availabilityQuerySchema);
  if (!query.ok) return query.response;
  try {
    return Response.json({ days: await getAvailability(prisma, query.data.from, query.data.to) });
  } catch (error) {
    return errorResponse(error);
  }
}
