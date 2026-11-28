# @haiyue/ui 技术债与架构审查

- 审查日期：2026-11-24。
- 版本：`0.3.0`，提交 `2389dcd044f791df41df8d96cc21284ac3f39ed7`。
- 范围：`src/`、相关单元/浏览器测试、包出口与发布脚本、主题和架构文档。重点为组件质量、状态契约、交互、架构边界与可验证的性能优化。
- 方法：使用已安装并适配 Codex 的 `tech-debt-audit`；先读取 `AGENTS.md`、README、ADR 和 Git 历史，再分组静态审阅与独立运行时探查。初审仅新增报告，后续修复范围见跟进记录。
- 结论分为已复现缺陷与优化机会。严重程度依据实际影响；S/M/L 为相对改动与验证成本，不是工期承诺。

## 高优先级修复跟进（2026-11-24）

| 项目 | 状态 | 实施结果 |
| --- | --- | --- |
| F01 | RESOLVED | 新增私有 `internal/keyboard.ts`，按 composed path 识别嵌套控件；Tree/Draggable/Resizable 保留子控件的编辑键与已消费事件。Resizable 键盘移动遵守 movable=false，调整手柄仍可使用。 |
| F02 | RESOLVED | Tree/Dropdown/ContextMenu 由 attributeChangedCallback 处理数据属性，不再在连接时覆盖当前数据。保留声明式初始化、后续 attribute 更新/删除、重连数据和 Tree 多选属性优先级。 |
| F03 | RESOLVED | Upload 在接受文件批次或完成移除并同步 FormData 后发送一次 bubbling/composed change，原生 picker 的提前 input 不再冒泡给字段监听。既有 Form/FormItem 因此中止旧校验、拒绝旧提交；上传进度/完成仍不视为字段值编辑。 |

公开面决策：Upload 的字段编辑复用标准 `change` 事件，已写入 README 并覆盖选择、拖放、异步接受、移除、替换、拒绝和进度。新增键盘辅助模块保持私有；公开出口基线仍为 73 个入口。

新增 18 项行为回归位于 `test/browser/high-priority-regressions.spec.mjs` 与配套 HTML。包预算按共享辅助模块的两个发布文件和实际体积重新登记，增长余量保持 3,000 B packed / 12,000 B unpacked / 4 文件。

跟进验证全部通过：`npm run typecheck`、`npm test`（含构建，124/124）、`npm run build`、`npm run api:check`（73 个入口）及发布包校验。Chromium 全库 256/256；最后保留选择属性优先级后，重新构建并重跑定向用例 18/18。WebKit 首轮 17/17，最终 Tree 相关 4/4 复测覆盖新增优先级用例，共覆盖全部 18 项新增回归。

最终包：303,286 B packed、1,358,921 B unpacked、210 文件；Button 独立消费者 gzip 保持 1,950 B。验证日志为 `.artifacts/tech-debt-audit/high-priority-*.log`，最终包指标见 `.artifacts/package-check.json`。

以下保留初审基线、原始定位与其余问题；原有 16 Medium、4 Low 已完成本轮修复，见下方剩余项跟进。

## 剩余项修复跟进（2026-11-24）

F04–F23 均已实施。以下记录当前实现；后文保留初审位置和复现数据，便于追溯。

