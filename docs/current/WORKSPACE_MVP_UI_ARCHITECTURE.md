# Job Radar｜基础工作台 UI 架构（MVP）

> Historical implemented-UI reference only（2026-08-25 closeout）：本文件的“下一阶段”已失效。当前唯一 next milestone 是 `STEP 1 — ONE REAL RESUME / CANDIDATE IMPORT + HUMAN CALIBRATION`；不得由此跳到 Job Import、Match 或 Architecture redesign。最高 authority：`../architecture/PRODUCT_ARCHITECTURE_V2_FINAL_CONSOLIDATION.md`。

状态：已实现首版入口与卡片视图（2026-08-25）  
范围：浏览器本地数据；不新增 Provider 调用，不上传材料，不改变已确认的 Career Model。

## 结论

用户提出的四类界面是必要的，但它们不应是四个平行页面。更可靠的 MVP 是一个统一工作台，下面连接三个正式对象：职业材料、AI 职业上下文和已审核职位。AI 不拥有事实，只提交可审核提案。

```text
原始简历 / 作品集 ──> Material Card ──> AI Context Card ──> 人工确认
                                  │                 │
                                  └──── 来源与版本 ─┴──> Confirmed Career Model

JD 链接 / 原文 / 截图 ──> Job Intake ──> Reviewed Job Card

Confirmed Career Model + Reviewed Job Card ──> Match / Application（后续）
```

## 已落地的界面职责

| 界面 | 路径 | 职责 | 关键边界 |
|---|---|---|---|
| 职业申请工作台 | `/workspace.html` | 看见材料、AI 提案、职位卡片与下一步 | 只读本机数据；不做模型调用 |
| 加载简历与作品集 | `/career-evidence.html` | 保存职业材料、明确同意后请求 AI、编辑/确认返回 | 原文件先保留；AI 结果必须确认 |
| 加载职位 | `/local-first.html` | 从链接、文字、截图创建待审核岗位 | 候选不是正式职位 |
| 我的职位 | `/local-jobs.html` | 浏览与编辑已审核 Job Card | 只显示浏览器本地已确认记录 |

## 本次优化

1. 新增统一入口 `workspace.html`：材料、AI、职位三列卡片与基于当前数据的“下一步”。
2. 把页面术语改为用户任务语言：加载简历与作品集、加载职位、AI 工作区。
3. 将 Job intake 与 Job card 页的 IndexedDB 版本从 `2` 升至 `7`，补齐同一数据库中的 store 创建路径；避免先打开职业材料页后，旧页面再以较低版本打开数据库的兼容风险。
4. 保持旧流程和旧数据不变：没有自动生成 CareerEvidence、没有从 SQLite 复制职位到浏览器、没有触发 API/Provider。

## 当前验收标准

- 没有材料时，工作台只提示“加载材料”。
- 有 AI `needs_review` 记录时，工作台明确显示“需要你的审核”。
- 仅 `accepted` 的 AI 上下文显示“已确认”；二者不混淆。
- 没有浏览器已审核职位时，工作台不把 SQLite 中的演示岗位伪装为“我的职位”。
- 三个卡片入口都能回到负责编辑/审核的原页面。

## 已失效的旧下一阶段（仅历史记录）

在一个用户选择的、已审核职位详情中，以已确认 Career Model 为输入，先展示 Requirement Card、Match Judgment 与 Difference / Action；不做通用分数，也不直接改写简历原文件。
