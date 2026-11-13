import { api, bookKey, pull, textOf, updateBlock } from "./graph.js";
import { blockAlias } from "./link-format.js";
import { documentHeaders, putDocument, readDocument } from "./reader-store.js";
import { codeRanges } from "./annotations.js";
import { t } from "./i18n.js";

export function previewLinkRepair(content) {
  const changes = [];
  const unresolved = [];
  for (const node of content.nodes) {
    // Narrowly repair the known importer bug; code samples and arbitrary
    // user-authored aliases are intentionally not rewritten.
    if (/^\s*```/.test(node.text)) continue;
    const protectedRanges = codeRanges(node.text);
    const after = node.text.replace(/\[\\\[\s*(\d+)\s*\\\]\]\(\(\(([^()\s]+)\)\)\)/g, (match, number, target, offset) => {
      if (protectedRanges.some(([a, b]) => offset >= a && offset < b)) return match;
      if (!pull(target)) { unresolved.push({ uid: node.uid, target }); return match; }
      return blockAlias(number, target);
    });
    if (after !== node.text) changes.push({ uid: node.uid, before: node.text, after });
  }
  return { bookKey: content.key, title: content.record.title, changes, unresolved };
}

export async function applyLinkRepair(plan) {
  const key = `${plan.bookKey}:${Date.now()}:${api().util.generateUID()}`;
  const backup = { ...plan, key, createdAt: Date.now(), applied: [], skipped: [] };
  // Persist every original block string BEFORE the first source write.
  await putDocument("link-repair", key, backup);
  for (const change of plan.changes) {
    if (textOf(pull(change.uid)) !== change.before) { backup.skipped.push(change.uid); continue; }
    await updateBlock({ uid: change.uid, string: change.after });
    backup.applied.push(change.uid);
  }
  await putDocument("link-repair", key, backup);
  return backup;
}

export function latestRepair(content) {
  const headers = documentHeaders("link-repair").filter(header => header.key.startsWith(`${content.key}:`)).sort((a, b) => b.updatedAt - a.updatedAt);
  return headers[0] ? readDocument("link-repair", headers[0].key) : null;
}

export async function undoLinkRepair(key) {
  const backup = readDocument("link-repair", key);
  if (!backup) throw new Error(t("No repair backup was found."));
  const result = { restored: [], skipped: [] };
  // Inspect every proposed change, including writes that committed just before
  // an interruption. Never overwrite subsequent user edits on undo.
  for (const change of backup.changes) {
    if (textOf(pull(change.uid)) === change.after) {
      await updateBlock({ uid: change.uid, string: change.before });
      result.restored.push(change.uid);
    } else result.skipped.push(change.uid);
  }
  await putDocument("link-repair", key, { ...backup, undoneAt: Date.now(), undo: result });
  return result;
}