| 项目 | 状态 | 实施结果与当前代码 |
| --- | --- | --- |
| F04 | RESOLVED | `src/internal/numbers.ts:2` 统一缺省/空字符串/非有限值解析，保留显式 0 与各控件范围；Toast、Notification、Watermark、Table、Tour、Tooltip、Anchor、VirtualMouse、BorderBeam 使用该工具。Table 删除 page-size 恢复默认 10。 |
| F05 | RESOLVED | `src/internal/focus.ts:7` 提取既有 Modal 的 composed-tree 遍历，Drawer 共用，涵盖插槽、ShadowRoot、禁用/隐藏/inert 与反向 Tab。 |
| F06 | RESOLVED | `src/cascader.ts`、`src/date-picker.ts`、`src/time-picker.ts` 禁用时关闭面板并拦截旧提交；`src/input.ts` 搜索按钮和事件遵循 fieldset 有效禁用状态。 |
| F07 | RESOLVED | `src/radio.ts` 选中新项时也清除同组禁用项的 checked，保留表单/根作用域隔离。 |
| F08 | RESOLVED | `src/dialog.ts` 断开时释放原生模态状态、重连时恢复；会话状态隔离排队 close，先完成关闭再发一次事件，支持同步重新打开与关闭监听重入。 |
| F09 | RESOLVED | `src/anchor.ts` 原位更新 active/aria-current/标签；`src/table.ts` 原位更新表头状态；`src/virtual-list.ts` 按绝对索引复用重叠行，仅移除退出窗口的行，焦点行退出时回到视口。 |
| F10 | RESOLVED | `src/table.ts` 向分页、渲染和事件传递同一次派生结果。无跨操作持久缓存，外部记录及闭包变化仍对公开 getter/后续操作可见。 |
| F11 | RESOLVED | `src/tree-model.ts:116` 按父列表分组、原位压缩批量删除并一次失效索引；`src/tree.ts` 一次发送删除事件；批量可见插入改为索引复制，消除大数组 spread 的参数限制。 |
| F12 | RESOLVED | `src/virtual-keyboard.ts:1` 用 Intl.Segmenter 处理字素边界，覆盖前后删除、方向键与选区；限定支持 selection API 的 input 类型，统一禁用/只读编辑检查。 |
| F13 | RESOLVED | `src/tour.ts` 保持高亮目标可交互的非模态契约，移除不成立的 aria-modal 声明；README 明确该行为。 |
| F14 | RESOLVED | `src/tooltip.ts:243` 在真实触发目标所在树中建立可访问描述代理，合并而不覆盖应用的描述；同步关闭隐藏语义，Escape 清理待显示计时器，禁用/换槽/断开清理代理。 |
| F15 | RESOLVED | `src/adapters/web/controls.ts` RadioGroup 使用单一 Tab 停靠点，方向键/Home/End 跳过禁用、环绕、遵循 RTL；所有选择通过控制器并恢复被拒绝的受控值；重排保留原生节点与焦点。 |
| F16 | RESOLVED | `src/core/semantics.ts` 与 `src/adapters/web/renderer.ts` 对 kind 作穷尽映射；Checkbox/RadioGroup/Rate 参与初始焦点，Rate 描述/错误关联真实 slider，聚焦函数进入 ShadowRoot。 |
| F17 | RESOLVED | `src/portable/page.ts:104` 绑定目标仍为上次应用节点时沿用该 binding 的 equal；外部 setProps/render 仍使复用路径失效。 |
| F18 | RESOLVED | `src/core/data.ts` 描述符安全快照，拒绝访问器、不可枚举字段、符号、稀疏/扩展数组；`src/core/validation.ts:93` 在同一不可变数据上校验 props、元数据和 capabilities；控制器存储该已接受快照。 |
| F19 | RESOLVED | `scripts/api-surface.mjs` 门禁 v2 比较公开入口可达的规范化声明，包含接口/联合/参数等形状，排除私有实现成员；临时副本契约测试证明 event detail 和重导出接口变化被拒绝，私有字段变化通过。 |
| F20 | RESOLVED | `src/core/platform-view.ts:22` 初始化与清理同时失败时 AggregateError 保留两个原始异常和初始化 cause。 |
| F21 | RESOLVED | `src/portable/page.ts:68` 使用事务局部可变 Map draft，每层首次写入复制；嵌套成功合并、失败恢复，保留之前快照、最终无变化静默和 fault/rebuild 行为。 |
| F22 | RESOLVED | README、`docs/portable-ui.md`、`docs/web-adapter.md` 更新为当前 23 种语义、11 类复用控件，补全映射，保留历史 18 种示例语境；`test/portable/documentation.test.mjs` 将计数绑定到 catalog 与实际注册函数。 |
| F23 | RESOLVED | `src/tour.ts` 打开时空步骤走 programmatic close/teardown；延迟聚焦检查连接/打开状态，释放观察器、文档监听与帧请求。 |

公开面决策：不新增公开入口/导出；数值默认、`dialog-close` 同步一次通知、Tour 非模态、Tooltip 描述关系、VirtualKeyboard 支持类型与字素行为、VirtualList 焦点退出策略及纯数据协议限制已写入 README。声明签名基线显式升级到 v2，仍为 73 个类型化入口。三份新增辅助模块保持私有。

本轮最终验证全部通过：

| 检查 | 结果 |
| --- | --- |
| 类型与构建 | `npm run typecheck`、`npm test` 中的最终构建通过；包含无 DOM portable 类型检查 |
| Node | 138/138，通过且无跳过，含新增数据边界、比较器、嵌套事务、焦点、错误诊断和声明门禁回归 |
| 组件库 Chromium | 全套 274/274；最后保留 Table 无参生命周期调用兼容性后，9/9 表格相关用例复测通过 |
| 新增组件 WebKit | 17/17；最终 Table 和 Tour 属性清空回归分别 1/1 复测通过 |
| Web 适配层 | Chromium 32/32、WebKit 32/32，共 64/64；包含新增 5 项跨浏览器交互/焦点/无障碍回归 |
| API | 73 个入口声明门禁通过；声明基线 schemaVersion=2 |
| 发布包 | `scripts/verify-package.mjs` 通过；零 runtime/peer/optional 依赖，独立子路径与 Button 消费者隔离保持 |
| 示例站与补充检查 | `npm run check:pages` 验证 7 个页面；`git diff --check` 通过 |

性能回归实测：Table 对 1,000 条记录每次翻页/排序只调用 1,000 次活动筛选回调（初审为翻页 6,000 次）；1,001 节点页面一次事务中 100 次修改，只复制 Map 1 次/1,001 项（初审 100 次/100,100 项），最终提交 1 个 mutation。Tree 15 万子节点的折叠分支移动通过，无 spread 参数溢出。以上是操作计数和正确性证据，不是延迟基准。

