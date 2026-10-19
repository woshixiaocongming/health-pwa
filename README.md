# 薄肌健康 PWA

纯前端健康记录工具：**大水（饮水）、饮食四餐、运动消耗、睡眠、日/周复盘**。
无后端、无API、无npm、无构建。所有数据只存在浏览器 localStorage 中。
配合手机里任意AI（元宝/Kimi/智谱/ChatGPT）使用：一键把数据整理成提问文本并复制，AI回复可粘贴回导入为明日目标。

## 文件结构

```
health-pwa/
├── index.html          # 首页表盘：摄入单圈热量环/消耗环/目标方向动态卡(减脂·增肌·维持)/连胜/宏量小环/数字周进度行
├── profile.html        # 档案（菜单进入）：输入+保存+使用状态（开始日期/已使用天数/BMR来源），目标方向弹窗
├── water.html          # 大水：侧面人影喝水动画+咕噜音、自定义ml、饮水提示词、提醒兜底
├── sleep.html          # 睡眠=唯一AI入口：概览卡/推荐作息卡/输入/11段提示词(含BMR与推荐时间)/容错解析分发/7天历史
├── eat.html            # 饮食：2×2宫格+饮料格（多层环卡片）+蔬菜纤维追踪卡+高亮解析区+AI评价块
├── move.html           # 运动：自由文本类型+强度、每条AI估算提示词/解析、今日运动目标
├── week.html           # 复盘：日复盘纯数据+选填体重 / 周复盘数字周+体重双线+周分析解析保存
├── data.html           # 数据管理：MD 复制/导入/清空
├── settings.html       # 设置：安装指南、AI服务商、单位、每日自动归档、关于/免责
├── manifest.webmanifest# 含 192/512 PNG 图标
├── sw.js               # Service Worker 离线缓存（v16，激活时强清旧缓存）
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
├── css/style.css       # 苹果健康风深色（#000 + #2C2C2E 卡片 + 模块单色强调）
├── js/
│   ├── calculator.js   # BMR/TDEE/MET/强度MET/目标系数/减脂估算（仅作兜底）
│   ├── storage.js      # localStorage 封装+迁移+目标体系+BMR三源+数字周+周复盘结论+体重同步
│   ├── water.js        # 人影喝水动画 + Web Audio咕噜音 + 提醒兜底
│   ├── sleep.js        # 睡眠页逻辑（概览/历史/AI分块展示/BMR来源行）
│   ├── share.js        # 剪贴板 + AI提示词（睡眠9段/周复盘带体重双线）+ 容错解析
│   ├── exporter.js     # Markdown 复制（今日/本周/本月/全部）
│   ├── menu.js         # 右上角全局菜单（档案/复制子菜单/主题色·背景/使用说明/清空今日）
│   ├── chart.js        # Chart.js 趋势图（数字周横轴 + 体重预估/实际双线）
│   ├── chart.umd.min.js# Chart.js 4.4.3 本地副本（离线可画图表，不再依赖 CDN）
│   └── app.js          # 首页仪表盘 + 提示条 + 自动归档 + 满7天翻周 + SW注册
├── data/prompts/       # 早期AI提问模板存档（现行提示词由 js/share.js 动态生成）
├── scripts/build-www.mjs # 安卓打包用：把网页资源同步到 www/（Capacitor 的 webDir）
├── sell/README.md      # 2元包说明
└── history/            # 决策记录
```

底部 Tab：首页 / 大水 / 饮食 / 运动 / 睡眠 / 复盘（档案从右上角 ≡ 菜单进入）。

## 本地运行

PWA（Service Worker、通知等）要求 http(s) 环境，不能直接双击打开 html。用 Python 起个静态服务器：

```bash
cd ~/Documents/code/health-pwa
python3 -m http.server 8000
```

然后手机/电脑浏览器打开 `http://localhost:8000`（手机需与电脑同一WiFi，访问 `http://电脑IP:8000`）。

