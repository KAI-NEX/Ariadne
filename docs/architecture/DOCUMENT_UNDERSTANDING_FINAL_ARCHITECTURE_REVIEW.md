# Job Radar — Document Understanding Final Architecture Review

Date: 2026-08-24

## CLOSEOUT ADDENDUM — 2026-08-24

The accepted architecture has not changed. The two implementation defects isolated by the frozen blind review have been repaired at the Document Structure / CareerEntity Mapping layer and fixed with real-file regressions.

```text
CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE
NO-MODEL ARCHITECTURE = FROZEN
TARGETED MAPPING FIXES = CLOSED
```

- English CV: `3 WorkExperience / 2 Education / 3 SkillGroup / 2 Language / 3 Award`; explicit award and language names are retained, missing award dates remain null, and all new entities preserve provenance.
- Touchine Portfolio: `MemoryBlock / MUPAHKC / Material Card / Mac Setup / Material Resonance`; category labels remain metadata, actual titles are entity names, pages 1–2 and 10 are not projects, outcomes stay empty, and project/page provenance is retained.
- Regression: the two new frozen real fixtures, Tencent Resume PDF/DOCX, Tencent Portfolio, the 45-page comprehensive Portfolio, CareerEntity, CareerEvidence derivation, duplicate identity/persistence, syntax/contracts, and Phase 3 analysis review all pass.
- Product workflow: a normal isolated-browser review showed only `needs_review` entities, working source selection and provenance expansion, zero auto-confirmed entities, zero derived Evidence, duplicate import `0`, and refresh persistence.

This addendum closes the historical `TARGETED MAPPING FIXES OPEN` state below. It does not reopen or revise the frozen independent blind artifacts.

## A. FINAL ARCHITECTURE VERDICT

**KEEP FROZEN WITH TARGETED FIXES**

冻结的对象是架构边界与生产路径，不是把当前所有映射规则宣布为无缺陷：

```text
SourceDocument
→ usable native blocks first
→ Apple Vision V1 Auto only when native PDF text is unusable
→ conditional GapTree-style order only for OCR multi-column Resume
→ DocumentBlock v1
→ separate Resume / Portfolio structure logic
→ CareerEntity proposal
→ entity-level Human Review
→ confirmed-only CareerEvidence
```

现有证据不支持重新打开 OCR、版面引擎或整体架构。外部盲审确实发现了两个应修复的问题，但证据把它们定位在 Document Structure / CareerEntity Mapping，而不是识别引擎或架构失效。

## B. WHY

决定性证据如下：

- 20 份真实材料、305 页全部执行完成，0 crash；18 份可审核，2 份在无法可靠判断项目边界时安全返回 `needs_manual_selection`。
- 6 份选定 truth 文档 6/6 通过；本轮重新执行的 Python CareerEntity、JavaScript Evidence derivation 与 Phase 3 review regression 全部通过。
- 45 页 `KailongGuo.pdf` 是最重要的独立反证检查：GPT 盲审与 Job Radar 都恢复出完全相同的 5 个项目——MATERIAL RESONANCE、FLAWLESS、HIGH RISE FLOATING ON SUBMERGED、VISUALISATION OF EMOTIONS、SILENT SIGNALS。跨页项目没有被拆碎，未写明的成果保持为空，来源可追溯。
- 10 页 Touchine Portfolio 的盲审恢复 5 个项目，而 Job Radar 只生成 4 个，并把项目名称映射为 CASE 类别标签。原文件仍被完整处理，问题发生在项目边界和标题选择规则，不证明 Apple Vision 或 DocumentBlock 失败。
- image-only English CV 的独立盲审发现 awards 与多组 skills 未进入 Job Radar 实体；但 `VISION_V1_AUTO` 原始 DocumentBlock 已包含 `AWARDS`、London Young Artist、BIM Award、Rhino、Adobe、Grasshopper、Stable Diffusion 等文字。这排除了 OCR 缺失，根因是 Resume document structure / entity mapping coverage。
- Tencent Resume PDF/DOCX 的 Work、Education、Project 身份和数量与盲审一致。主要差异是 skills/languages/custom sections 的分组方式，属于 schema/mapping 选择，不是文档理解崩溃。
- Base Resume 中 OMTECH 与“其他经历”的分类存在真实语义歧义：盲审把短期项目保留为 Project、协会经历保留为 custom/other，Job Radar 将两者计入 WorkExperience。底层记录未丢失，因此这是需要来源语义保留的 mapping 问题。
- Paddle、Surya 与 Docling 没有带来 CareerEntity 可靠性增益；global GapTree 和 blind native/OCR fusion 反而已有回归证据。

