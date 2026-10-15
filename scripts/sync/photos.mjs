import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { absoluteUrl } from "./adapters/text.mjs";

/**
 * 肖像规则：新增人员时默认尝试从官方个人页下载头像，写入
 * public/assets/mentors/<id>.<ext>，并填写 editorial 的 photo / photoSource。
 * 页面没有可用肖像、下载失败，或文件不像单人照片时，人员仍然入库，照片留空。
 * 只使用名录里已有的官方主页，不生成人脸，也不改已有的 photoFocus。
 */

export const PHOTO_USER_AGENT = "tdli-scale-atlas-sync/1.0 (+https://github.com/QYshen-0521/tdli-scale-atlas; official faculty portrait)";

const EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];
const MIN_BYTES = 2500;
const MAX_BYTES = 8_000_000;
const MIN_EDGE = 80;

const chains = new Map();
const nextAt = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function officialPage(url) {
  const host = hostOf(url);
  if (!host) return false;
  return (
    /(^|\.)sjtu\.edu\.cn$/.test(host)
    || /(^|\.)nju\.edu\.cn$/.test(host)
    || /(^|\.)cam\.ac\.uk$/.test(host)
    || /(^|\.)cas\.cn$/.test(host)
    || /(^|\.)bao\.ac\.cn$/.test(host)
  );
}

function pace(url, gapMs = 250) {
  const host = hostOf(url) || url;
  const prev = chains.get(host) || Promise.resolve();
  const run = prev.then(async () => {
    const wait = (nextAt.get(host) || 0) - Date.now();
    if (wait > 0) await sleep(wait);
    nextAt.set(host, Date.now() + gapMs);
  });
  chains.set(host, run.then(() => {}, () => {}));
  return run;
}

export function rankProfileUrls(urls, { photoSource = "" } = {}) {
  const list = [];
  for (const url of urls || []) {
    if (typeof url !== "string" || !url.startsWith("http")) continue;
    if (!officialPage(url)) continue;
    if (!list.includes(url)) list.push(url);
  }
  const score = (url) => {
    let value = 0;
    if (/ast\.cam\.ac\.uk|astronomy\.nju\.edu\.cn|nao\.cas\.cn|bao\.ac\.cn/.test(url)) value += 100;
    else if (/tdli\.sjtu\.edu\.cn/.test(url)) value += 80;
    else value += 40;
    if (photoSource && url === photoSource) value += 12;
    if (/\/en\//.test(url)) value -= 6;
    return value;
  };
  return list.sort((a, b) => score(b) - score(a) || a.length - b.length);
}

function firstImage(block) {
  const raw = (String(block || "").match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i) || [])[1] || "";
  return raw.replace(/&amp;/g, "&").trim();
}

