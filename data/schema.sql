CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT NOT NULL,
    seniority TEXT NOT NULL,
    source_path TEXT NOT NULL,
    source_url TEXT,
    external_source_name TEXT,
    external_job_id TEXT,
    source_title TEXT,
    source_location TEXT,
    source_seniority TEXT,
    raw_capture_path TEXT,
    raw_capture_sha256 TEXT,
    last_successful_fetch_at TEXT,
    responsibilities_json TEXT NOT NULL DEFAULT '[]',
    requirements_json TEXT NOT NULL DEFAULT '[]',
    captured_date TEXT NOT NULL,
    published_date TEXT,
    posting_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (posting_status IN ('unknown', 'open', 'closed')),
    application_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (application_status IN (
            'unknown', 'not_applied', 'applied', 'interviewing',
            'rejected', 'offer', 'withdrawn'
        ))
);

CREATE TABLE IF NOT EXISTS job_analyses (
    analysis_id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(job_id),
    analysis_contract_id TEXT NOT NULL,
    instruction_version TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    model_name TEXT NOT NULL,
    input_raw_capture_sha256 TEXT NOT NULL,
    input_json TEXT NOT NULL,
    output_json TEXT NOT NULL,
    review_status TEXT NOT NULL DEFAULT 'needs_review'
        CHECK (review_status IN ('needs_review', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_note TEXT,
    CHECK (
        (review_status = 'needs_review'
            AND reviewed_by IS NULL
            AND reviewed_at IS NULL
            AND review_note IS NULL)
        OR
        (review_status IN ('approved', 'rejected')
            AND reviewed_by IS NOT NULL
            AND reviewed_at IS NOT NULL)
    )
);
