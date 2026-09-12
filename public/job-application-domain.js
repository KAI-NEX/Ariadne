(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AriadneJobApplications = api;
}(globalThis, function () {
  "use strict";
  // User follow-up metadata is independent of immutable Job/Candidate content.
  const DB_NAME = "ariadne-job-applications-v1";
  const STAGES = Object.freeze({ NOT_APPLIED: "未投递", APPLIED: "已投递", IN_PROGRESS: "推进中", CLOSED: "已结束" });
  const OUTCOMES = Object.freeze({ "": "暂不填写", RESUME_REJECTED: "简历未通过", INTERVIEW_REJECTED: "面试未通过", HIRED: "已入职", WITHDRAWN: "主动放弃", POSITION_CLOSED: "岗位关闭", OTHER: "其他结果" });
  function initial(jobId) {
    if (typeof jobId !== "string" || !jobId.trim() || jobId.length > 300) throw Error("职位标识无效。");
    return { job_context_id: jobId, stage: "NOT_APPLIED", outcome: "", note: "", revision: 0, updated_at: null, history: [] };
  }
  function validate(record) {
    initial(record?.job_context_id);
    if (!Object.hasOwn(STAGES, record.stage) || !Object.hasOwn(OUTCOMES, record.outcome)
      || (record.stage !== "CLOSED" && record.outcome !== "") || typeof record.note !== "string" || record.note.length > 300
      || !Number.isSafeInteger(record.revision) || record.revision < 0 || !Array.isArray(record.history)) throw Error("职位跟进记录无法读取，请保留数据后重试。");
    return record;
  }
  function next(previous, change, expectedRevision, now = new Date().toISOString()) {
    validate(previous);
    if (previous.revision !== expectedRevision) throw Error("这项职位的阶段已在其他页面更新，请重新打开后修改。");
    if (!Object.hasOwn(STAGES, change.stage) || !Object.hasOwn(OUTCOMES, change.outcome) || typeof change.note !== "string" || change.note.trim().length > 300) throw Error("请选择有效阶段，备注最多 300 字。");
    if (change.stage !== "CLOSED" && change.outcome) throw Error("结束结果只适用于已结束的职位。");
    const entry = { stage: change.stage, outcome: change.outcome, note: change.note.trim(), changed_at: now };
    return validate({ ...previous, ...entry, revision: previous.revision + 1, updated_at: now, history: [...previous.history, entry] });
  }
  function matches(record, filter) { return filter === "ALL" || (filter === "ACTIVE" ? record.stage !== "CLOSED" : record.stage === filter); }
  function orderJobs(records, applications) {
    if (!Array.isArray(records) || !(applications instanceof Map)) throw Error("职位列表无法排序。");
    const isClosed = job => (applications.get(job.job_context_id) || initial(job.job_context_id)).stage === "CLOSED";
    return [...records.filter(job => !isClosed(job)), ...records.filter(isClosed)];
  }
  function sourceLink(job) {
    const raw = job?.source_url || job?.imported_from?.source_url;
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      const url = new URL(raw.trim());
      if (!["http:", "https:"].includes(url.protocol)) return null;
      return Object.freeze({
        href: url.href,
        visible: `${url.host}${url.pathname === "/" ? "" : url.pathname}${url.search}`,
      });
    } catch (_error) { return null; }
  }
  function open(indexedDb = globalThis.indexedDB) {
    return new Promise((resolve, reject) => {
      if (!indexedDb) { reject(Error("浏览器无法保存职位阶段。")); return; }
      const request = indexedDb.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("applications", { keyPath: "job_context_id" });
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(Error("职位阶段数据库无法打开。"));
      request.onblocked = () => reject(Error("请关闭其他旧页面后重试。"));
    });
  }
  async function all() {
    const db = await open();
    try { return await new Promise((resolve, reject) => {
      const request = db.transaction("applications").objectStore("applications").getAll();
      request.onsuccess = () => { try { resolve(new Map(request.result.map(record => [record.job_context_id, validate(record)]))); } catch (error) { reject(error); } };
      request.onerror = () => reject(Error("职位阶段读取失败，请重试。"));
    }); } finally { db.close(); }
  }
  async function save(jobId, change, expectedRevision) {
    initial(jobId);
    const db = await open();
    try { return await new Promise((resolve, reject) => {
      const tx = db.transaction("applications", "readwrite"), store = tx.objectStore("applications");
      let result, failure;
      const request = store.get(jobId);
      request.onsuccess = () => {
        try { result = next(request.result || initial(jobId), change, expectedRevision); store.put(result); }
        catch (error) { failure = error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(failure || Error("阶段保存失败，原记录仍保留。请重试。"));
    }); } finally { db.close(); }
  }
  return Object.freeze({ DB_NAME, STAGES, OUTCOMES, initial, validate, next, matches, orderJobs, sourceLink, all, save });
}));