最终包为 309,844 B packed、1,381,858 B unpacked、216 文件；Button 独立消费者 gzip 保持 1,950 B。新增三份私有辅助模块增加 6 个 JS/声明文件，容量登记保留原有 3,000 B / 12,000 B / 4 文件余量。日志见 `.artifacts/tech-debt-audit/remaining-*.log`，测量见 `remaining-transaction-measurement.json` 与 `.artifacts/package-check.json`。

## 摘要（初审）

1. 初审确认三个 High 问题：嵌套编辑器的键盘事件误删 Tree 数据、连接/重连覆盖 Tree 与菜单的数据，以及 Upload 与表单异步校验脱节；三项均已在上述跟进中解决。
2. 当前架构边界有明确用途：独立 Web Components、无 DOM 的 core/portable、独立 Web 适配器均应保留。101 个源码模块的静态本地依赖图（包含类型依赖）未发现循环依赖。
3. 多个组件对缺省数值属性处理不一致，实际造成 Toast 不自动消失、默认只保留一条，Watermark 不可见，Table 每页只有一条。这适合通过小型内部解析工具和缺省值契约测试集中解决。
4. Shadow DOM 下的事件目标与焦点遍历是共同薄弱点。Drawer、Tree、Tooltip、Tour，以及 portable 新语义控件都有具体可复现问题。
5. 性能优化首先落在数据派生与批量操作：1,000 条记录的 Table 翻页一次触发 6,000 次筛选回调；Tree 连续删除反复重建索引。两者都有局部改进路径。
6. API 门禁只记录导出名称和 value/type 类别，无法阻止成员签名、事件 detail 类型等未经审查的变更；临时副本实验同时通过了当前 API 门禁和 TypeScript 检查。
7. 现有自动化检查均通过，但未覆盖上述边界。`test/ui-surface.test.mjs` 中有 37 次读取源码进行断言的检查；它们适合验证结构规则，还需要行为契约测试补足。
8. 本次记录 23 项：3 High、16 Medium、4 Low；其中 F10、F11、F21 为有测量依据的优化机会。未发现 Critical 项。

## 当前架构模型

传统组件位于 `src/*.ts`，以 `HTMLElement`、Shadow DOM 和原生控件实现展示与本地交互。每个组件有独立子路径和显式注册函数；`src/index.ts` 是有意加载全套组件的根入口。主题通过继承的 `--hy-*` 语义 token 输入，组件不依赖 Engine、Editor 或产品 store。表单参与由 `internal/form-control.ts` 与 ElementInternals 支撑，部分复杂组件的非表单参与是已记录的范围选择。

第二条路线是 `core` 的数据协议、验证和行为控制器，`portable/HYPage` 的受控页面、事务、订阅和差异提交，以及 `adapters/web` 的 DOM 映射与资源生命周期。适配器在同包内部复用已有控件；读取 open ShadowRoot 是 G05 ADR 接受的实现方式。这里的问题主要是新增语义控件没有同步补齐所有交互映射，以及个别状态与缓存契约执行不一致。

| 观测 | 结果 |
| --- | --- |
| 源码 | 101 个 TypeScript 模块，19,026 行；其中 vendored QR 编码器 833 行 |
| 测试 / 脚本 / 主题 | 6,488 / 331 / 194 行 |
| 公开类型化入口 | 73 个，其中独立组件子路径 69 个 |
| 较大源码 | Tree 995 行、Table 712 行、根入口 582 行、Cascader 471 行；大小只作为调查线索 |
| 近六个月变更热点 | `test/ui-surface.test.mjs` 24 次，`src/index.ts` 20 次，`src/tabs.ts` 12 次 |
| 依赖图 | 静态相对 import/export 图无循环；不代表对任意运行时动态加载作保证 |

完整前 20 个大文件与变更热点在 `.artifacts/tech-debt-audit/orientation.json`，依赖图统计在 `module-graph.json`。

## 问题与优化清单

“已复现”指使用当前构建产物进行 Node 或 Chromium 探查；不是只根据命名、行数或搜索命中推断。位置对应上述审查提交。

