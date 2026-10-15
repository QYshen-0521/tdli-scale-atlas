import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyReportToData } from "./apply-report.mjs";
import {
  assessPortrait,
  candidateImageUrls,
  markSharedPlaceholders,
  portraitUrlFromHtml,
  rankProfileUrls,
} from "./photos.mjs";

const failures = [];
const check = (name, ok) => {
  if (!ok) failures.push(name);
};

const nju = portraitUrlFromHtml(
  `<div class="left"><div class="img"><img src="/DFS//file/a.jpg?iid=1" alt=""></div></div>`,
  "https://astronomy.nju.edu.cn/szll/i1.html",
);
check("nju-portrait", nju === "https://astronomy.nju.edu.cn/DFS//file/a.jpg?iid=1");

const tdli = portraitUrlFromHtml(
  `<img src="https://tdli.sjtu.edu.cn/assets/images/logo.png"><div class="img-box"><div class="img"><img src="http://tdli.sjtu.edu.cn/files/images/x/person.jpg"></div></div>`,
  "https://tdli.sjtu.edu.cn/people/1",
);
check("tdli-portrait", tdli === "http://tdli.sjtu.edu.cn/files/images/x/person.jpg");
const tdliStorage = portraitUrlFromHtml(
  `<div class="img-box"><div class="img"><img src="https://ngcee.sjtu.edu.cn/faculty/storage/common/2025/05/abc.jpg" alt=""></div></div>`,
  "https://tdli.sjtu.edu.cn/people/40040/dong-lai",
);
check("tdli-storage-portrait", tdliStorage === "https://ngcee.sjtu.edu.cn/faculty/storage/common/2025/05/abc.jpg");

const naoc = portraitUrlFromHtml(
  `<div class="box-img"><img src="./P020.jpg" alt="" /></div>`,
  "https://nao.cas.cn/nrc/zg/202204/t20220406_1.html",
);
check("naoc-portrait", naoc === "https://nao.cas.cn/nrc/zg/202204/P020.jpg");

const cambridge = portraitUrlFromHtml(
  `<div class="field-name-field-sd-staff-photo"><img src="https://www.ast.cam.ac.uk/sites/default/files/styles/inline/public/a.jpg?itok=abc" /></div>`,
  "https://www.ast.cam.ac.uk/people/a.b",
);
check("cambridge-portrait", cambridge.includes("/styles/inline/public/a.jpg"));
check(
  "cambridge-original-first",
  candidateImageUrls(cambridge)[0] === "https://www.ast.cam.ac.uk/sites/default/files/a.jpg",
);

check("skip-logo-name", portraitUrlFromHtml(`<div class="left"><img src="/logo.png"></div>`, "https://astronomy.nju.edu.cn/a") === "");
check("skip-unofficial", portraitUrlFromHtml(`<div class="img-box"><img src="https://example.com/a.jpg"></div>`, "https://example.com/p") === "");

const ranked = rankProfileUrls([
  "https://tdli.sjtu.edu.cn/en/people/1",
  "https://astronomy.nju.edu.cn/szll/a.html",
  "https://example.com/not-official",
]);
check("prefer-astronomy-host", ranked[0] === "https://astronomy.nju.edu.cn/szll/a.html");
check("drop-unofficial-url", !ranked.includes("https://example.com/not-official"));

check("reject-html", assessPortrait(Buffer.from("<html></html>")).ok === false);
check("reject-tiny", assessPortrait(Buffer.from([0xff, 0xd8, 0xff, 0xd9])).ok === false);

const shared = markSharedPlaceholders([
  { ok: true, hash: "aaa", personId: "a" },
  { ok: true, hash: "aaa", personId: "b" },
  { ok: true, hash: "bbb", personId: "c" },
]);
check("placeholder-pair", shared[0].ok === false && shared[1].placeholder === true);
check("unique-kept", shared[2].ok === true);

function fixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "portrait-apply-"));
  mkdirSync(path.join(root, "data/coverage"), { recursive: true });
  for (const [file, data] of [
    ["data/people.json", []],
    ["data/affiliations.json", []],
    ["data/evidence.json", []],
    ["data/atlas-annotations.json", []],
    ["data/editorial.json", []],
    ["data/coverage/ledger.json", []],
    ["data/coverage/pilot-ledger.json", []],
  ]) writeFileSync(path.join(root, file), `${JSON.stringify(data)}\n`);
  return root;
}

const report = {
  checkedAt: "2026-10-15T00:00:00.000Z",
  changes: [{
    type: "add",
    name: "方成",
    email: "portrait-test@nju.edu.cn",
    after: "教授",
    directions: "太阳物理",
    href: "https://astronomy.nju.edu.cn/szll/test.html",
    orgId: "nju-sass",
    division: "nju-sass",
    sourceId: "pilot-nju-sass",
    current: true,
  }],
};

const failedRoot = fixtureRoot();
const failed = await applyReportToData(failedRoot, report, {
  fetchPortrait: async () => {
    throw new Error("timeout");
  },
});
const failedPeople = JSON.parse(readFileSync(path.join(failedRoot, "data/people.json"), "utf8"));
const failedEditorial = JSON.parse(readFileSync(path.join(failedRoot, "data/editorial.json"), "utf8"));
check("photo-failure-still-adds", failed.touched === 1 && failedPeople.length === 1 && failedEditorial[0].photo === "");
check("photo-failure-logged", failed.photoMisses.length === 1 && /timeout/.test(failed.photoMisses[0].reason));

const okRoot = fixtureRoot();
const ok = await applyReportToData(okRoot, structuredClone(report), {
  fetchPortrait: async () => ({
    ok: true,
    photo: "/assets/mentors/p-portraittestnjueducn.jpg",
    photoSource: "https://astronomy.nju.edu.cn/szll/test.html",
  }),
});
const okEditorial = JSON.parse(readFileSync(path.join(okRoot, "data/editorial.json"), "utf8"));
check("photo-success-writes-fields", ok.photoMisses.length === 0 && okEditorial[0].photo.endsWith(".jpg") && okEditorial[0].photoSource.includes("astronomy.nju.edu.cn"));

const skippedRoot = fixtureRoot();
let called = false;
await applyReportToData(skippedRoot, structuredClone(report), {
  photos: false,
  fetchPortrait: async () => {
    called = true;
    return { ok: true, photo: "/assets/mentors/x.jpg", photoSource: "https://astronomy.nju.edu.cn/szll/test.html" };
  },
});
const skippedEditorial = JSON.parse(readFileSync(path.join(skippedRoot, "data/editorial.json"), "utf8"));
check("photos-flag-can-skip", called === false && skippedEditorial[0].photo === "");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("photos self-check ok");
