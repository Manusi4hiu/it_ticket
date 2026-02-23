import { agents } from "~/data/tickets";

interface SuggestedRoute {
  title: string;
  uri: string;
}

interface RouteDescription {
  suggestedRoutes: SuggestedRoute[];
  itemTitle: string;
}

export function getRouteDescription(): RouteDescription {
  return {
    suggestedRoutes: agents.map((agent) => ({
      title: agent.name,
      uri: `/profile/${agent.id}`,
    })),
    itemTitle: "Staff Profile",
  };
}