| ID | 类别 | 代码位置 | 严重程度 | 成本 | 结论、触发与影响 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| F01（RESOLVED） | 交互 / 数据正确性 | `src/tree.ts:721`、`:736`、`:876`；`src/draggable.ts:132`；`src/resizable.ts:269` | High | S–M | 已复现：在 Tree 自定义渲染器的 Shadow DOM 输入框按 Backspace，选中节点被删除；Draggable/Resizable 会把子输入的方向键当作容器移动。Resizable 键盘移动还忽略 `movable=false`。 | 从 `composedPath()` 判断真实编辑/交互目标，尊重已消费事件；键盘路径使用与指针路径相同的移动权限。 |
| F02（RESOLVED） | 状态 / 生命周期 | `src/tree.ts:194`、`:325`、`:331`；`src/dropdown.ts:69`、`:143`；`src/context-menu.ts:58`、`:121` | High | S–M | 已复现：挂载前赋给 Tree.data、Dropdown.items、ContextMenu.items 的一项数据在 append 后变成零项。Tree 重连还会清空属性赋值的数据，或重读旧 JSON 覆盖后续编辑。 | 区分首次属性初始化、程序赋值和真实 attribute 变化；重连保留当前状态。 |
| F03（RESOLVED） | 表单 / 异步正确性 | `src/upload.ts:69`、`:137`、`:159`、`:178`；`src/form-item.ts:134`；`src/form.ts:73` | High | M | 已复现：原生文件 input 在接受文件前触发表单校验，选择成功后仍显示 required 错误；拖放不触发 change 校验；异步校验期间移除文件，旧校验通过后仍可提交已变更的空 FormData。 | 在文件成员变化提交后发送统一字段编辑事件；Form/FormItem 用它使校验失效和更新 revision，排除提前冒出的原生 file-input 事件。 |
| F04（RESOLVED） | 一致性 / 缺省值 | `src/toast.ts:47`、`:129`、`:133`；`src/notification.ts:237`；`src/watermark.ts:3`；`src/table.ts:62`、`:431`；`src/tour.ts:116`；`src/tooltip.ts:148` | Medium | S–M | 已复现：`Number(null)` 被当作合法 0，绕过 fallback。Toast 默认 duration=0/maxCount=1，Notification duration=0，Watermark opacity=0，Table 接入后 pageSize=1；Tour/Tooltip 等亦受影响。 | 内部解析先处理缺省/空值，保留显式 0，再作有限值与范围检查；按组件声明测试无属性、移除属性、0、非法值。 |
| F05（RESOLVED） | 焦点 / 无障碍 | `src/drawer.ts:9`、`:354`、`:361`、`:366` | Medium | M | 已复现：Drawer 只枚举 light DOM 原生控件；包含 hy-input/hy-button 时焦点列表只剩关闭按钮，真实 Tab 连续停留在关闭按钮，无法进入内容。 | 抽取 slot/ShadowRoot 感知的内部焦点遍历；过滤不可见、inert、disabled 目标。可参考已有 Modal 实现。 |
| F06（RESOLVED） | 禁用状态一致性 | `src/cascader.ts:324`、`:374`、`:394`；`src/date-picker.ts:162`、`:210`；`src/time-picker.ts:132`、`:156`；`src/input.ts:213`、`:218`、`:269` | Medium | S–M | 已复现：打开选择面板后禁用 Cascader/DatePicker/TimePicker，仍可点击选项改值；disabled fieldset 中 HYInput 的输入框禁用，搜索按钮仍可发送 search。 | 统一 effective-disabled 判断，覆盖面板、附加按钮与最终提交入口；禁用时关闭或冻结已打开交互。 |
| F07（RESOLVED） | 单选契约 | `src/radio.ts:209`、`:216` | Medium | S | 已复现：已选但禁用的 radio A 被排除在互斥处理外，选 B 后两者仍 checked；重新启用 A 后 FormData 含同名两个值。 | 保持同名、同 form/root 的边界，但取消选中时不排除 disabled 同组成员。 |
| F08（RESOLVED） | 模态生命周期 | `src/dialog.ts:119`、`:159`、`:188` | Medium | S–M | 已复现：showModal 后移除并重新插入 host，host.open/native.open 都为 true，但原生 dialog 已不在 `:modal` 顶层；背景模态隔离丢失。 | 断开时释放原生模态并保留 host 打开意图；重连重新进入模态，按会话过滤迟到 close 事件。 |
| F09（RESOLVED） | DOM 身份 / 焦点 | `src/anchor.ts:78`、`:156`、`:245`；`src/table.ts:359`、`:443`、`:486`；`src/virtual-list.ts:317`、`:334`、`:362` | Medium | M | 已复现：Anchor 活跃项改变重建链接；Table 键盘排序重建表头后焦点落到 BODY；VirtualList 仅滚动一行，也销毁仍在窗口中的已聚焦行与自定义状态。 | 原位更新 active/ARIA；保留表头按钮；虚拟列表按稳定身份复用重叠窗口内的行，并定义真正淘汰行的焦点策略。 |
| F10（RESOLVED） | 性能优化机会 | `src/table.ts:378`、`:620`、`:628`、`:660`、`:667`、`:691` | Medium | M | 已测量：1,000 条记录翻页一次调用筛选回调 6,000 次。页数、clamp、渲染、分页器和事件 detail 分别重做完整过滤/排序。 | 每个状态 revision/渲染批次只生成一次 processed snapshot，由它派生总数、当前页与事件 detail。 |
| F11（RESOLVED） | 性能优化机会 | `src/tree.ts:912`、`:916`；`src/tree-model.ts:112`、`:119`、`:316` | Medium | M | 已测量：多选删除每次 removeNode 都使索引失效，下次删除又重建；本机模型探查删除 1,000/5,000 个平级节点约 94/2,672 ms。 | 增加批量删除：一次解析顶层选中节点，按父列表分组倒序移除，最后一次使索引失效并提交事件。 |
| F12（RESOLVED） | 文本输入正确性 | `src/virtual-keyboard.ts:155`、`:245`、`:249`、`:253`、`:255` | Medium | S–M | 已复现：Backspace 删除单个 UTF-16 code unit，😀 留下孤立 U+D83D；接受 input[type=number] 作为目标，按键调用 setRangeText 抛 InvalidStateError。 | 使用字素边界移动/删除；明确并校验支持 selection API 的目标类型，给不支持的输入类型安全行为。 |
| F13（RESOLVED） | 模态 / 焦点 | `src/tour.ts:134`、`:149` | Medium | M | 已复现：Tour 设置 aria-modal=true，但没有 Tab 限制或背景隔离；从最后按钮 Tab 可离开引导并进入背景。 | 明确带遮罩引导是否允许目标交互；按该契约实现焦点约束/背景隔离，或移除不成立的模态声明。 |
| F14（RESOLVED） | 无障碍语义 | `src/tooltip.ts:74`、`:96`、`:101`、`:198` | Medium | M | Chromium AX 树复现：关闭的 Tooltip 仍作为可访问节点出现；触发按钮没有 accessible description，因未建立描述关系且隐藏只改 opacity。 | 管理 slot 内真实触发目标的描述关系，保留已有描述；同步隐藏语义并测试焦点、Escape、禁用与恢复。 |
| F15（RESOLVED） | portable 键盘契约 | `src/adapters/web/controls.ts:39`、`:45`；`src/radio.ts:118` | Medium | M | 已复现：RadioGroup 的原生 radio 分处不同 ShadowRoot，浏览器不会提供组间方向键；ArrowRight 无选择/commit，Tab 逐个进入选项。 | 在适配器实现组内导航和单一 Tab 停靠点，所有变更经过 HYSelectionController，保留受控拒绝回填。 |
| F16（RESOLVED） | portable 集成完整性 | `src/portable/page.ts:18`、`:166`；`src/adapters/web/renderer.ts:223`、`:228`；`src/rate.ts:85` | Medium | S–M | 已复现：Checkbox/RadioGroup/Rate 未进入 interactive 集合，Dialog 初始焦点绕过它们；Rate 的表单描述/错误被写到 aria-hidden 星星按钮，而非实际 role=slider。 | 为每种交互语义集中维护焦点与无障碍目标元数据；新 kind 加入时用穷尽检查和矩阵测试覆盖。 |
| F17（RESOLVED） | 订阅一致性 | `src/portable/page.ts:87`、`:97` | Medium | S | 已复现：合并订阅用自定义 equal，实际 apply 改用 equalData。忽略大小写的 a→A 单独更新被抑制，但另一 binding 更新会把 A 一起写入。 | 在目标仍为上次应用节点时，apply 使用对应 binding 的比较器；继续保留外部 render/setProps 的失效机制。 |
| F18（RESOLVED） | 类型 / 数据边界 | `src/core/validation.ts:40`、`:41`、`:51`；`src/core/data.ts:18` | Medium | M | Node 复现：非 enumerable 的必需 text:42 被 hasOwn 接受，却跳过校验并快照为 {}；数组 getter 可在校验与快照间返回不同 options，接受非法最终数据。 | 对记录与数组统一拒绝不支持的描述符，在稳定数据上校验并生成快照。属于协议边界缺陷，未证明安全利用。 |
| F19（RESOLVED） | 公共 API / 发布门禁 | `scripts/api-surface.mjs:17`；`test/api-gate.test.mjs:10` | Medium | M | 临时副本将 HYToastCloseDetail.reason 从联合类型改成 string，API 门禁和库内 typecheck 均通过；消费者可因此出现类型不兼容。当前快照仅含导出名与 value/type。 | 在现有出口基线之上比较规范化声明签名，覆盖接口成员、联合类型、参数/返回值和事件 detail 的形状变化。 |
| F20（RESOLVED） | 错误诊断 | `src/core/platform-view.ts:20` | Low | S | Node 复现：mount 失败后的 dispose 若也抛错，只剩 cleanup failure，最初初始化错误丢失。 | 用 AggregateError 或 cause 保留初始化和清理两个失败；仍继续完成可执行的清理。 |
| F21（RESOLVED） | 性能优化机会 | `src/portable/page.ts:66`、`:70` | Low | M | 已测量：1,001 节点页面在一次事务中对同节点改 100 次，仍复制 Map 100 次、共 100,100 项，最终仅提交一个后端 mutation。 | 先按真实页面确认收益；需要时用事务局部 draft/写入覆盖层，保留嵌套回滚和原子校验契约。 |
| F22（RESOLVED） | 文档漂移 | `docs/portable-ui.md:19`；`docs/web-adapter.md:41`、`:101`；`test/portable/validation.test.mjs:12` | Low | S | 当前 catalog 有 23 种语义，文档仍写 18；适配器文档仍说复用 7 类组件，注册函数已增加 Radio/Rate/Badge/Divider。 | 更新当前能力表，保留历史 ADR 时间语境；从 catalog 生成或校验可变计数，避免继续手写漂移。 |
| F23（RESOLVED） | 引导生命周期 | `src/tour.ts:101`、`:139` | Low | S | 已复现：Tour 打开后设置 steps=[]，render 提前返回，旧面板/遮罩和文档监听仍保留，open 仍 true。 | 空步骤更新进入 close/teardown 路径，明确关闭事件原因，补充动态步骤更新回归。 |

