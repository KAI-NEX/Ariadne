const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const requestLine = document.querySelector("#request");
const results = document.querySelector("#results");
const detail = document.querySelector("#detail");

function displayValue(value) {
  return value ?? "unknown";
}

function statusOptions(currentStatus) {
  const options = ["unknown", "not_applied", "applied", "interviewing", "rejected", "offer", "withdrawn"];
  return options.map((status) => `
    <option value="${status}" ${status === currentStatus ? "selected" : ""}>${status}</option>
  `).join("");
}

function renderExternalSyncEvidence(job) {
  if (!job.external_job_id) return "";
  return `
    <section class="external-sync-evidence">
      <h3>外部同步证据</h3>
      <dl>
        <div><dt>来源</dt><dd>${displayValue(job.external_source_name)}</dd></div>
        <div><dt>外部岗位 ID</dt><dd>${job.external_job_id}</dd></div>
        <div><dt>本次成功读取</dt><dd>${displayValue(job.last_successful_fetch_at)}</dd></div>
        <div><dt>来源标题</dt><dd>${displayValue(job.source_title)}</dd></div>
        <div><dt>来源地点</dt><dd>${displayValue(job.source_location)}</dd></div>
        <div><dt>来源经验</dt><dd>${displayValue(job.source_seniority)}</dd></div>
      </dl>
    </section>
  `;
}

function renderJobs(jobs) {
  if (jobs.length === 0) {
    results.innerHTML = '<p class="empty">没有找到匹配职位。这个结果表示查询成功，但没有匹配记录。</p>';
    return;
  }

  results.innerHTML = jobs.map((job) => `
    <article class="job-card">
      <p class="job-id">${job.job_id}</p>
      <h2>${job.title}</h2>
      <p class="company">${job.company}</p>
      <dl>
        <div><dt>地点</dt><dd>${job.location}</dd></div>
        <div><dt>经验</dt><dd>${job.seniority}</dd></div>
        <div><dt>发布日期</dt><dd>${displayValue(job.published_date)}</dd></div>
        <div><dt>岗位状态</dt><dd>${job.posting_status}</dd></div>
        <div><dt>我的投递</dt><dd>${job.application_status}</dd></div>
      </dl>
      ${job.source_url ? `<p><a href="${job.source_url}" target="_blank" rel="noreferrer">打开原始职位链接</a></p>` : ""}
      <button type="button" data-detail-button="${job.job_id}">查看详情</button>
      <div class="status-update">
        <label for="application-${job.job_id}">更新我的投递状态</label>
        <div class="status-row">
          <select id="application-${job.job_id}" data-status-select="${job.job_id}">
            ${statusOptions(job.application_status)}
          </select>
          <button type="button" data-status-button="${job.job_id}">保存状态</button>
        </div>
      </div>
    </article>
  `).join("");

  document.querySelectorAll("[data-status-button]").forEach((button) => {
    button.addEventListener("click", () => updateApplicationStatus(button.dataset.statusButton));
  });
  document.querySelectorAll("[data-detail-button]").forEach((button) => {
    button.addEventListener("click", () => loadJobDetail(button.dataset.detailButton));
  });
}

function renderDetail(job) {
  const responsibilityItems = job.responsibilities.map((item) => `<li>${item}</li>`).join("");
  const requirementItems = job.requirements.map((item) => `<li>${item}</li>`).join("");
  detail.innerHTML = `
    <article class="job-detail">
      <p class="job-id">DETAIL · ${job.job_id}</p>
      <h2>${job.title}</h2>
      <h3>岗位职责</h3>
      <ol>${responsibilityItems}</ol>
      <h3>任职要求</h3>
      <ol>${requirementItems}</ol>
      <h3>证据追溯</h3>
      <p class="source-path">${job.source_path}</p>
      ${renderExternalSyncEvidence(job)}
    </article>
  `;
}

async function loadJobDetail(jobId) {
  const endpoint = `/api/jobs/${encodeURIComponent(jobId)}`;
  requestLine.textContent = `Request: GET ${endpoint}`;
  detail.innerHTML = '<p class="loading">正在读取职位详情…</p>';

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "request_failed");
    renderDetail(data.job);
  } catch (error) {
    detail.innerHTML = `<p class="error">详情读取失败：${error.message}</p>`;
  }
}

async function updateApplicationStatus(jobId) {
  const select = document.querySelector(`[data-status-select="${jobId}"]`);
  const endpoint = `/api/jobs/${encodeURIComponent(jobId)}/application-status`;
  const payload = { application_status: select.value };
  requestLine.textContent = `Request: POST ${endpoint}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "request_failed");
    await loadJobs();
  } catch (error) {
    results.insertAdjacentHTML("afterbegin", `<p class="error">保存失败：${error.message}</p>`);
  }
}

async function loadJobs() {
  const search = searchInput.value.trim();
  const endpoint = search ? `/api/jobs?q=${encodeURIComponent(search)}` : "/api/jobs";
  requestLine.textContent = `Request: GET /api/jobs${search ? `?q=${search}` : ""}`;
  results.innerHTML = '<p class="loading">正在查询本地数据库…</p>';
  detail.innerHTML = "";

  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "request_failed");
    renderJobs(data.jobs);
  } catch (error) {
    results.innerHTML = `<p class="error">请求失败：${error.message}</p>`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadJobs();
});

loadJobs();
