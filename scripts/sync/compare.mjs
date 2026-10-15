import { astronomyScore, mergeableName, pilotInScope } from "./pilot-policy.mjs";
import { inScope, isRetired } from "./policy.mjs";

function nums(urls) {
  return [...String(urls || "").matchAll(/\/people\/(\d+)/g)].map((match) => match[1]);
}

function normText(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[，,]/g, "、");
}

function matchPerson(published, card) {
  if (card.email) {
    const byEmail = published.find((person) => person.email === card.email);
    if (byEmail) return byEmail;
  }
  const num = (card.href.match(/\/people\/(\d+)/) || [])[1];
  if (num) {
    const byNum = published.find((person) => nums(person.profileUrls).includes(num));
    if (byNum) return byNum;
  }
  if (card.name) return published.find((person) => person.name === card.name);
  return undefined;
}

function pilotOrgIds(person) {
  if (person.orgIds?.length) return person.orgIds;
  return person.orgId ? [person.orgId] : [];
}

function samePilotOrg(person, source) {
  const ids = pilotOrgIds(person);
  if (source.orgIds?.length) return source.orgIds.some((id) => ids.includes(id));
  return Boolean(source.division) && person.division === source.division;
}

export function comparePilot(source, published) {
  if (!source.health?.ok) {
    return [{
      type: "source-failed",
      sourceId: source.id,
      reason: source.health?.reason || source.error || "failed",
      before: "",
      after: "",
    }];
  }
  const changes = [];
  const seen = new Set();
  for (const card of (source.cards || []).filter(pilotInScope)) {
    const token = card.email ? `email:${card.email}` : `url:${card.href}`;
    seen.add(token);
    const pool = published.filter((person) => samePilotOrg(person, source));
    const local = (card.email && pool.find((person) => person.email === card.email))
      || (card.href && pool.find((person) => String(person.profileUrls || "").includes(card.href)))
      || (pool.filter((person) => person.name === card.name).length === 1
        ? pool.find((person) => person.name === card.name)
        : undefined);
    if (local) {
      const title = local.titlesByOrg?.[card.orgId] || local.title;
      if (card.title && normText(card.title) !== normText(title)) {
        changes.push({
          type: "update-title",
          sourceId: source.id,
          personId: local.id,
          orgId: card.orgId,
          name: card.name,
          email: card.email || "",
          before: title,
          after: card.title,
          href: card.href,
          excerpt: card.title,
        });
      }
      if (card.directions && normText(card.directions) !== normText(local.directions)) {
        const retained = normText(local.retainedDirections || "");
        if (!(retained && normText(card.directions) === retained)) {
          changes.push({
            type: "update-directions",
            sourceId: source.id,
            personId: local.id,
            name: card.name,
            email: card.email || "",
            before: local.directions,
            after: card.directions,
            href: card.href,
            excerpt: card.directions,
          });
        }
      }
      continue;
    }
    const named = published.filter((person) => person.name === card.name);
    const cross = published.find((person) => {
      if (samePilotOrg(person, source)) return false;
      if (card.email && person.email && person.email === card.email) return true;
      return mergeableName(card.name) && named.length === 1 && person.id === named[0].id;
    });
    if (cross) {
      const clearer = astronomyScore(card.directions) > astronomyScore(cross.directions);
      changes.push({
        type: "add-affiliation",
        sourceId: source.id,
        personId: cross.id,
        orgId: card.orgId,
        name: card.name,
        email: card.email || cross.email || "",
        division: card.orgId,
        before: cross.directions || "",
        after: card.title,
        directions: card.directions || "",
        href: card.href,
        current: !isRetired(card),
        preferDirections: clearer,
        excerpt: `${card.name} 也出现在 ${source.id}。同一人合并，不新建条目。`,
      });
      if (card.directions && cross.directions && !clearer && normText(card.directions) !== normText(cross.directions)) {
        changes.push({
          type: "direction-conflict",
          sourceId: source.id,
          personId: cross.id,
          name: card.name,
          before: cross.directions,
          after: card.directions,
          href: card.href,
          excerpt: "两个任职来源的方向不一致。保留天文表述更明确的一份，另一份不写回规范字段。",
        });
      }
      continue;
    }
    if (!card.directions || card.directions.length < 8) {
      changes.push({
        type: "needs-profile",
        sourceId: source.id,
        name: card.name,
        email: card.email || "",
        href: card.href,
        before: "",
        after: card.title || "",
        excerpt: "名单上有此人，但还没有研究方向原文，先不新增。",
      });
      continue;
    }
    changes.push({
      type: "add",
      sourceId: source.id,
      orgId: card.orgId,
      name: card.name,
      email: card.email || "",
      division: card.orgId,
      before: "",
      after: card.title,
      directions: card.directions,
      href: card.href,
      current: !isRetired(card),
      excerpt: `${card.name} ${card.title} ${card.directions}`.trim(),
    });
  }
  for (const person of published) {
    if (!samePilotOrg(person, source)) continue;
    if (person.email && seen.has(`email:${person.email}`)) continue;
    const urls = String(person.profileUrls || "").split(/\s+/).filter(Boolean);
    if (urls.some((url) => seen.has(`url:${url}`))) continue;
    if (!person.email && !urls.length) continue;
    changes.push({
      type: "absent",
      sourceId: source.id,
      personId: person.id,
      name: person.name,
      email: person.email || "",
      before: person.title || "",
      after: "",
      excerpt: "来源页这次没有出现此人。不据此删除。",
    });
  }
  return changes;
}