## 最先实施的五组修改

### 1. 保护嵌套编辑器的键盘事件（F01）

在接管快捷键前检查 composed path 中的 input、textarea、select、contenteditable 与组件交互目标。目标判断应作为无注册副作用的内部工具，由 Tree/Draggable/Resizable 分别按自身快捷键语义使用，不必引入公共基类。

复现 Tree 时需等待初次渲染稳定，再聚焦当前 renderer 内的输入框：

```js
const { defineTreeComponents } = await import('/dist/tree.js');
defineTreeComponents();
customElements.define('audit-tree-editor', class extends HTMLElement {
  constructor() {
    super();
    const input = document.createElement('input');
    input.value = 'abc';
    this.attachShadow({ mode: 'open' }).append(input);
  }
});
const tree = document.createElement('hy-tree');
tree.style = 'width:500px;height:200px';
document.body.append(tree);
tree.data = [{ id: 'a', renderer: 'audit-tree-editor' }];
tree.selectedId = 'a';
// 等待首次布局稳定后，聚焦此刻实际存在的嵌套 input，再用浏览器真实键盘按 Backspace。
```

本次可信键盘输入记录为 `isTrusted=true`，路径 INPUT → AUDIT-TREE-EDITOR → … → HY-TREE，Tree 数据从 1 变 0，产生 `data-change(action=delete)`。修复验收应是输入文本正常编辑、Tree 数据不变；子编辑器方向键也不移动容器，`movable=false` 在键盘路径同样有效。

