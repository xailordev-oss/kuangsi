export const ROLES = ["admin", "cashier", "scanner", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// ສິດທິຕາມ requirements 1.6: admin = ທັງໝົດ · cashier = ຂາຍປີ້ + ກວດຫຼັກຖານໂອນ
// scanner = ສະແກນເທົ່ານັ້ນ · viewer = ອ່ານລາຍງານ/ການຈອງ ບໍ່ແກ້ຂໍ້ມູນ
export const PERMISSIONS = {
  "booking.read": ["admin", "viewer"],
  "booking.manage": ["admin"],
  "pos.sell": ["admin", "cashier"],
  "proof.verify": ["admin", "cashier"],
  "checkin.scan": ["admin", "scanner"],
  "report.read": ["admin", "viewer"],
  "catalog.manage": ["admin"],
  "settings.manage": ["admin"],
  "users.manage": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));
}

export const STAFF_LOGIN_PATH = "/staff/login";

// ລຳດັບສຳຄັນ: ອັນທີ່ລະອຽດກວ່າຕ້ອງມາກ່ອນ "/admin"
const ROUTE_RULES: ReadonlyArray<{ path: string; permission: Permission }> = [
  { path: "/staff/scan", permission: "checkin.scan" },
  { path: "/staff/pos", permission: "pos.sell" },
  { path: "/staff/proofs", permission: "proof.verify" },
  { path: "/admin/ticket-types", permission: "catalog.manage" },
  { path: "/admin/users", permission: "users.manage" },
  { path: "/admin/settings", permission: "settings.manage" },
  { path: "/admin/reports", permission: "report.read" },
  { path: "/admin/bookings", permission: "booking.read" },
  { path: "/admin/scan-reviews", permission: "report.read" },
  { path: "/admin", permission: "report.read" },
];

function matches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

// ໜ້າ /staff/* ຫຼື /admin/* ທີ່ບໍ່ມີໃນລາຍການ → admin ເທົ່ານັ້ນ (default deny)
export function canAccessPath(role: Role, pathname: string): boolean {
  const rule = ROUTE_RULES.find((r) => matches(pathname, r.path));
  return rule ? can(role, rule.permission) : role === "admin";
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "cashier":
      return "/staff/pos";
    case "scanner":
      return "/staff/scan";
    case "admin":
    case "viewer":
      return "/admin";
  }
}
