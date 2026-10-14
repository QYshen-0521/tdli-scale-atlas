# 数据说明

结构化数据放在本目录，图片放在 `public/assets/objects/`。网站通过 `src/content.ts` 直接读取这里的 JSON。

## 文件

- `mentors.json`：导师。`placement` 为 `chart` 的人画在对数图上；`offplane` 的人出现在主页左侧「尺度之外」。
- `objects.json`：天体与系统的尺度–质量坐标、图像和许可。
- `PLACEMENTS.md`：每个坐标为什么落在那里。
- `SOURCES.md`：网页、论文和图像来源。

## 坐标

横轴 `logL` 是长度的常用对数，单位米。纵轴 `logM` 是质量的常用对数，单位千克。

图的数据范围是 L = 10³–10²⁷ m、M = 10¹⁸–10⁵⁵ kg。左缘大约停在 1 公里，是为了放得下中子星，又明确把微米到米的实验室留在图外。右缘停在可观测宇宙外侧一点，不把横轴延长到 10⁴⁰ m。画面上的图框仍是正方形：横轴的像素被拉开，使这块数据占满一个正方形，而不是靠增加空的数量级。

`regions` 用对数坐标写：

- `ellipse`：`cx, cy, rx, ry`，单位是“十倍”（dex）
- `rect`：`logL0, logL1, logM0, logM1`
- `polygon`：`points` 为 `[logL, logM]`

`coverage`：

- `focused`：一块相对清楚的色块
- `wide`：范围较宽，填充更淡
- `broad`：几乎只画虚线。目前只有赖东，因为他的工作从行星一直到大质量双黑洞
- `offplane`：不画区域

这些区域是根据公开研究方向做的判断，不是导师本人画的误差棒。理由见 `PLACEMENTS.md`。

## 论文

`papers` 只收录李政道研究所官方个人主页列出的代表性论文，或主页所给 Inspire 作者记录里能核对到的条目。有 DOI / arXiv 时写入 `url`。没有把握的文献号不编造；页面会用题名打开 ADS 检索。
