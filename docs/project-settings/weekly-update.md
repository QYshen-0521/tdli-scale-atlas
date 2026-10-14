# 每周更新

检查时间是每周一 09:00（Asia/Shanghai），GitHub Actions 的 cron 写成 UTC 周一 01:00：`0 1 * * 1`。这是计划触发时间。Actions 拥挤时会推迟，公开仓库长期没有活动也可能停掉定时任务，所以保留手动入口。

## 手动跑

```bash
npm run sync:faculty
```

脚本只抓三个研究部成员页，做结构检查，和已发布数据比较，把报告写到 `proposals/runs/latest/`。它不修改 `data/`。

没有字段变化时，不需要开教师数据 PR。来源返回空页、人数明显变少、出现未完成的分页，或请求失败，这一来源整页停用。缺席只记提醒，不从名录删除。

要把提案写进数据，在单独分支上执行：

```bash
node scripts/sync/apply-report.mjs proposals/runs/latest/report.json
npm run check:data
npm run build
```

看完差异再提交。不要在 main 上直接套用。

## 自动提案

`.github/workflows/faculty-sync.yml` 在周一和手动触发时运行。它先跑 `npm run check:data`。有字段变化才把数据改动推到 `faculty-sync` 分支，并打开或更新同一个 PR。没有变化只保留 Actions 工件里的报告。

PR 使用 `GITHUB_TOKEN`。由机器人打开的 PR，上面的检查工作流有时要人批准才会跑。提案任务自己会在推分支前再跑检查和构建，但不能代替你在 PR 上看到的检查结果。

不自动合并。没人合并时，网站继续用 main 上一次已发布的数据。

## 发布和回滚

仓库的 GitHub Pages 实际来源是 `gh-pages` 分支，不是 `.github/workflows/deploy-pages.yml.disabled` 那种 Actions artifact。那个禁用文件没有启用。

`.github/workflows/publish-pages.yml` 在推到 main 之后构建，并推到 `gh-pages`。合并师资 PR 才会发布。回滚是 revert main 上的那次合并，让发布工作流再跑；`gh-pages` 分支也留着上一版提交。

本地也可以沿用原来的命令：

```bash
npm run deploy
```

## 故障时的预期

`npm run sync:self-check` 单独回放同步故障。`npm run check:data` 也会跑这份自检和名录筛选自检。PR 的 check 工作流两者都跑。覆盖这些情况：

- 页面为空或人数不够：不提出删除
- 分页没完：这一来源失败
- 同一个人的个人页编号变了：记成地址别名，不新建一个人
- 职称变化：一条字段提案
- 一个来源失败：其他来源仍可提案，失败来源里的人不标成缺席
- 名单里不见了：缺席提醒，应用后人还在
- 同样的输入再跑一次：没有新的字段差异
- 自检不改仓库里的 `data/people.json`