手机安装为App：见设置页"安装指南"（安卓菜单 / iOS Safari 分享 → 添加到主屏幕）。

## 打包成安卓 APK（Capacitor）

网页版仍部署在仓库根目录（Vercel 不受任何影响），打包走 `www/` 子目录，两条路互不干扰。

### 环境

| 项 | 值 |
|---|---|
| Node.js | ≥ 20 |
| JDK | **21**，本机路径 `~/jdks/jdk-21.0.12.1+1/Contents/Home`（Temurin 21.0.12.1+1） |
| Android SDK | `~/Library/Android/sdk`（platform 36 + build-tools 35/36；首次构建时 AGP 会自动补装缺失组件，前提是 `licenses/` 已接受） |
| Gradle | 8.14.3，由 wrapper 自动下载，走腾讯镜像 |
| Capacitor | 8.5.3（core / cli / android） |

**JDK 必须是 21**：`node_modules/@capacitor/android/capacitor/build.gradle` 里写死了 `sourceCompatibility = targetCompatibility = 21`；系统默认 JDK 17 太旧，Android Studio 自带的 JBR 25 又超出 Gradle 8.14.3 的支持上限（≤24），两个都不能用，所以要显式指定 JAVA_HOME。

**Gradle 走腾讯镜像**：官方源 `services.gradle.org` 在国内频繁 SSL 中断（曾留下 31MB 的 `.zip.part` 碎片），`android/gradle/wrapper/gradle-wrapper.properties` 已改为镜像 + `-bin` 包 + 120 秒超时：

```properties
distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-bin.zip
networkTimeout=120000
```

AGP 与 androidx 依赖仍走 `dl.google.com`，实测可达；若卡住可换阿里云 maven 镜像（目前未启用）。

### 构建流程

```bash
cd ~/Documents/code/health-pwa
export JAVA_HOME="$HOME/jdks/jdk-21.0.12.1+1/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"

npm install                 # 首次或依赖变动时
npm run build               # 生成 www/（scripts/build-www.mjs）
npx cap sync android        # 把 www/ 拷进 android/app/src/main/assets/public/
cd android
./gradlew assembleDebug     # 调试包
./gradlew assembleRelease   # 签名发布包
```

产物：

- debug：`android/app/build/outputs/apk/debug/app-debug.apk`
- release：`android/app/build/outputs/apk/release/app-release.apk`

> **改完任何网页代码，都必须重跑 `npm run build` + `npx cap sync android` 再构建**，否则 APK 里装的还是旧文件。

`scripts/build-www.mjs` 的复制范围：9 个页面 + `css/`、`js/`、`icons/`、`data/` + `manifest.webmanifest` + `sw.js`；排除 `history/`、`sell/`、`README.md`、`vercel.json`、`node_modules`、`android/` 以及零引用的 `js/camera.js`。脚本自带自检（页面数、体积、是否泄漏 `node_modules`）。

### release 签名

签名配置写在 `android/app/build.gradle` 的 `signingConfigs.release`，密码从 `android/keystore.properties` 读取。**keystore 文件、`keystore.properties`、`local.properties` 三者都绝不入库**（`.gitignore` 已覆盖），密码也不硬编码进任何会提交的文件。

⚠️ **keystore 丢失 = 包名 `com.boji.health` 永久无法覆盖升级**，所有用户必须卸载重装，本机数据全部丢失。务必备份到两处，且密码与 keystore 文件分开存放。

### 与网页版的已知差异

- Service Worker 在 Android WebView 里不生效（注册静默失败），离线能力由本地资源本身提供；**App 内容更新必须重新构建 APK 覆盖安装**
- 无 `Notification` API，喝水提醒自动降级为仅前台提醒
- WebView 不处理 Blob 下载（Capacitor 未注册 `DownloadListener`），所以"导出 Markdown"在网页版和 App 里**统一是复制到剪贴板**：粘贴给 AI 直接用，要留档就粘到备忘录另存为 `.md`，再回 App 内导入
- 浏览器与 App 的 localStorage 互不相通，历史数据不会自动迁移
- 图标与闪屏目前是安卓默认（绿机器人 + 蓝底），只适合私域分发，无法上架应用市场

