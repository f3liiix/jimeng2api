export function isAdminApiPath(pathname: string) {
  return pathname === "/admin/api" || pathname.startsWith("/admin/api/");
}
