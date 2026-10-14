## 公网地址

- 站点：[https://qyshen-0521.github.io/tdli-scale-atlas/](https://qyshen-0521.github.io/tdli-scale-atlas/)
- 仓库：[https://github.com/QYshen-0521/tdli-scale-atlas](https://github.com/QYshen-0521/tdli-scale-atlas)

推送到 `main` 后，`.github/workflows/publish-pages.yml` 会构建并发布到 `gh-pages` 分支。这是当前 GitHub Pages 的实际来源。`.github/workflows/deploy-pages.yml.disabled` 没有启用。师资变更多走每周待审 PR，合并后才到 main。

# 尺度衡星

李政道研究所天文与粒子天体物理导师的一张对数图。横轴是尺度，纵轴是质量。数据范围是 L = 10³–10²⁷ m、M = 10¹⁸–10⁵⁵ kg，可观测宇宙在右上角；画面上把横轴拉宽，使图框成为正方形，而不是把横轴延长到 10⁴⁰ m。天体带着图像落在自己的位置上；导师的研究画成半透明的区域，头像放在区域边缘，名字在悬停或键盘聚焦时出现。点开头像，进入这位导师的研究、论文和相关天体。

中微子、暗物质粒子和实验室等离子体没有被硬塞进这张图。它们在左侧「尺度之外」。

## 运行

```bash
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:47231 。

生产构建：

```bash
npm run build
npm run preview
```

数据检查：`npm run check:data`。

## 怎么用

- 滚轮：以光标为中心缩放
- 拖拽：平移。触控板可以用双指缩放
- 双击空白，或按 `0`，或点「重置视野」：回到全图
- `+` / `−`：以画面中心缩放；方向键平移
- 点导师的色块或头像：进入详情。`Esc` 或 `Backspace` 返回。头像会移到详情页并放大，返回时沿原路回来
- 点天体：打开说明
- 顶栏可以按行星、致密天体、星系、宇宙学尺度筛选。导师和天体一样：对上的保持原样，其余变淡，不从画面上消失
- 「名录」和尺度图共用同一套筛选，条件写在地址栏里。机构、职级、方向会把人从结果和图层里拿掉。没有已审核尺度标注的人只出现在名录里

页面切换使用 View Transitions API：背景交叉淡化，头像从星图移到详情页并放大，正文同步淡入；返回时反过来。这段飞行沿直线移动，时间上先加速再减速（ease-in-out），时长 1575ms（上一次 1050ms 的速度的 2/3）。伴随的淡入淡出用同一时长。浏览器不支持时，用一段 FLIP 补上同样的位移。系统如果要求减少动效，过渡会关掉。

## 数据

| 路径 | 内容 |
| --- | --- |
| `data/people.json` 等 | 名录、任职、证据、论文和尺度标注。说明见 `data/README.md` |
| `data/coverage/` | 官方候选和逐人收录决定 |
| `data/mentors.json` | 旧的 23 人快照，网站不再直接读它 |
| `data/objects.json` | 天体的对数坐标、类别、图像和许可 |
| `data/PLACEMENTS.md` | 每个坐标为什么在那里 |
| `data/SOURCES.md` | 官网、文献和图像来源 |
| `data/README.md` | 字段说明 |
| `public/assets/objects/` | 已下载的图像。天鹅座 X-1 的图是本站画的 |

导师来自李政道研究所官网 2026 年 10 月的天文与天体物理研究部，以及粒子与核物理研究部里明确做暗物质、中微子天文或粒子天体物理的人。没有编造论文。没有 DOI 的链接会打开 NASA ADS 的题名检索。

坐标是对数米和对数千克。区域是根据公开研究方向画的包络，不是测量误差棒。赖东的范围从行星一直到大质量双黑洞，所以只留一条很淡的虚线，避免挡住太阳和白矮星。

## 视觉

夜空是暖的黑，不是霓虹。导师用朱砂印章，研究区域用矿物色（花青、石绿、赭石、藤黄）区分。参考线只有两条：黑洞视界，和水的密度。中文用衬线，英文用 Fraunces，数字用 Outfit。若字体服务不可用，会退回系统里的中文字体。

导师头像来自李政道研究所官网个人页，文件和来源页记在 `data/SOURCES.md`。照片打不开时退回印章。图框在画面上是正方形：横轴只有 24 个数量级，纵轴有 37 个，所以横轴每一格被画得更宽。右缘就是可观测宇宙附近，没有空的数量级。拖到图框边缘就不能再拖进框外的空白；已经完整出现的那条轴会保持居中。

项目设定和三则方法说明在 `docs/project-settings/`。

## Run in English

A logarithmic scale–mass atlas for astronomy faculty at the Tsung-Dao Lee Institute, Shanghai Jiao Tong University.

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:47231 .

The horizontal axis is length in metres and the vertical axis is mass in kilograms, both logarithmic. The data window is 10³–10²⁷ m by 10¹⁸–10⁵⁵ kg, so the observable universe stays in the upper-right of the plotted content. The on-screen frame is square because length decades are drawn wider, not because the length axis was extended to 10⁴⁰ m. Celestial objects carry photographs. Each mentor with a real astrophysical locus is a translucent region; a circular portrait sits on the edge and the name appears on hover or keyboard focus. Clicking opens a detail page with a shared-element move of that portrait (1575ms, two-thirds the previous speed, straight in space and ease-in-out in time, with the paired fades slowed the same way). Wheel zoom is centered on the cursor; drag pans inside the frame; double-click or `0` resets. Category filters dim non-matching objects as well as mentors.

Neutrinos, dark-matter particles, and laboratory plasmas are not assigned fake coordinates. They are listed in the left margin. Dong Lai’s range runs from planets to massive black-hole binaries, so his region is a dashed outline rather than a filled wash.

Placements are judgments documented in `data/PLACEMENTS.md`. Papers come from official TDLI profile pages or from the Inspire records those pages link. Sources and image licenses are in `data/SOURCES.md`.

The visual language is a warm night sky, cinnabar seals, and mineral pigments — closer to an annotated star chart than to a neon dashboard.

## 已知缺口

- 2026-10-15 的名录范围和仍缺的简介、论文、照片，写在 `docs/project-settings/inclusion-policy.md`。构建通过只说明数据符合检查，不代替那份账。
- 肖像来自官网个人页，版权仍属原机构或拍摄者；不是知识共享许可。新收录的人没有照片，页面用印章。
- Masahiro Ogihara 与 Darius Modirrousta-Galian 的主页没有中文姓名。
- 王界双、葛韶锋的主页没有逐篇列出论文，条目来自他们页面指向的 Inspire。这些旧论文本轮没有逐篇重核。
- 景益鹏主页上的代表论文偏近年；更早的经典工作没有擅自补上。
- 参宿四的半径、球状星团、大麦哲伦云、原行星盘、蟹状星云和可观测宇宙的质量都是量级。
- 季向东的官方方向是核物理与高能物理，没有放入。博士后、工程师和平台学者不在这一版。
