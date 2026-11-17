import { getCurrentUser } from "@/lib/auth/dal";
import { permissionsFor } from "@/lib/auth/roles";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });

  return Response.json({
    id: user.id.toString(),
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    permissions: permissionsFor(user.role),
  });
}
