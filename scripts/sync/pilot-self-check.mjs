import { comparePilot, applyChanges } from "./compare.mjs";

const failures = [];
const check = (name, ok) => {
  if (!ok) failures.push(name);
};

const published = [
  {
    id: "lai",
    name: "赖东",
    email: "donglai@sjtu.edu.cn",
    title: "讲席教授",
    directions: "致密星与引力波",
    profileUrls: "https://tdli.sjtu.edu.cn/people/40040/dong-lai",
    division: "astro",
    orgId: "tdli-astro",
    orgIds: ["tdli-astro"],
    titlesByOrg: { "tdli-astro": "讲席教授" },
    current: true,
  },
];

const njuCard = {
  orgId: "nju-sass",
  name: "陈鹏飞",
  title: "教授",
  email: "",
  href: "https://astronomy.nju.edu.cn/szll/szgk/js/20190816/i13821.html",
  directions: "太阳耀斑与日冕物质抛射",
  decision: "include",
  section: "教授",
};

const broken = comparePilot({
  id: "pilot-naoc",
  policy: "pilot",
  division: "naoc",
  orgIds: ["naoc-optical"],
  health: { ok: false, reason: "fetch", count: 0 },
  cards: [],
  error: "timeout",
}, published);
const added = comparePilot({
  id: "pilot-nju-sass",
  policy: "pilot",
  division: "nju-sass",
  orgIds: ["nju-sass"],
  health: { ok: true, reason: "ok", count: 1 },
  cards: [njuCard],
}, published);
check("broken-org-isolated", broken.some((change) => change.type === "source-failed" && change.sourceId === "pilot-naoc"));
check("broken-org-does-not-delete", !broken.some((change) => change.type === "absent"));
check("other-org-still-adds", added.some((change) => change.type === "add" && change.name === "陈鹏飞"));
check("failed-source-not-in-add-batch", !broken.some((change) => change.type === "add"));

const merged = comparePilot({
  id: "pilot-nju-sass",
  policy: "pilot",
  division: "nju-sass",
  orgIds: ["nju-sass"],
  health: { ok: true, reason: "ok", count: 1 },
  cards: [{
    ...njuCard,
    name: "赖东",
    email: "donglai@sjtu.edu.cn",
    title: "教授",
    directions: "粒子物理",
    href: "https://astronomy.nju.edu.cn/example",
  }],
}, published);
check("same-person-merges", merged.some((change) => change.type === "add-affiliation" && change.personId === "lai"));
check("same-person-not-duplicated", !merged.some((change) => change.type === "add"));
check("keeps-clearer-direction", merged.some((change) => change.type === "direction-conflict") && !merged.some((change) => change.preferDirections));
const preview = applyChanges(published, merged);
check("preview-keeps-one-person", preview.filter((person) => person.email === "donglai@sjtu.edu.cn").length === 1);
check("preview-adds-org", preview.find((person) => person.id === "lai").orgIds.includes("nju-sass"));
check("preview-keeps-direction", preview.find((person) => person.id === "lai").directions === "致密星与引力波");

const clearer = comparePilot({
  id: "pilot-cam-ioa",
  policy: "pilot",
  division: "cam-ioa",
  orgIds: ["cam-ioa"],
  health: { ok: true, reason: "ok", count: 1 },
  cards: [{
    orgId: "cam-ioa",
    name: "赖东",
    title: "Professor",
    email: "donglai@sjtu.edu.cn",
    href: "https://www.ast.cam.ac.uk/people/dong.lai",
    directions: "黑洞、中子星与引力波天文",
    decision: "include",
    section: "Faculty",
  }],
}, published);
check("clearer-pilot-direction-preferred", clearer.some((change) => change.type === "add-affiliation" && change.preferDirections));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("pilot self-check ok");
