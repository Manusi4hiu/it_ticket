import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/home/route.tsx"),
  route("login", "routes/login/route.tsx"),
  layout("routes/layout.tsx", [
    route("dashboard", "routes/dashboard/route.tsx"),
    route("tickets", "routes/tickets/route.tsx"),
    route("staff-performance", "routes/staff-performance/route.tsx"),
    route("analytics", "routes/analytics/route.tsx"),
    route("ticket/:id", "routes/ticket.$id/route.tsx"),
    route("profile/:staffId", "routes/profile.$staffId/route.tsx"),
    route("submit-ticket", "routes/submit-ticket/route.tsx"),
    // Settings Routes
    route("settings", "routes/settings/route.tsx", [
      route("role-management", "routes/settings/role-management/route.tsx"),
      route("categories", "routes/settings/categories/route.tsx"),
      route("priorities", "routes/settings/priorities/route.tsx"),
      route("departments", "routes/settings/departments/route.tsx"),
      route("statuses", "routes/settings/statuses/route.tsx"),
      route("logs", "routes/settings/logs/route.tsx"),
    ]),
  ]),
  route("unauthorized", "routes/unauthorized/route.tsx"),
  route("*", "routes/not-found/route.tsx"),
] satisfies RouteConfig;