可靠性、隐私、运行时、可维护性和诊断性综合看，当前架构仍是证据支持下的最优解。更重的通用解析框架不能修复标题优先级或 CareerEntity 类型映射规则。

## C. WHAT THE BLIND REVIEW DISAGREEMENTS MEAN

| Disagreement | Judgment | Reason |
|---|---|---|
| Touchine 漏掉 Mac Setup | Document Structure / CareerEntity Mapping bug | 其页面被作为 `CURRENT PRODUCT EXERCISE`，现有 Portfolio boundary 规则未把它纳入 Project；不需要更换 OCR。 |
| Touchine 使用 `0→1 PRODUCT` 等 CASE 类别名 | CareerEntity Mapping bug | 系统选择了类别标签而非同一项目内的实际项目标题；项目身份大体仍可对应。 |
| English CV 丢 awards 与大部分 skills | Resume structure/mapping bug | 原始 OCR blocks 已有这些文字；不是 extraction engine 缺失。外部比较把 failure 标成 extraction，但更底层证据支持 mapping diagnosis。 |
| Tencent Resume 的 skills/languages 分组不同 | 小型 schema/grouping 差异 | 核心经历、教育与项目未改变；语言应保留可用名称，skills 分组需要一致规则。 |
| Base Resume 将 OMTECH/协会记为 Work | source semantics + mapping disagreement | 原文位于“其他经历”，且 OMTECH 明示“短期项目”；不能仅凭计数决定唯一真值。 |
| Tencent Portfolio 被标记 `needs_review` | Review calibration | 4 个项目、名称、跨页分组、unknown 与 provenance 均一致；保守审核不是架构失败。 |
| 45 页综合 Portfolio | materially equivalent | 5/5 项目身份一致，是当前 Portfolio architecture 的强正证据。 |

目前没有盲审差异达到“替换 native/Apple Vision/DocumentBlock/分离式 Resume–Portfolio parser”的证据门槛。

## D. REMAINING REAL RISKS

1. Certifications、Publications、Volunteer 与 custom sections 还没有与 Work/Education/Skills/Awards 同等级的稳定实体覆盖；本次只为已证明的 Awards 缺口增加最小支持。
2. Base Resume 中 `其他经历`、`短期项目` 等来源章节仍存在真实语义歧义，后续 mapping 应保留来源语义而不是为满足计数强制分类。
3. 两份外部 Portfolio 仍只能 `needs_manual_selection`。这是安全边界，但也意味着没有可靠项目边界的作品集仍需人工划分项目。
4. 20 份 corpus 中只有 6 份具有冻结 truth；独立 GPT 盲审目前覆盖 8 份，而不是全部 20 份。现有证据足以判断架构，但不足以声称任意作品集都能自动解析。
5. `needs_review` 目前偏保守；若不区分“实体可靠但字段待审”和“项目边界不可靠”，用户审核成本仍可能偏高。

## E. WHAT SHOULD NOT BE DONE

- **PaddleOCR:** 无当前引入理由。代表页更慢、更重，并把 `CASE 01` 识别为 `CASEO1`，没有 CareerEntity 增益。
- **Surya:** 无当前引入理由。额外 VLM runtime 与模型许可边界未产生可比较结果。
- **Docling dependency:** 不应加入生产依赖。可继续参考其 typed IR/provenance 思路，但现有 DocumentBlock 已覆盖当前需要。
- **GPT multimodal production parsing:** 不应作为默认生产 parser。独立审计有价值，但成本、网络、隐私、延迟与结果稳定性不符合当前 local-first foundation；它也不会自动解决本地 schema mapping。
- **RAGFlow replacement:** 无替换理由。其 selective native/OCR pattern 已被吸收，完整替换不会修复当前映射问题。
- **SmartResume replacement:** 无替换理由。其 extraction-type separation、blank missing fields 与 provenance ranges 已作为模式采用。
- **Global GapTree:** 明确不应启用；已使可靠 native Resume 从 5 个 Work 错分为 7 个。
- **Blind native/OCR fusion:** 明确不应启用；已造成重复与 Resume grouping 回归。继续使用 per-page source selection。

