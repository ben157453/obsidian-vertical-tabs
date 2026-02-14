# 版本 0.23.1 更新日志

## 🐛 Bug 修复

### 修复 FGroup 切换时的布局问题

**问题 1：从 Zen Mode 切换 FGroup 时主界面空白**
- 在 Zen Mode 下使用 `Switch to next FGroup` 命令
- 主工作区显示为空白区域
- DOM 元素存在但没有内容显示

**问题 2：FGroup 切换时分屏布局不均衡**
- 从一个 FGroup 切换到另一个时，分屏比例不正确
- 例如：从 FGroup 1 切到 FGroup 2，右边很小
- 手动调整后，切回 FGroup 1，左边又变小了
- 布局比例不会自动均衡

**根本原因**：
- `toggleFGroup` 只更新了状态和 CSS 类
- 没有调整 flex 布局属性（`flex-basis`, `flex-grow`, `flex-shrink`）
- 导致隐藏的组仍然占用空间，或可见的组没有均分空间
- Obsidian 的布局系统没有被通知更新

**修复内容**：

1. **添加自动布局调整**
   - 在 `toggleFGroup` 中调用 `adjustLayoutAfterFGroupSwitch`
   - 自动计算可见组的数量并均分空间
   - 将隐藏组的 flex 属性设置为 0

2. **实现 `adjustLayoutAfterFGroupSwitch` 方法**
   - 遍历所有 workspace split
   - 找出可见的子元素（没有 `is-hidden` 类）
   - 均分布局：`flex-basis = 100% / visibleChildren.length`
   - 隐藏元素：`flex-basis = 0`
   - 递归处理嵌套的 split

3. **触发 Obsidian 布局更新**
   - 调用 `workspace.onLayoutChange()`
   - 确保 Obsidian 的内部状态与 DOM 同步
   - 解决主界面空白的问题

**技术实现**：
```typescript
toggleFGroup: (fGroupId: string) => {
    // ... 状态更新逻辑 ...
    
    // 立即应用 CSS 类到 DOM
    get().applyHiddenGroupsToDOM();
    
    // 调整布局，确保分屏均衡
    get().adjustLayoutAfterFGroupSwitch();
},

adjustLayoutAfterFGroupSwitch: () => {
    setTimeout(() => {
        // 遍历所有 split
        // 计算可见组并均分空间
        // 隐藏组设置为 0
        // 触发布局更新
        workspace.onLayoutChange();
    }, 100);
},
```

**影响范围**：
- 修复了 Zen Mode 下 FGroup 切换的空白问题
- 修复了 FGroup 切换时的布局不均衡问题
- 不影响其他功能

**测试方法**：
1. 创建多个 FGroup，每个包含不同数量的标签页组
2. 启用 Zen Mode
3. 使用 `Switch to next FGroup` 命令切换 FGroup
4. 验证主界面是否正常显示（不是空白）
5. 验证分屏布局是否均衡（左右比例相同）
6. 在不同 FGroup 之间来回切换，验证布局始终均衡

---

## 📦 构建信息

- 版本号：0.23.1
- 构建日期：2026-02-12
- 最低 Obsidian 版本：1.6.2
- 基于版本：0.23.0（Zen Mode FGroup 切换修复）

## 📁 文件位置

构建文件位于：`dist/0.23.1/`
- main.js
- manifest.json
- styles.css

## 🔗 相关修复

本版本建议与之前的版本一起使用：
- v0.22.4：修复 workspace 切换时侧边栏空白问题
- v0.22.5：修复 FGroup 折叠时排他性显示失效问题
- v0.22.6：修复 FGroup 排他性显示的持久化问题
- v0.23.0：修复 Zen Mode 下 FGroup 切换不生效问题
- v0.23.1：修复 FGroup 切换时的布局问题

## 💡 技术说明

### 自动布局调整原理

1. **均分可见组**：
   - 计算可见组的数量：`visibleChildren.length`
   - 均分空间：`flex-basis = 100% / visibleChildren.length`
   - 设置扩展和收缩：`flex-grow = 1`, `flex-shrink = 1`

2. **隐藏组归零**：
   - 设置隐藏组的 flex 属性为 0
   - 确保不占用任何空间
   - `flex-basis = 0`, `flex-grow = 0`, `flex-shrink = 0`

3. **递归处理**：
   - Obsidian 的 workspace 是树形结构
   - 可能有多层嵌套的 split
   - 递归处理所有层级，确保整个布局都正确

### 延迟执行的必要性

使用 100ms 延迟的原因：
1. DOM 更新是异步的，需要时间重新渲染
2. 避免在 CSS 类还未应用时就调整布局
3. 给浏览器足够时间完成渲染
4. 确保读取到正确的 DOM 状态

### flex 布局属性

可见组：
```css
flex-basis: 33.33%;  /* 假设有 3 个可见组 */
flex-grow: 1;        /* 可以扩展 */
flex-shrink: 1;      /* 可以收缩 */
```

隐藏组：
```css
flex-basis: 0;       /* 不占用空间 */
flex-grow: 0;        /* 不扩展 */
flex-shrink: 0;      /* 不收缩 */
```

### 与现有功能的兼容性

- 不影响手动调整布局的功能
- 不影响 Obsidian 原生的分屏功能
- 与 `autoResizeLayout` 函数共存，互不干扰
- 只在 FGroup 切换时自动调整

## 🎯 使用场景

修复后，以下场景都能正常工作：

1. **Zen Mode + FGroup 切换**：
   - 主界面正常显示，不会空白
   - 布局自动均衡

2. **多个 FGroup 来回切换**：
   - 无论切换顺序如何，布局始终均衡
   - 不需要手动调整

3. **不同数量的标签页组**：
   - FGroup 1 有 2 个组，FGroup 2 有 3 个组
   - 切换时自动调整为 50% 和 33.33%

4. **嵌套的 split**：
   - 支持水平和垂直嵌套的 split
   - 所有层级的布局都正确
