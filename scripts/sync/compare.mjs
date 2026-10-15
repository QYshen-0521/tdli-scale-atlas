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

export function compareSources({ sources, published }) {
  const changes = [];
  const seenEmails = new Set();
  for (const source of sources) {
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
    if (change.type === "absent" || change.type === "source-failed") continue;
    if (change.type === "add") {
      if (next.some((person) => person.email === change.email)) continue;
      next.push({
        id: `new-${change.email.split("@")[0] || change.name}`,
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
    .filter((change) => change.type !== "source-failed")
    .map((change) => ({
      type: change.type,
      personId: change.personId || "",
      email: change.email || "",
      before: change.before || "",
      after: change.after || "",
    }));
}