### 2. 固化属性赋值与连接的状态所有权（F02）

连接钩子负责接入监听和渲染当前状态，首次读取 attribute 仅用于尚未程序赋值的状态。attributeChangedCallback 处理实际的后续声明式更新。对 Tree 还需验证断开/重连后保留当前编辑结果，而非重新应用旧 JSON。

应覆盖 create → property → append、append → property、remove → append，以及 attribute 初值 → property 编辑 → reconnect 四条路径。`src/select.ts:184` 已有保护缺省 attribute 覆盖预赋值的先例，可采用一致策略。

### 3. 统一提交后的字段编辑事件（F03）

Upload 的文件选择、拖放和移除应在 `_files` 与 ElementInternals 完成同步后通知字段消费者；原生文件 input 在内部异步接受前冒出的事件不能触发对旧值的最终校验。上传进度、请求开始/结束不改变文件成员时，不应伪装成字段值编辑。

Form/FormItem 要根据这个明确的值版本中止旧校验，并在 async submit 完成前验证版本仍一致。不要通过“任何 upload-change 都加 revision”粗略处理，否则后台进度会持续使合法提交失效。若新增/调整公开事件，按仓库要求做显式 API 决策和契约测试。

验收四个场景：原生选择后 required 错误清除；拖放触发 change 校验；pending 校验期间移除/替换文件不能接受旧结果；异步 beforeUpload 的拒绝/取消仍不误报值变化。

### 4. 收敛数值默认值处理（F04）

共享的内部解析流程应是：缺省/空值 → fallback；合法有限数值（包括允许的显式 0）→ clamp；非法输入 → 明确 fallback。不要统一使用 `value || fallback`，它会再次破坏 0 的语义。不同组件的范围和默认值仍归组件拥有。

| 无对应 attribute | 代码声明的默认值 | 本次实际值 |
| --- | --- | --- |
| Toast.duration / maxCount | 3 秒 / 5 | 0 / 1 |
| Notification.duration | 4.5 秒 | 0 |
| Watermark.opacity / markWidth / markHeight | 0.16 / 120 / 64 | 0 / 16 / 16 |
| Table.pageSize（接入后） | 10 | 1 |
| Tour.gap / zIndex | 8 / 1000 | 0 / 0 |
| Tooltip.delay | 1000 ms | 0 |
| Anchor.bounds | 5 | 0 |
| VirtualMouse.duration | 320 ms | 0 |

Affix、Rate、Progress 与 VirtualList 已正确处理相关缺省值，不应因为搜索到 Number/getAttribute 就一并改动。

### 5. 复用 Shadow DOM 焦点处理（F05、F08、F13、F14、F16）

从已有 Modal 的 composed-tree 遍历中抽出内部能力，供 Drawer 和需要模态语义的 Tour 使用；继续保留各组件自己的公开事件和关闭策略。Dialog 的断开/重连属于原生 top-layer 生命周期问题，需单独追踪打开会话。

同时为 portable kind 明确真实可聚焦目标和无障碍目标。Rate 的目标是 `.group[role=slider]`，不能用“首个 button”替代；不是每个 shadow button 都对辅助技术开放。新增语义控件时，应强制检查登记、controlled 更新、组键盘、modal 初始焦点与错误描述，而非只确认能渲染出来。