## F. TARGETED FIXES, IF ANY

以下是冻结盲审提出的定向事项及最终状态：

1. **Resume type coverage — CLOSED:** 从已有 DocumentBlocks 恢复全部 English CV skill-category blocks、3 Awards 和实际 language names；固定真实回归通过。
2. **Portfolio title resolver — CLOSED:** 同一项目区间优先实际 title，CASE/category label 保存为 metadata；Touchine 五项目固定真实回归通过。
3. **Portfolio boundary rule — CLOSED FOR DEMONSTRATED DEFECT:** 明确 `CURRENT PRODUCT EXERCISE` 恢复为独立 Mac Setup 项目，普通 overview/contact/process pages 未被升级。
4. **Source-section semantics — FUTURE TARGETED IMPROVEMENT:** Base Resume 保留 `其他经历` 与 `短期项目` provenance，不为本轮 closeout 扩大 mapping scope。
5. **Review calibration — FUTURE TARGETED IMPROVEMENT:** 继续保留保守 review；本轮不改 review 状态体系。

这些修复只触及 Resume/Portfolio document-structure 与 CareerEntity mapping 层。不要修改 OCR provider、DocumentBlock contract、存储边界、确认规则或 Evidence derivation。

## G. PRODUCT COMPLETION DECISION

**CAREER DOCUMENT UNDERSTANDING FOUNDATION：完成并继续冻结。**

最终 P4.1 no-model closeout 状态：

```text
CAREER DOCUMENT UNDERSTANDING FOUNDATION = COMPLETE
NO-MODEL ARCHITECTURE = FROZEN
TARGETED MAPPING FIXES = CLOSED
```

这不代表任意文档都能自动解析，也不关闭 D 节的非阻塞限制；它仅表示已证明的 English CV 与 Touchine mapping 缺陷完成修复、回归与真实 Review 验收。P4.2 未启动。

## H. NEXT PRODUCT MILESTONE

在 targeted mapping regressions 通过并完成一次真实 Entity Review 后，下一里程碑应是：

**P4.2 — Evidence-grounded Matching & Application Intelligence**

核心对象应是 `JobRequirement → Confirmed CareerEvidence` 的可解释映射，以及 Supported / Weak / Missing / Unverified，而不是继续扩 OCR 或引入 RAG、MCP、Agent。

## I. LEARNING / CAPABILITY RESULT

### Product Progress

- 建立了 local-first、可追溯、fail-closed 的 Resume + Portfolio ingestion foundation。
- 通过原生文本、选择性 OCR、条件式阅读顺序、DocumentBlock 与 Entity-first review 把失败定位到具体层。
- 外部盲审既提供了 45 页 Portfolio 的强正验证，也发现了两个真实的 mapping coverage 缺陷。

### New Transferable Knowledge

- “文字已识别但实体未生成”是 structure/mapping failure，不应误诊为 OCR failure。
- 项目类别标签、CASE 编号与项目真实名称是不同字段；标题优先级属于 domain semantics。
- fail-closed 是产品可靠性能力，但需要与一般 `needs_review` 分开表达。
- 独立 evaluator 的 failure label 也必须用底层 blocks/provenance 复核，不能当作绝对真值。

### User-owned Evidence

- 用户提供了真实 Resume/Portfolio corpus、隐私边界、Entity-first 目标、失败分层、验收条件与外部盲审材料。
- 用户明确提出用个人真实材料测试通用能力，而不是为单一文件写特例；这是用户拥有的产品判断证据。

### Tool-assisted Implementation

- parser、DocumentBlock adapter、IndexedDB contracts、benchmark harness、regression、Chrome/ChatGPT 审计操作与诊断由 Codex/工具辅助完成。
- 这些产物不等于用户独立编程能力。

### Capability Evidence

- 已形成可迁移的 AI Product 能力证据：能区分 OCR、layout、document structure、entity mapping、review、persistence 与 evidence derivation；能用 corpus、truth、fail-closed、provenance、runtime 和 challenger cost 做架构取舍。
- 尚未形成用户独立实现 OCR/parser 或独立编码的能力证据；当前证据属于架构判断、验收设计和问题分层。