export function portraitUrlFromHtml(html, pageUrl) {
  const text = String(html || "");
  const host = hostOf(pageUrl);
  if (!host || !officialPage(pageUrl)) return "";
  let raw = "";
  if (host.endsWith("sjtu.edu.cn")) {
    raw = firstImage((text.match(/class="img-box"[\s\S]{0,1500}/i) || [])[0]);
    if (!raw) {
      const imgs = [...text.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
      raw = imgs.find((src) => /\/files\/images\/|\/faculty\/storage\//.test(src)) || "";
    }
  } else if (host.endsWith("nju.edu.cn")) {
    raw = firstImage((text.match(/class="left"[\s\S]{0,1500}/i) || [])[0]);
  } else if (host.endsWith("cas.cn") || host.endsWith("bao.ac.cn")) {
    raw = firstImage((text.match(/class="box-img"[\s\S]{0,600}/i) || [])[0]);
  } else if (host.endsWith("cam.ac.uk")) {
    raw = firstImage((text.match(/field-sd-staff-photo[\s\S]{0,900}/i) || [])[0]);
  }
  let filename = raw.split("?")[0].split("/").pop() || "";
  try {
    filename = decodeURIComponent(filename);
  } catch {
    /* 文件名里的百分号不一定是转义。 */
  }
  if (!raw || /logo|icon|sprite|qrcode|wechat|nophoto|no-photo|no_photo|placeholder|default/i.test(filename)) return "";
  const absolute = absoluteUrl(raw, pageUrl);
  return officialPage(absolute) ? absolute : "";
}

export function candidateImageUrls(imageUrl) {
  const original = String(imageUrl || "")
    .replace(/\/sites\/default\/files\/styles\/[^/]+\/public\//, "/sites/default/files/")
    .replace(/\?itok=[^&]*/i, "")
    .replace(/[?&]$/, "");
  if (original && original !== imageUrl) return [original, imageUrl];
  return imageUrl ? [imageUrl] : [];
}

function sniff(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 6 && (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a")) return "gif";
  return "";
}

function jpegSize(buf) {
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (i + 3 >= buf.length) return null;
    const length = buf.readUInt16BE(i + 2);
    if (length < 2) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof && i + 8 < buf.length) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xda || marker === 0xd9) return null;
    i += 2 + length;
  }
  return null;
}

function imageSize(buf, kind) {
  if (kind === "jpeg") return jpegSize(buf);
  if (kind === "png" && buf.length >= 24) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (kind === "gif" && buf.length >= 10) return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  return null;
}

export function assessPortrait(buf) {
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  const kind = sniff(bytes);
  if (!kind) return { ok: false, reason: "不是图片" };
  if (bytes.length < MIN_BYTES) return { ok: false, reason: `文件过小（${bytes.length} 字节）` };
  if (bytes.length > MAX_BYTES) return { ok: false, reason: "文件过大" };
  const size = imageSize(bytes, kind);
  if (!size && kind !== "webp") return { ok: false, reason: "读不出宽高" };
  if (size) {
    if (Math.min(size.width, size.height) < MIN_EDGE) return { ok: false, reason: `尺寸过小（${size.width}×${size.height}）` };
    const ratio = size.width / size.height;
    if (ratio > 2.6 || ratio < 0.3) return { ok: false, reason: `不像头像（${size.width}×${size.height}）` };
  }
  return { ok: true, kind, width: size?.width || 0, height: size?.height || 0, bytes };
}

async function fetchResponse(url, { referer = "", fetchImpl = fetch, attempts = 3 } = {}) {
  let last = new Error("未请求");
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await pace(url);
      const response = await fetchImpl(url, {
        redirect: "follow",
        headers: {
          "user-agent": PHOTO_USER_AGENT,
          accept: referer ? "image/avif,image/webp,image/*,*/*;q=0.8" : "text/html,application/xhtml+xml",
          ...(referer ? { referer } : {}),
        },
        signal: AbortSignal.timeout(25000),
      });
      if (response.status === 429 || response.status >= 500) {
        last = new Error(`HTTP ${response.status}`);
        await sleep(700 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      last = error instanceof Error ? error : new Error(String(error));
      if (attempt === attempts - 1) break;
      await sleep(700 * (attempt + 1));
    }
  }
  throw last;
}

export async function fetchHtml(url, options = {}) {
  const response = await fetchResponse(url, options);
  return response.text();
}

async function fetchImage(url, referer, options = {}) {
  const response = await fetchResponse(url, { ...options, referer });
  const bytes = Buffer.from(await response.arrayBuffer());
  const verdict = assessPortrait(bytes);
  if (!verdict.ok) throw new Error(verdict.reason);
  return verdict;
}

export function extensionFor(kind) {
  if (kind === "jpeg") return "jpg";
  if (kind === "png") return "png";
  if (kind === "webp") return "webp";
  if (kind === "gif") return "gif";
  return "";
}

export function commitPortrait({ root, personId, bytes, kind }) {
  if (!/^[a-z0-9-]+$/.test(personId)) throw new Error(`非法 id ${personId}`);
  const ext = extensionFor(kind);
  if (!ext) throw new Error("未知图片格式");
  const dir = path.join(root, "public/assets/mentors");
  mkdirSync(dir, { recursive: true });
  const filename = `${personId}.${ext}`;
  const file = path.join(dir, filename);
  const photo = `/assets/mentors/${filename}`;
  const hash = createHash("sha256").update(bytes).digest("hex");
  const previous = existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : "";
  if (previous !== hash) writeFileSync(file, bytes);
  for (const other of EXTENSIONS) {
    if (other === ext) continue;
    const stale = path.join(dir, `${personId}.${other}`);
    if (existsSync(stale)) rmSync(stale);
  }
  return { photo, hash, changed: previous !== hash, created: !previous };
}

export function markSharedPlaceholders(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (!row?.ok || !row.hash) continue;
    counts.set(row.hash, (counts.get(row.hash) || 0) + 1);
  }
  for (const row of rows) {
    const count = counts.get(row.hash) || 0;
    if (!row?.ok || count < 2) continue;
    row.ok = false;
    row.placeholder = true;
    row.reason = `同一张图出现在 ${count} 个官方页面上，当作占位图，不写入`;
  }
  return rows;
}

