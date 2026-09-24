# 武港联投 · 每日每班单机作业量统计（TOS）

PC 端产品 PRD 与 HTML 原型仓库（GitHub Pages 友好）。

## 快速入口

- 原型总入口（选版本）：`prototype/index.html`
- v1.0.0 全量 PC：`prototype/versions/v1.0.0/index.html`
- v1.1.0 企微 H5：`prototype/versions/v1.1.0/index.html`
- v1.1.0 本版 PC：`prototype/versions/v1.1.0/index-pc.html`
- 产品 PRD：`docs/versions/v1.0.0/prd.html` · `docs/versions/v1.1.0/prd.html`

## 在线演示（GitHub Pages）

- 原型总入口：https://liaoliao66.github.io/TOS/prototype/
- v1.0.0 PC：https://liaoliao66.github.io/TOS/prototype/versions/v1.0.0/
- v1.1.0 企微 H5：https://liaoliao66.github.io/TOS/prototype/versions/v1.1.0/

### 每周更新真实演示数据

1. 将**本周新 Excel** 放入仓库 `文件/` 目录（无需覆盖旧文件，可保留历史表）
2. 提交并推送到 `main` 分支：
   ```bash
   git add 文件/你的统计表.xlsx
   git commit -m "data: 新增本周作业统计表"
   git push
   ```
3. GitHub Actions 会自动：
   - 合并 `文件/` 下全部 `.xlsx`
   - 重新生成 `real-work-stat-demo.js`
   - 提交并推送 → Pages 约 1～2 分钟后刷新

也可在 GitHub 仓库 **Actions → 更新演示数据 → Run workflow** 手动触发。

> 若每周 Excel 是**全量导出**（含历史数据），可在本地或 CI 使用 `--latest` 仅取最新文件。

## 本地预览

用浏览器直接打开 `prototype/index.html`，或启用任意静态服务器后访问该路径。

本地生成演示数据：`python scripts/gen_real_demo_data.py`

## 说明

- 当前版本：`v1.0.0`（全量 PC）· `v1.1.0`（企微 H5 + 本版 PC）
- 技术栈：HTML + Tailwind CDN + FontAwesome + 原生 JS
- 不含消息中心 / 审批流 / 权限配置页面（由内部平台承接）