## 核心公式（写死前端）

- BMR（Mifflin-St Jeor）：男 = 10×kg + 6.25×cm − 5×age + 5；女 = ... − 161
- TDEE = BMR × 活动系数（久坐1.2 / 轻度1.375 / 中度1.55 / 高1.725）
- 热量目标 = AI导入值 > TDEE × 目标系数（减脂0.85 / 增肌1.15 / 维持1.0）
- 运动消耗 = 体重 × MET × 时长(小时)；MET：快走4.0 / 慢跑7.0 / 力量6.0 / 骑行6.5 / 游泳8.0 / 其他5.0
- 今日消耗 ≈ BMR/24 × 已醒小时 + 运动消耗
- 预计减脂(g) = (消耗 − 摄入) × 0.13，负数为增重
- 饮水目标 = AI导入值 > 档案手动 > 体重×35ml > null
- 蛋白目标 = 体重×1.6g（增肌×2.0）；脂肪目标 = 体重×0.8g
- 碳水目标 = (热量目标 − 蛋白×4 − 脂肪×9) ÷ 4（保底50g）
- 三大营养素目标同样遵循：AI导入 > 科学公式

## AI 联动闭环

1. 各页"生成AI提示词"→ 复制格式化文本（含档案与今日数据）
2. 粘贴给手机AI（可附餐食照片）
3. AI 按约定格式返回：
   - 睡眠（唯一目标入口，11段）：`饮水|热量|蛋白|碳水|脂肪|总消耗|运动建议|饮食建议|基础代谢|推荐入睡|推荐起床`
   - 每餐：`热量|碳水|蛋白|脂肪|评价|建议|本餐纤维g|建议每日纤维g`
   - 单条运动：`消耗kcal|评价|建议`
   - 周复盘：分析文字 + 末行 `基础代谢|饮水|热量`（解析器也认带标签写法）
4. "粘贴导入/解析"→ 睡眠结果存入 profile.ai（优先级最高，首页/大水/饮食/运动自动联动），首次AI估算的基础代谢写入 bmrFirstAi；周复盘结果存入 weekReviews，其中基础代谢自动升级为 bmrAuto，饮水/热量只作下周睡眠提示词参考，不直接改每日目标
5. 解析失败时提示正确格式，不写脏数据

## 数据飞轮与数字周（v1.7）

- **核心逻辑**：设置初始数据 → AI动态分析给建议 → 每7天（数字周）AI动态更新 → 数据越滚越准。
- **数字周**：从档案首次保存日（startDate，自动记录、不可手改）起算，每7天一周；满7天自动翻周并把上一周记录整体归档；首页/周复盘显示"第X周·本周第Y天·已使用Z天"，不满7天显示"还需X天解锁完整周复盘"。
- **基础代谢三源**（优先级从高到低）：周复盘解析 bmrAuto > 档案手动 bmrManual > 首次睡眠AI估算 bmrFirstAi > 公式兜底；睡眠页与档案页均展示当前值与来源。
- **睡眠提示词带周结论**：存在周复盘结论时自动附加"根据第X周复盘数据：基础代谢/饮水/热量/建议调整"，否则走首周模式请AI估算基础代谢。
- **体重同步**：档案、日复盘、周复盘共用一份体重与体重历史（setWeight）。
- **体重双线**：周复盘体重图 = 预估线（起始体重−累计预估减脂，虚线）+ 实际线（手动记录，实线圆点）；横轴为数字周的真实日期（MM/DD）。
- **周MD导出**：导出本周 = 数字周报告（周汇总+每日详情+体重趋势+AI周分析），复制后可整份发给AI做更细分析或长期存档。
- **使用说明重写**：首条高亮"数据飞轮"，讲清睡眠为何是基石、理念"让AI帮人健康，人不算公式"、完整七步流程、周MD用途与首周解锁规则。