## 性能优化的证据与边界

### Table：分离派生数据与呈现（F10）

本次固定 1,000 条记录，给 filter 提供计数器，完成初始筛选后将计数归零，再设置 `page=2`。一次翻页得到 6,000 次回调；这是筛选调用次数，不是排序比较器次数，也没有换算成终端延迟。`_processedRecords()` 还负责排序，因此多处重复求值同样会重复排序工作。

建议维护按 dataSource/columns/filter/sort 版本失效的 processed snapshot，分页只对它切片。表头更新、分页事件和当前页数据均消费同一快照。用调用次数上界与行为一致性验证收益；回调依赖外部可变状态的兼容语义需在实施前明确。

### Tree：补充批量模型操作（F11）

保留现有 TreeModel，增加批量 remove 而不是删除模型层。一次建立 id/祖先关系，去掉已被选中祖先包含的子节点，按同一父数组分组，从后往前删除，最后统一更新索引、可见缓存、选择和 data-change。94/2,672 ms 是本机临时探查，不作为跨机器性能门槛。

超大宽度边界另有可复现线索：`src/tree-model.ts:283` 使用不受限参数展开调用 splice，约 150,000 个子节点场景可出现 RangeError，且源层级已先变化。若产品确实支持这种规模，应另加有界插入/原子缓存更新；暂不把这个极端规模当作常规组件重构理由。

### HYPage：事务内复制量（F21）

100 次编辑只产生一个最终 backend mutation，说明提交合并有效；代价发生在提交之前的 Map 复制。当前 HYPage 是有界同步页面，先获得真实消费者的节点数与事务编辑分布，再决定是否增加事务 draft。优化不能破坏嵌套失败回滚、程序回填抑制、不可变快照和 faulted/rebuild。

## 测试、门禁与架构维护

- 为相关组件建立共同的行为矩阵：缺省属性、挂载前赋值、重连、展开期间禁用、slot/嵌套 ShadowRoot、异步结果迟到。只对实际支持该能力的组件应用，不强制所有组件参与表单。
- 保留 import/命名/无运行时依赖/无自动注册的结构门禁。将与交互相关的源码正则断言逐步补上真实事件和焦点断言；源码中存在 cleanup/removeListener 不能证明生命周期正确。
- 公共类型基线增加接口成员、联合类型和函数签名。F19 的临时副本实验将 `HYToastCloseDetail.reason` 扩成 string，门禁与库内 typecheck 都返回 0；库内编译成功不能代替消费者兼容性检查。
- 为 portable catalog 增加穷尽的内部交互描述：focus、a11yTarget、keyboard、controlled 更新与能力声明。避免 kind 在 schema 增加后，多个散落的 Set/selector/注册表未同步。
- 将 Table 的数据派生与 Tree 的批量操作放到无 DOM 的可测逻辑中；现有 TreeModel 证明这种拆分已适合本库。无需把全部组件迁移到新框架。

## 快速修复清单

- [x] F01：补充 composed-path 编辑目标保护与 Resizable 键盘权限判断。
- [x] F02：保护预赋值数据和重连状态，补组件实例级生命周期测试。
- [x] F04：修复 null 默认值，先覆盖 Toast/Notification/Watermark/Table。
- [x] F06：对最终动作使用有效禁用态，覆盖打开后禁用与 fieldset 搜索按钮。
- [x] F07：单选互斥不跳过禁用的已选同组成员。
- [x] F17：使分组 binding 的 apply 遵守各自 equal。
- [x] F20：同时保留初始化失败与清理失败。
- [x] F22/F23：同步当前能力文档，清空 Tour 步骤时关闭旧界面和监听。

F01–F23 已完成修复，原始复现已转为持久化行为或契约回归；各项实现与验证范围见修复跟进。

## 看起来不好、实际应保留的设计

1. **根入口与显式全库注册。** `src/index.ts:1` 起集中导入是 deliberate all-components 路径；独立子路径无根 barrel/兄弟组件导入的检查已通过。根入口长不构成独立缺陷。
2. **两条组件路线。** `docs/for-ai/adr/2026-10-16-portable-ui-core.md:5` 与 G05 ADR 明确保留旧 Web API、无 DOM 数据核心和浏览器适配。合并会改变兼容与平台边界。
3. **同包 ShadowRoot 桥接。** G05 ADR 接受该实现细节；本次建议集中真实目标元数据，不把私有节点引用变成公开 API。
4. **TreeModel 与部分复杂布局。** `src/tree-model.ts:123` 的增量移动、`src/masonry.ts:92` 的调度合并、`src/split.ts:188` 的坐标换算有实际职责；无需仅为缩短文件而替换。
5. **QR 编码器。** `src/internal/qrcodegen.ts:1` 的 vendored 算法应保留来源/许可证与独立解码测试。833 行不是应重构的证据。
6. **窄公共入口、共享内部实现。** Popover/Popconfirm 共享 `internal/popover-base.ts`，HYFormControl 共享 ElementInternals 行为，均支持子路径隔离。无需为消除薄包装而合并出口。
7. **输入与资源的显式复杂度。** Mentions caret mirror 支撑换行/比例字体；picker generation、Upload 请求取消和 PlatformView 释放保护解决真实异步问题，不能简化成无状态回调。
8. **主题 fallback。** 组件 CSS 中颜色 fallback 仍位于继承语义 token 之后，不等于依赖某个产品主题。当前无证据要求重写主题系统。
9. **非全部控件 form-associated。** `README.md:442` 明确范围；Date/Time/Cascader/Range/Segmented 未加入 FormData 不是本次缺陷。

