# M24 共享 UI 核心与 WebComponent 兼容

状态：G01 契约决定。日期：2026-10-16。

UI 在现有根 package 内新增独立、无 DOM 的 core/portable 子路径及 Web 适配器。应用状态、业务校验和 effects 由产品实现，UI 只依赖类型化 props/事件和注入端口。UI 不依赖 Native、Engine 或任何产品，也不引入新的默认框架。

原有 hy-*、属性、事件、主题和独立注册 API 保留。跨端采用受控组件子集，不把任意 HTML/CSS/Shadow DOM 编译成原生控件。平台特殊编辑器与 surface 通过 PlatformView 接入。v1 的精确接口、时序、错误与能力说明见 [契约](../../../review/m24-ui/g01/contract-v1.md)，现有 API 对照见 [组件矩阵](../../../review/m24-ui/g01/component-matrix.md)。

G01 仅增加私有探针和冻结规范。生产组件实现归 G03/G05，公开 exports 经串行集成后再添加，避免未实现入口进入发布包。选择器探针使用 npm-pack 产物向 ShaderLab 交付，禁止跨仓直接 import 源码。

原生实现以语义一致和真实系统输入/无障碍为门槛；“画出来”不等于完成组件适配。模板编译和静态子树优化在有数据证明收益后单独决策。