## v1.8：环组件化 / 目标文案 / 纤维追踪 / 推荐作息

- **RingUI 公共组件**：`RingUI.multi()` 输出"外圈黄色热量进度 + 内圈蛋白蓝/碳水绿/脂肪橙分段"多层环；饮食页早/午/晚餐卡片复用（外圈=本餐占今日热量目标进度），无宏量数据只渲染轨道圆，不画空环。
- **首页摄入环回退**为简洁单圈黄色进度环 + 中心大数字（多层分段环只留在饮食页卡片）。
- **目标方向三套文案**：减脂「今日预计减脂」负值红+"今日超标，明天找回来就好"；增肌「今日预计增肌」正值绿+鼓励语、零值 `0 g` 不带±、缺口红+"今日缺口，注意加餐"；维持「今日热量平衡」灰±值+"今日略有偏差，属正常波动"。
- **蔬菜/纤维追踪**：餐提示词要求AI"如有蔬菜请单独提取膳食纤维克数"并给每日建议克数；饮食页绿边纤维卡展示今日累计与AI推荐值，无数据整卡隐藏；推荐值只来自AI（profile.fiberGoalAi），代码不做推荐计算。
- **推荐入睡/起床**：睡眠页"推荐作息"卡（只读展示+可手动微调），提示词自动带入当前推荐时间并请AI判断是否调整；解析返回新时间即覆盖；优先级 AI解析 > 手动微调 > 首次AI估算 > 默认23:00/07:00，无数据显示默认值不报错。
- SW v9。

## v1.9：环内文字 / 模式实时切换 / 主题色

- **环内营养素文字**：饮食页早/午/晚餐多层环中心叠三行彩色标识（蛋白蓝/碳水绿/脂肪橙），与分段弧同色；无数据时只留轨道圆、不显示文字。
- **目标模式实时切换**：维持标题「今日预计维持 ⚡」；首页监听 pageshow/visibilitychange 重渲染，从档案页（含浏览器后退缓存）返回时模式立即生效，不再沿用旧文案。
- **主题色切换**：≡ 菜单「主题色」六色卡（默认/海蓝/草绿/紫罗兰/樱粉/暖橙），存入设置并记忆；切换后按钮、高亮文字、解析区描边、Tab、大表盘进度环全局同步（默认主题保留各模块专属色）；首页与饮食页不刷新即时重绘。
- SW v10。

## v1.10：背景色切换

- **「🎨 外观」双分区**：≡ 菜单弹窗分「主题色」与「背景」两区；背景卡为对角双色圆点（页面底+卡片色），当前项绿描边高亮，与主题卡风格一致。
- **六套深色背景**：纯黑（默认）/深灰/暗蓝/深紫/护眼暗绿/暖炭，全部深色调、不引入浅色模式；正文对比度 14~21:1 全可读。
- **变量独立**：body[data-bg] 仅覆盖 --bg/--card/--bar（新增磨砂 Tab 变量），与主题色系统正交；语义色与表盘黄/橙不受影响；圆环/卡片/弹窗/Tab 即时换色，meta 状态栏同色，settings.bgTheme 刷新记忆。
- SW v11。

## v1.11：背景预设 3深+3暖浅

- **预设换血**：保留纯黑（默认）/暗蓝/深紫；新增纯白/樱粉/暖橙三套暖调浅色（浅红因六格已满舍去）；正文纯黑、次要文字近黑，对底对比度 17.5~21:1。
- **颜色令牌化**：表面/描边/轨道/表盘/宏量/提示条全部走 CSS 令牌；浅色下自动换一组"深色可读版"语义色（对近白底均≥6:1），圆环、餐卡大数字、状态文字、Chart.js 趋势图同步跟随，绝不发灰发浅。
- **层级与防闪**：背景属性注入 <html>（head 内联脚本首屏前套用记忆，无闪深色），令牌覆盖压过主题/模块色，故浅色下主题色自动取对应深色版；meta 状态栏随浅色同色；bm-bg 事件驱动圆环/卡片/Tab/图表不刷新重绘。
- SW v12。