## 九个审查维度的覆盖结论

| 维度 | 结论 |
| --- | --- |
| 架构退化 | 没有静态循环依赖；主要需改善内部交互能力复用、catalog 集成完整性与数据派生边界。 |
| 实现一致性 | 缺省值、数据初始化、禁用态及 Shadow DOM 处理已发现跨组件不一致（F01–F09）。 |
| 类型与契约 | 数据快照边界和声明门禁需补足（F18/F19），不建议用 any 或绕过验证解决。 |
| 测试债 | 基础/浏览器现有用例可通过，但缺少上述跨组件集成与生命周期边界；未测量统一分支覆盖率。 |
| 依赖与配置 | 当前 npm audit 未报告漏洞；无 runtime/peer/optional 依赖。knip/madge/depcheck/ast-grep 未安装，本次未临时下载，未据此宣称没有死代码。 |
| 性能与资源 | 已测量 F10/F11/F21；另有 DOM 重建损失焦点、Tour/Dialog 生命周期问题。未作 p95、堆内存或 GPU 测量。 |
| 错误与可观测性 | F20 会隐藏初始化原因；其余 parser 退回空列表多为输入策略，未一概判作吞错。 |
| 安全卫生 | 已检查审阅范围中的动态 HTML/请求等入口，未发现需要单列的明显注入实现；适配器图标 HTML 来自受限数值几何，不应仅因 innerHTML 判定漏洞。本次不是完整安全审计。 |
| 文档漂移 | 当前 catalog/注册数量说明滞后（F22）；历史阶段 ADR 应保留原有时间语境。 |

## 验证记录（初审）

| 检查 | 结果 |
| --- | --- |
| Node / npm | v24.19.0 / 12.2.2；满足仓库 Node >=22 要求 |
| `npm run typecheck` | 通过，包含无 DOM portable 类型检查 |
| `npm test` | 124/124 通过，未跳过 |
| `npm run build` | 通过 |
| `npm run test:browser` | Chromium 239/239 通过 |
| `npm run test:web-adapter` | Chromium 27/27、WebKit 27/27，共 54/54 通过 |
| 发布包校验脚本 `scripts/verify-package.mjs` | 通过；复用本机 npm CLI 路径执行，不重复完整 prepack；原 typecheck/test/API 检查已分别运行 |
| `npm audit --json` | 0 个已报告漏洞；检查当前 lockfile，包括开发依赖 |
| 临时定向探查 | Chromium：真实键盘/焦点、缺省值、生命周期、禁用状态、表单集成与适配器语义；Node：绑定、验证、索引与 Map 复制、API 门禁 |
| Skill 校验 | 使用 skill-creator 的 quick_validate.py 通过；验证器依赖安装于临时目录，未改项目依赖 |

包校验实测：302,343 B packed、1,356,601 B unpacked、208 个文件，Button 独立消费者 gzip 1,950 B。当前预算分别为 302,504 / 1,357,404 / 208，即剩余 161 B / 803 B / 0 个文件（`review/package-budget.json:6`）。这不是包错误；新增能力时应显式评审并重新登记容量，继续保留门禁。

取证文件在忽略的 `.artifacts/tech-debt-audit/`：`orientation.json`、`module-graph.json`、`defaults-and-focus.json`、`tree-keyboard.json`、`api-signature-probe.json`、`browser.log`、`web-adapter.log`。部分定向探查由只读分组审阅完成，观察值已在本报告记录；未将其描述为持久化回归测试。

## 初审问题的处理与验收边界

- 典型业务规模仍由使用方决定；本轮以 1,000 条表格记录、15 万个 Tree 子节点及 1,001 节点页面事务建立回归，未据此声称任意规模下的延迟或内存上限。
- Table 保留外部可变记录和 filter/sorter 闭包的现有使用方式，不要求调用方新增刷新协议；只在一次同步操作中共享派生结果。
- Tour 保留高亮目标可直接交互的现有设计，明确为非模态引导；不会增加背景隔离或 Tab 限制。
- 当前 23 种 portable 语义的 Web 焦点、键盘、错误提示与文档已补齐本次发现的缺口；原生后端支持仍由各自 capabilities 与平台验收决定。
- 本次未手工验收 VoiceOver/屏幕阅读器或真实系统 IME，也未执行原生后端。浏览器自动化不能替代这些平台验收。
