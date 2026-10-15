import { topicTags } from "./policy.mjs";

const EXCLUDE = /博士后|访问学者|访问教授|工程师|实验技术|实验师|行政|postdoctoral|post-doc|visitor|emeritus/i;

export function pilotInScope(card) {
  if (card.decision === "exclude" || card.decision === "defer") return false;
  const blob = `${card.section || ""} ${card.title || ""} ${card.department || ""}`;
  if (EXCLUDE.test(blob)) return false;
  if (card.department === "管理支撑部门") return false;
  return Boolean(card.name && card.href);
}

export function astronomyScore(text) {
  const tags = topicTags(text);
  const extra = (String(text || "").match(/太阳|射电|光学|银河|超新星|脉冲星|类星体|星系|恒星|行星|黑洞|引力|宇宙|中微子|暗物质|solar|radio|galaxy|star|planet/gi) || []).length;
  return tags.length * 10 + extra;
}

export function mergeableName(name) {
  const text = String(name || "").trim();
  if (/[\u4e00-\u9fff]/.test(text) && !/[A-Za-z]/.test(text)) return text.replace(/\s+/g, "").length >= 3;
  return text.split(/\s+/).length >= 2 && text.length >= 5;
}

export function pilotTopicTags(text) {
  const tags = topicTags(text);
  if (!tags.includes("astronomy")) tags.unshift("astronomy");
  return tags;
}

export function pilotRole(section, title) {
  const blob = `${section || ""} ${title || ""}`;
  if (/院士/.test(blob)) return "academician";
  if (/Assistant Professor|助理教授/.test(blob)) return "assistant_professor";
  if (/Associate Professor|副教授/.test(blob)) return "associate_professor";
  if (/Professor|Prof\.?|教授/.test(blob)) return "professor";
  if (/副研究员/.test(blob)) return "associate_researcher";
  if (/助理研究员/.test(blob)) return "assistant_researcher";
  if (/研究员/.test(blob)) return "researcher";
  return "faculty";
}
