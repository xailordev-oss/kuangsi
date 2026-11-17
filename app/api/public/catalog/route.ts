import { connection } from "next/server";
import { errorResponse } from "@/lib/api";
import { getCatalog } from "@/lib/booking/catalog";

export async function GET() {
  await connection();
  try {
    return Response.json(await getCatalog());
  } catch (error) {
    return errorResponse(error);
  }
}
