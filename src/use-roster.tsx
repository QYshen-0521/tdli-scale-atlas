import { useSearchParams } from "react-router-dom";
import { organizations } from "./content.ts";
import { rosterQueryFromParams, selectRoster, writeRosterParams, type RosterQuery } from "./roster.ts";
import type { Mentor } from "./types.ts";

export function useRoster() {
  const [params, setParams] = useSearchParams();
  const query = rosterQueryFromParams(params);
  function update(partial: Partial<RosterQuery>) {
    const next = { ...query, ...partial };
    setParams(writeRosterParams(params, next), { replace: true });
  }
  function clear() {
    const kept = new URLSearchParams();
    const from = params.get("from");
    if (from) kept.set("from", from);
    setParams(kept, { replace: true });
  }
  return { query, update, clear, params };
}

export function rosterPath(pathname: string, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.delete("from");
  const text = next.toString();
  return text ? `${pathname}?${text}` : pathname;
}

export function countRoster(people: Mentor[], query: RosterQuery) {
  return selectRoster(people, organizations, query);
}
