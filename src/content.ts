import mentorRaw from "../data/mentors.json";
import objectRaw from "../data/objects.json";
import type { Celestial, Mentor } from "./types.ts";

export const mentors = mentorRaw as Mentor[];
export const objects = objectRaw as Celestial[];

export const chartMentors = mentors
  .filter((m) => m.placement === "chart")
  .slice()
  .sort((a, b) => a.z - b.z);

export const offplaneMentors = mentors.filter((m) => m.placement === "offplane");

const objectMap = new Map(objects.map((o) => [o.id, o]));

export function objectById(id: string) {
  return objectMap.get(id);
}

export function mentorById(id: string) {
  return mentors.find((m) => m.id === id);
}
