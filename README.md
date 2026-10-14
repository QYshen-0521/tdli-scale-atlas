# 尺度衡星

李政道研究所天文与粒子天体物理导师的一张对数图。横轴是尺度，纵轴是质量。天体带着图像落在自己的位置上；导师的研究画成半透明的区域，印章和名字放在区域边缘。点开印章，进入这位导师的研究、论文和相关天体。

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
- 点导师的色块或印章：进入详情。`Esc` 或 `Backspace` 返回
- 点天体：打开说明
- 顶栏可以按行星、致密天体、星系、宇宙学尺度淡化其他人

页面切换使用 View Transitions API（Chrome、Edge、Safari 新版本）。不支持时，详情页用一段短的淡入。系统如果要求减少动效，过渡会关掉。

## 数据

| 路径 | 内容 |
| --- | --- |
| `data/mentors.json` | 23 位导师：职务、研究方向、论文、图上的区域 |
| `data/objects.json` | 天体的对数坐标、图像和许可 |
| `data/PLACEMENTS.md` | 每个坐标为什么在那里 |
| `data/SOURCES.md` | 官网、文献和图像来源 |
| `data/README.md` | 字段说明 |
| `public/assets/objects/` | 已下载的图像。天鹅座 X-1 的图是本站画的 |

导师来自李政道研究所官网 2026 年 10 月的天文与天体物理研究部，以及粒子与核物理研究部里明确做暗物质、中微子天文或粒子天体物理的人。没有编造论文。没有 DOI 的链接会打开 NASA ADS 的题名检索。

坐标是对数米和对数千克。区域是根据公开研究方向画的包络，不是测量误差棒。赖东的范围从行星一直到大质量双黑洞，所以只留一条很淡的虚线，避免挡住太阳和白矮星。

## 视觉

夜空是暖的黑，不是霓虹。导师用朱砂印章，研究区域用矿物色（花青、石绿、赭石、藤黄）区分。参考线只有两条：黑洞视界，和水的密度。中文用衬线，英文用 Fraunces，数字用 Outfit。若字体服务不可用，会退回系统里的中文字体。

官网肖像没有放进仓库。那些照片的授权范围不清楚，用印章代替，避免一张假的脸。

## Run in English

A logarithmic scale–mass atlas for astronomy faculty at the Tsung-Dao Lee Institute, Shanghai Jiao Tong University.

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:47231 .

The horizontal axis is length in metres and the vertical axis is mass in kilograms, both logarithmic, from about a kilometre (neutron-star radii) to the observable universe. Celestial objects carry photographs. Each mentor with a real astrophysical locus is a translucent region; a seal and name sit on the edge. Clicking opens a detail page. Wheel zoom is centered on the cursor; drag pans; double-click or `0` resets.

Neutrinos, dark-matter particles, and laboratory plasmas are not assigned fake coordinates. They are listed in the left margin. Dong Lai’s range runs from planets to massive black-hole binaries, so his region is a dashed outline rather than a filled wash.

Placements are judgments documented in `data/PLACEMENTS.md`. Papers come from official TDLI profile pages or from the Inspire records those pages link. Sources and image licenses are in `data/SOURCES.md`.

The visual language is a warm night sky, cinnabar seals, and mineral pigments — closer to an annotated star chart than to a neon dashboard.

## 已知缺口

- 没有使用官方肖像。
- Masahiro Ogihara 与 Darius Modirrousta-Galian 的主页没有中文姓名。
- 王界双、葛韶锋的主页没有逐篇列出论文，条目来自他们页面指向的 Inspire。
- 景益鹏主页上的代表论文偏近年；更早的经典工作没有擅自补上。
- 参宿四的半径、球状星团、大麦哲伦云、原行星盘、蟹状星云和可观测宇宙的质量都是量级。
- 钱列加、盛政明、黄小军等实验室同事，以及博士后，没有逐一做页面。季向东的公开方向写作“粒子物理”，未放入。
