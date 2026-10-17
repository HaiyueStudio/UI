# G03 通用组件与页面核心

状态：已接受，G03 核心验证通过。日期：2026-10-16。集成 owner 串行维护 exports、schema、tokens 与测试基线。

新增 `@haiyue/ui/core` 与 `@haiyue/ui/portable`，指向独立目录；根 Web barrel、旧子路径和注册行为不变。源码及声明用无 DOM 的独立 TypeScript 配置检查，无新增依赖。版本仍在 G10 决定，不发布。

## G01 到 G03 的兼容补充

保留 G01 冻结产物，传输协议仍为 `HYCapabilities.contract = 1`；实施 schema 为 `haiyue-portable-ui/1.1`。只增加可选字段：节点的 `source` 定位及 `requires` 能力要求，insert/move 的 `slot`（缺省表示匿名 children）。所有 G01 类型继续可赋值给新类型。G05/G06/G08 须消费 G03 类型和插槽测试，不能忽略命名 slot。历史选择器探针同时复测生产实现。

作者 key 在一个父节点下唯一（包括其命名插槽）；运行时用转义的父路径生成后端 key，`hyKey()` 用于订阅、事件和焦点。重排和同父级插槽迁移保留实例；换父级或 kind 重建。后端接收浅节点，children/slots 不重复创建，插槽路由只在 placement mutation 中表达。属性完整替换；对象结构比较不依赖 JSON 字符串化。

页面更新与事务同步执行，显式 `transaction()` 最外层退出提交一次。`bind(store, bindings)` 使用一个组合 selector 订阅，同一应用事务只通知一次；每个绑定有独立 selector/判等，只更新变化节点，不持有或释放应用 store。无隐含计时器、逐帧轮询或异步调度。后端失败标记 faulted，不回滚原生操作；显式 rebuild 使用最新待提交节点并替换后端。

输入控制器通过显式应用 revision 区分草稿回填与外部修改。合成期间排队最新外部值，合成结束先报告最终用户值，再应用更高 revision 的外部值（外部胜出），不提交被覆盖草稿。校验拒绝保留草稿；适配器必须分辨程序写入与真实输入、传递 IME 确认标记。同步 setter 回调抑制可测试，异步原生回调来源与实际 IME 属于 G05/G06/G08。

主题输出纯 CSS 自定义属性字典或原生语义数据，不接触样式表/原生对象。颜色使用可移植的 `#RRGGBB`/`#RRGGBBAA`，原生保留逻辑单位；Web 字号、行高、gap、radius 以 px 字符串输出。字体缩放仅影响字体尺寸，不混入安全区。

记录后端仅测试生命周期、实例身份、差异和命名插槽，不代表平台控件、排版、无障碍或输入法已验收。产品页面迁移属于 G07；虚拟列表/Tree 属于 G09。

## 包预算

独立入口增加 12 个实现模块及对应声明（24 个文件）。保持发布文件白名单、零依赖和原有增长余量；按当前实际包体积重新登记预算，旧 button 单入口的 gzip 门槛不变。前后值和新增文件明细在 `review/m24-ui/g03/package-growth.json`，最终 tarball 哈希在 `verification.json`。