export function compareSources({ sources, published }) {
  const changes = [];
  const seenEmails = new Set();
  for (const source of sources) {
    if (source.policy === "pilot") {
      changes.push(...comparePilot(source, published));
      continue;
    }
    if (!source.health?.ok) {
      changes.push({
        type: "source-failed",
        sourceId: source.id,
        reason: source.health?.reason || source.error || "failed",
        before: "",
        after: "",
      });
      continue;
    }
    const cards = source.cards.filter(inScope);
    for (const card of cards) {
      const match = matchPerson(published, card);
      if (match?.email) seenEmails.add(`${source.division}:${match.email}`);
      else if (card.email) seenEmails.add(`${source.division}:${card.email}`);
      if (!match) {
        changes.push({
          type: "add",
          sourceId: source.id,
          name: card.name,
          email: card.email,
          division: card.division,
          before: "",
          after: card.title,
          directions: card.directions,
          href: card.href,
          current: !isRetired(card),
          excerpt: `${card.name} ${card.title} ${card.directions}`.trim(),
        });
        continue;
      }
      if (card.title && normText(card.title) !== normText(match.title)) {
        changes.push({
          type: "update-title",
          sourceId: source.id,
          personId: match.id,
          name: card.name,
          email: card.email,
          before: match.title,
          after: card.title,
          href: card.href,
          excerpt: card.title,
        });
      }
      if (card.directions && normText(card.directions) !== normText(match.directions)) {
        const retained = normText(match.retainedDirections || "");
        if (retained && normText(card.directions) === retained) {
          // The member-page string is the quote already kept beside a clearer astronomy source.
        } else {
          changes.push({
            type: "update-directions",
            sourceId: source.id,
            personId: match.id,
            name: card.name,
            email: card.email,
            before: match.directions,
            after: card.directions,
            href: card.href,
            excerpt: card.directions,
          });
        }
      }
      const nextNum = (card.href.match(/\/people\/(\d+)/) || [])[1];
      if (nextNum && !nums(match.profileUrls).includes(nextNum)) {
        changes.push({
          type: "add-alias",
          sourceId: source.id,
          personId: match.id,
          name: card.name,
          email: card.email,
          before: match.profileUrls,
          after: card.href,
          href: card.href,
          excerpt: `同邮箱，个人页编号变为 ${nextNum}`,
        });
      }
    }
    for (const person of published) {
      if (person.division !== source.division || !person.email) continue;
      if (seenEmails.has(`${source.division}:${person.email}`)) continue;
      changes.push({
        type: "absent",
        sourceId: source.id,
        personId: person.id,
        name: person.name,
        email: person.email,
        before: person.title,
        after: "",
        excerpt: "来源页这次没有出现此人。不据此删除。",
      });
    }
  }
  return changes;
}

export function applyChanges(published, changes) {
  const next = published.map((person) => ({ ...person, profileUrls: person.profileUrls }));
  for (const change of changes) {
    if (change.type === "absent" || change.type === "source-failed" || change.type === "needs-profile" || change.type === "direction-conflict") continue;
    if (change.type === "add-affiliation") {
      const person = next.find((item) => item.id === change.personId);
      if (!person) continue;
      const ids = new Set(person.orgIds || (person.orgId ? [person.orgId] : []));
      if (change.orgId) ids.add(change.orgId);
      person.orgIds = [...ids];
      if (change.preferDirections && change.directions) person.directions = change.directions;
      continue;
    }
    if (change.type === "add") {
      if (change.email && next.some((person) => person.email === change.email)) continue;
      next.push({
        id: `new-${(change.email || change.name || "person").split("@")[0] || change.name}`,
        name: change.name,
        email: change.email,
        title: change.after,
        directions: change.directions || "",
        profileUrls: change.href || "",
        division: change.division,
        current: change.current,
      });
      continue;
    }
    const person = next.find((item) => item.id === change.personId);
    if (!person) continue;
    if (change.type === "update-title") person.title = change.after;
    if (change.type === "update-directions") person.directions = change.after;
    if (change.type === "add-alias" && !person.profileUrls.includes(change.after)) {
      person.profileUrls = `${person.profileUrls} ${change.after}`.trim();
    }
  }
  return next;
}

export function semanticChanges(changes) {
  return changes
    .filter((change) => !["source-failed", "needs-profile", "direction-conflict"].includes(change.type))
    .map((change) => ({
      type: change.type,
      personId: change.personId || "",
      email: change.email || "",
      before: change.before || "",
      after: change.after || "",
    }));
}