export async function acquirePortrait({ personId, profileUrls, photoSource = "", fetchPage = fetchHtml, fetchBinary } = {}) {
  const pages = rankProfileUrls([...(profileUrls || []), photoSource], { photoSource });
  const errors = [];
  if (!pages.length) return { ok: false, personId, reason: "没有官方个人页", errors };
  for (const pageUrl of pages) {
    let html = "";
    try {
      html = await fetchPage(pageUrl);
    } catch (error) {
      errors.push(`${pageUrl} 页面 ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const found = portraitUrlFromHtml(html, pageUrl);
    if (!found) {
      errors.push(`${pageUrl} 没有肖像`);
      continue;
    }
    for (const imageUrl of candidateImageUrls(found)) {
      try {
        const verdict = fetchBinary
          ? assessPortrait(await fetchBinary(imageUrl, pageUrl))
          : await fetchImage(imageUrl, pageUrl);
        if (!verdict.ok) throw new Error(verdict.reason);
        return {
          ok: true,
          personId,
          bytes: verdict.bytes,
          kind: verdict.kind,
          width: verdict.width,
          height: verdict.height,
          hash: createHash("sha256").update(verdict.bytes).digest("hex"),
          photoSource: pageUrl,
          imageUrl,
          errors,
        };
      } catch (error) {
        errors.push(`${imageUrl} ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return { ok: false, personId, reason: errors.join("；") || "没有肖像", errors };
}

export async function fetchPersonPortrait({ root, personId, profileUrls, photoSource = "", ...rest }) {
  const acquired = await acquirePortrait({ personId, profileUrls, photoSource, ...rest });
  if (!acquired.ok) return acquired;
  const saved = commitPortrait({ root, personId, bytes: acquired.bytes, kind: acquired.kind });
  return { ...acquired, ...saved, bytes: undefined };
}

export async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return out;
}

export async function fillMissingPortraits(root, editorial, people, options = {}) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const targets = editorial.filter((entry) => entry && !entry.photo && byId.has(entry.personId));
  const filled = [];
  const misses = [];
  await mapPool(targets, 4, async (entry) => {
    const person = byId.get(entry.personId);
    try {
      const result = options.fetchPortrait
        ? await options.fetchPortrait(person)
        : await fetchPersonPortrait({
          root,
          personId: person.id,
          profileUrls: person.profileUrls?.length ? person.profileUrls : [person.profileUrl],
          photoSource: entry.photoSource || "",
        });
      if (result?.ok && result.photo) {
        entry.photo = result.photo;
        entry.photoSource = result.photoSource || person.profileUrl || "";
        filled.push(person.id);
        console.log(`肖像 ${person.id} <- ${entry.photoSource}`);
      } else {
        const reason = result?.reason || "没有肖像";
        misses.push({ id: person.id, name: person.nameOriginal || person.name || "", reason });
        console.warn(`肖像未取得，人已写入名录：${person.id} ${person.nameOriginal || person.name || ""} — ${reason}`);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      misses.push({ id: person.id, name: person.nameOriginal || person.name || "", reason });
      console.warn(`肖像未取得，人已写入名录：${person.id} ${person.nameOriginal || person.name || ""} — ${reason}`);
    }
  });
  return { filled, misses };
}
