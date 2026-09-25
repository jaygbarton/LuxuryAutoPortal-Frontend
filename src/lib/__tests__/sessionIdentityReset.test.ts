import { describe, it, expect, vi, beforeEach } from "vitest";
import { queryClient } from "../queryClient";

// A view-as switch made in another tab only reaches this tab through an
// /api/auth/me refetch. With staleTime: Infinity the scoped lists must be
// dropped then, or an admin "viewing as Co-Host" keeps seeing every car.
const me = (user: object | undefined) => ({ user });

async function fetchMe(data: unknown) {
  await queryClient.fetchQuery({ queryKey: ["/api/auth/me"], queryFn: async () => data, staleTime: 0 });
}

describe("session identity cache reset", () => {
  beforeEach(() => queryClient.clear());

  it("drops page data when a fetched auth/me reports a new view-as co-host", async () => {
    await fetchMe(me({ id: 1, isAdmin: true }));
    queryClient.setQueryData(["/api/admin/car-repaired", "all"], { data: [{ cr_aid: 3 }, { cr_aid: 4 }] });

    await fetchMe(me({ id: 1, isAdmin: true, viewAsCoHost: { coHostId: 5 } }));

    expect(queryClient.getQueryData(["/api/admin/car-repaired", "all"])).toBeUndefined();
    expect(queryClient.getQueryData(["/api/auth/me"])).toEqual(
      me({ id: 1, isAdmin: true, viewAsCoHost: { coHostId: 5 } }),
    );
  });

  it("keeps page data when the identity is unchanged", async () => {
    await fetchMe(me({ id: 1, isAdmin: true }));
    queryClient.setQueryData(["/api/admin/car-repaired", "all"], { data: [] });

    await fetchMe(me({ id: 1, isAdmin: true, firstName: "Renamed" }));

    expect(queryClient.getQueryData(["/api/admin/car-repaired", "all"])).toEqual({ data: [] });
  });

  it("does not reset on a manual setQueryData (callers manage the cache)", async () => {
    await fetchMe(me({ id: 1, isAdmin: true }));
    queryClient.setQueryData(["/api/cars"], { data: [] });
    const spy = vi.spyOn(queryClient, "resetQueries");

    queryClient.setQueryData(["/api/auth/me"], me({ id: 1, viewAsCoHost: { coHostId: 5 } }));

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
