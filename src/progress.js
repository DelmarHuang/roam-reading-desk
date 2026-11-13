import { api, bookKey, plain, value } from "./graph.js";
import { documentHeaders, putDocument, readDocument } from "./reader-store.js";

export function readerProfile() {
  try { return String(api().user?.uid?.() || "default-reader"); } catch { return "default-reader"; }
}
export class ReadingProgress {
  constructor(content, profile = readerProfile()) {
    this.content = content;
    this.profile = profile;
    this.states = new Map();
    this.eligible = new Map();
    this.dirty = new Set();
    for (const chapter of content.chapters) {
      if (!chapter.progress) continue;
      const nodes = content.nodes.filter(node => node.chapterUid === chapter.uid && node.uid !== chapter.uid && !(value(node.node, "heading") > 0) && /[\p{L}\p{N}]/u.test(plain(node.text)) && !/^\s*```/.test(node.text));
      this.eligible.set(chapter.uid, new Set(nodes.map(node => node.uid)));
      this.states.set(chapter.uid, { seen: [], lastBlockUid: null, updatedAt: 0 });
    }
  }
  key(chapterUid) { return JSON.stringify([bookKey(this.content.record), this.profile, chapterUid]); }
  load() {
    const headers = new Map(documentHeaders("chapter-progress").map(header => [header.key, header]));
    for (const uid of this.states.keys()) {
      const key = this.key(uid);
      const stored = readDocument("chapter-progress", key, headers.get(key) || null);
      if (stored) { const resolve = block => this.content.fragmentAliases?.get(block) || block; this.states.set(uid, { ...stored, lastBlockUid:resolve(stored.lastBlockUid), seen: [...new Set((stored.seen || []).map(resolve))].filter(block => this.eligible.get(uid).has(block)) }); }
    }
    for (const [alias, uid] of this.content.chapterAliases || []) {
      const state = this.states.get(uid); if (!state || state.mergedAliases?.includes(alias)) continue;
      const key = this.key(alias), prior = readDocument("chapter-progress", key, headers.get(key) || null);
      if (!prior) continue;
      state.seen = [...new Set([...state.seen, ...(prior.seen || [])])].filter(block => this.eligible.get(uid).has(block));
      if (prior.updatedAt > state.updatedAt && this.eligible.get(uid).has(prior.lastBlockUid)) { state.updatedAt = prior.updatedAt; state.lastBlockUid = prior.lastBlockUid; }
      state.mergedAliases = [...(state.mergedAliases || []), alias]; this.dirty.add(uid);
    }
    return this;
  }
  record(uid, now = Date.now()) {
    const node = this.content.byUid.get(uid);
    if (!node || !this.eligible.get(node.chapterUid)?.has(uid)) return false;
    const state = this.states.get(node.chapterUid);
    const isNew = !state.seen.includes(uid);
    if (isNew) state.seen.push(uid);
    if (isNew || state.lastBlockUid !== uid) {
      state.lastBlockUid = uid; state.updatedAt = now;
      this.dirty.add(node.chapterUid);
      return true;
    }
    return false;
  }
  summary(uid) {
    const state = this.states.get(uid);
    const total = this.eligible.get(uid)?.size || 0;
    const seen = state?.seen.length || 0;
    return { ...state, total, seenCount: seen, read: Boolean(state?.readAt), percent: total ? Math.round(seen / total * 100) : 0, status: state?.readAt ? "Read" : !seen ? "Unvisited" : seen >= total ? "Browsed" : "Browsing" };
  }
  latest() {
    return [...this.states.entries()].filter(([, state]) => state.lastBlockUid).sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0];
  }
  // A reader's explicit "Mark as Read", separate from estimated browsing.
  async markRead(uid, read = true) {
    const state = this.states.get(uid); if (!state) return false;
    if (read) state.readAt = Date.now(); else delete state.readAt;
    this.dirty.add(uid); await this.flush(); return true;
  }
  async reset(uid) {
    this.states.set(uid, { seen: [], lastBlockUid: null, updatedAt: Date.now(), mergedAliases: this.states.get(uid)?.mergedAliases || [] });
    this.dirty.add(uid);
    await this.flush();
  }
  async flush() {
    for (const uid of [...this.dirty]) {
      this.dirty.delete(uid);
      try { await putDocument("chapter-progress", this.key(uid), this.states.get(uid)); }
      catch (error) { this.dirty.add(uid); throw error; }
    }
  }
}

// Pure time/visibility model, separately tested without browser layout. Being
// open, being in the background, or jumping to chapter 8 is not evidence that
// preceding text was browsed.
export class DwellMeter {
  constructor(progress, { dwellMs = 3000, idleMs = 45000 } = {}) {
    this.progress = progress; this.dwellMs = dwellMs; this.idleMs = idleMs;
    this.visible = new Map(); this.credited = new Set(); this.active = true; this.activityAt = 0;
  }
  activity(now) { this.activityAt = now; }
  visibility(uid, visible, now) {
    if (visible && !this.visible.has(uid)) this.visible.set(uid, now);
    else if (!visible) { this.visible.delete(uid); this.credited.delete(uid); }
  }
  setActive(active, now) {
    this.active = active;
    for (const uid of this.visible.keys()) this.visible.set(uid, now);
    if (active) this.activity(now);
  }
  tick(now) {
    if (!this.active || now - this.activityAt > this.idleMs) {
      for (const uid of this.visible.keys()) this.visible.set(uid, now);
      return false;
    }
    let changed = false;
    for (const [uid, since] of this.visible) {
      if (!this.credited.has(uid) && now - since >= this.dwellMs) { changed = this.progress.record(uid, now) || changed; this.credited.add(uid); }
    }
    return changed;
  }
}