## v1.12：SW更新提示

- **SW更新提示**：新版本就绪浮出"🆕 发现新版本，点击刷新"，点击发消息让 SW 立即接管并刷新；SW install skipWaiting + message TAKE_OVER。

## v1.13：移除兑换码验证，改为完全免费本地版

- **删除激活门槛**：js/license.js（码表/校验/名额逻辑/全屏激活遮罩）、gen-codes.js（码表生成脚本）、codes-backup.txt（码表备份）全部删除；9 个页面的 `<script src="js/license.js">` 引用与 css/style.css 里的 `.license-*` 遮罩样式一并移除。
- **无任何入口拦截**：打开即用，不再弹兑换码输入框；SW ASSETS 去掉 license.js，缓存升到 v14（激活时强清旧缓存，老用户自动拿到免费版）。
- **保留**：SW 新版本提示按钮、背景预设、所有记录与AI功能，均未改动。
- 全站资源引用统一为相对路径（`./`、`js/…`、`icons/…`），无任何以 `/` 开头的绝对路径，本地双击打开与任意子目录部署都可用。

## v1.14：打赏入口下线 + Chart.js 本地化 + 安卓打包准备

- **打赏功能下线**：删除 `icons/wechat.png`、`icons/alipay.png`（合计 346KB，占打包体积 62%）；`js/menu.js` 移除"❤️ 打赏作者"菜单项、`tipHtml()` 及图片放大/占位逻辑；`css/style.css` 删掉 `.tip-imgs`/`.tip-placeholder`/`.tip-zoom` 共 14 行死样式。菜单其余入口（档案/导出/主题色/使用说明/清空今日）不变。
- **Chart.js 本地化**：`week.html` 从 jsdelivr CDN 改为本地 `js/chart.umd.min.js`（4.4.3，205KB），app 内与线上均离线可画图表；`sw.js` ASSETS 增补该文件，CACHE 升到 v16。
- **安卓打包准备（Capacitor）**：新增 `scripts/build-www.mjs`，把 9 个页面 + `css/`、`js/`、`icons/`、`data/` + `manifest.webmanifest` + `sw.js` 同步到 `www/`，排除 `history/`、`sell/`、`README.md`、`vercel.json`、`node_modules` 与零引用的 `js/camera.js`。Capacitor 的 `webDir` 指向 `www/` 而非项目根，避免把 `node_modules/` 和 `android/` 复制进 assets；Vercel 部署仍走根目录，完全不受影响。`www/` 是生成物，已 gitignore。

## v1.15：导出功能改为剪贴板复制（WebView 不支持 Blob 下载）

