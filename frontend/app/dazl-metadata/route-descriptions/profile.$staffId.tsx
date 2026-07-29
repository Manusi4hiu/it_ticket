interface SuggestedRoute {
  title: string;
  uri: string;
}

interface RouteDescription {
  suggestedRoutes: SuggestedRoute[];
  itemTitle: string;
}

/**
 * Daftar staff statis untuk routing metadata.
 * Data ini hanya dipakai oleh dazl dev tool — tidak perlu fetch API.
 */
const staticAgents = [
  { id: "1", name: "John Smith" },
  { id: "2", name: "Jane Doe" },
  { id: "3", name: "Mike Wilson" },
  { id: "4", name: "Sarah Connor" },
];

export function getRouteDescription(): RouteDescription {
  return {
    suggestedRoutes: staticAgents.map((agent) => ({
      title: agent.name,
      uri: `/profile/${agent.id}`,
    })),
    itemTitle: "Staff Profile",
  };
}