- **原因**：Capacitor 8.5.3 的 Android WebView 没有注册 `DownloadListener`，`Blob` + `URL.createObjectURL` + `a.download` + `a.click()` 在 app 内点击**完全无反应**（已实机确认）。原来的"导出 Markdown"在 APK 里是个死功能。
- **改法**：`js/exporter.js` 删除 Blob 下载实现，改为把 MD 文本复制到剪贴板，两级兜底：`navigator.clipboard.writeText` → 失败后隐藏 textarea + `document.execCommand('copy')`（与 `js/share.js` 同一套已验证模式）。实测真实点击下异步 Clipboard API 会抛 `NotAllowedError`，正是 `execCommand` 兜底把内容救回来的。`buildMarkdown()` 一行未改，MD 文本格式与之前完全一致，导入解析器不受影响，复制出来的内容仍可原样导回。
- **覆盖 4 个入口**：右上角菜单的今日/本周/本月 + 数据管理页的全量导出。菜单父级与三个子项文案改为「📋 复制 ▸ / 复制今日 / 复制本周 / 复制本月」；数据管理页按钮改为「📋 复制 Markdown」，新增 `#exportStatus` 成功/失败反馈（连点用 `clearTimeout` 防止提示被上一次的定时器提前清空）。
- **`toast()` 加可选时长**：`toast(msg, duration)`，默认仍 2000ms，复制成功那条传 4000ms；其余调用方不传第二参，行为不变。
- **复制逻辑必须内置在 exporter.js**：`index.html`/`data.html`/`profile.html`/`settings.html` 这 4 个页面没有加载 `js/share.js`（实测 `typeof Share === 'undefined'`），而全局菜单在 9 个页面都存在，所以不能调全局 `Share.copyText`。
- **缓存 v15 → v16**：这一步不只是让老用户拿到新版。因为 `Exporter.download` 已被删除，若 SW 继续用 v15 缓存里的旧 `data.html`（仍调 `download`）搭配新 `exporter.js`，点导出会直接抛 `Exporter.download is not a function`；`sw.js` 激活时 `if (k !== CACHE_NAME) return caches.delete(k)` 整体换新才能避开这个破损中间态。
- **用户侧代价**：不再自动落盘、没有文件名。要留档得粘到备忘录另存为 `.md`；要导回 app 必须先有真实文件，再走"数据管理 → 导入"。

## 全局菜单与每日节奏（v1.4）

- 每页右上角 ≡ 菜单：复制今日 / 复制本周 / 复制本月 / 主题色与背景预设 / 使用说明 / 清空今日记录（二次确认，不动档案与AI目标）。
- 每日自动归档（设置页开关，默认开）：隔天打开自动把昨日记录标记为已归档；20:00 后首页显示橙色复盘提示条，可一键清空或关闭（当日不再提示）。
- 大水页点人影 +10ml（水杯倾斜动画 + 合成咕噜音），底部输入任意 ml 执行幅度随水量的喝水动画。

## 睡眠与AI判断原则（v1.5/v1.6）

- **睡眠页是唯一AI入口**：记录睡眠后生成11段提示词（饮水|热量|蛋白|碳水|脂肪|总消耗|运动建议|饮食建议|基础代谢|推荐入睡|推荐起床，总消耗强制含基础代谢），解析器容错（换行/分号/单位/标签/关键词/时间识别），结果自动分发到饮水/饮食/运动/首页消耗卡与推荐作息。
- **代码只做数据传递和展示，所有健康判断交给AI**：不存在任何"睡眠×系数=消耗"或硬编码健康规则；唯一代码判断是昨晚睡眠<6h 时的紫色UI提醒条。公式仅作为无AI数据时的兜底估算。
- 档案页负责输入、保存与使用状态展示；日复盘纯数据+选填体重；周复盘解析AI周分析并保存（基础代谢自动更新，其余只作参考）。
- 凌晨跨天自动重载重置今日记录（目标与档案保留）。
- 苹果健康风深色：纯黑背景 + #2C2C2E 卡片 + 模块单色强调（水蓝/饮食黄/运动橙/睡眠紫/全局绿）。

## 已知限制

- localStorage 上限约 5MB，照片已压缩（800px/JPEG 0.7），仍建议定期在"数据管理"复制备份
- 喝水提醒：HTTPS（或 localhost）下可申请系统通知；纯 HTTP 部署仅"前台提醒"（页面打开时每小时弹提示），UI 中已如实说明
- Chart.js 已本地化（`js/chart.umd.min.js`，205KB），离线也能画周复盘图表，不再依赖 CDN
- 打包成安卓 APK 后 Service Worker 不生效（Android WebView 不支持），离线能力由本地资源本身提供；更新内容需重新构建 APK 覆盖安装
- WebView 无 `Notification` API，"每小时喝水提醒"在 app 内自动降级为仅前台提醒（页面打开时弹提示），UI 中已如实说明
- 旧版本数据（meals字符串/exercise结构）在首次打开时自动迁移为新结构

## 免责声明

个人记录工具，不替代医生诊断。所有计算仅为一般性参考估算，不构成医疗建议。
