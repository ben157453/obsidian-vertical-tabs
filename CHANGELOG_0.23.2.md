# 版本 0.23.2 更新日志

## 🐛 Bug 修复

### 修复 Zen Mode 下切换 FGroup 的空白问题

**问题**：从 Zen Mode 切换到 FGroup 时，主界面仍然显示空白，即使已经修复了布局调整逻辑（v0.23.1）。

**根本原因**：
- Zen Mode 的显示逻辑：只显示激活的标签组（`.mod-active` 或 `.vt-mod-active`）
- FGroup 的显示逻辑：通过 `is-hidden` 类隐藏不属于当前 FGroup 的组
- 两种机制同时生效时，可能导致所有组都被隐藏或大部分组不可见
- 用户在 Zen Mode 下切换 FGroup，期望看到新 FGroup 的所有组，但 Zen Mode 只显示激活的组

**解决方案**：

在切换 FGroup 前自动退出 Zen Mode，避免两种显示机制的冲突。

**修复内容**：

1. **自动检测并退出 Zen Mode**
   - 在 `toggleFGroup` 函数开始时检查 `zenMode` 状态
   - 如果当前在 Zen Mode，自动调用 `toggleZenMode()` 退出
   - 等待 50ms 让 Zen Mode 退出完成，然后执行 FGroup 切换

2. **逻辑分离**
   - 将 FGroup 切换逻辑提取为 `executeFGroupSwitch` 方法
   - `toggleFGroup` 作为入口函数，处理 Zen Mode 检测和退出
   - `executeFGroupSwitch` 包含核心的 FGroup 切换逻辑

**技术实现**：
```typescript
toggleFGroup: (fGroupId: string) => {
    const { fGroups, activeFGroupId } = get();
    const targetFGroup = fGroups[fGroupId];
    if (!targetFGroup) return;

    // 如果当前在 Zen Mode，先退出
    const { zenMode, toggleZenMode } = useSettings.getState();
    if (zenMode) {
        toggleZenMode();
        // 等待 Zen Mode 退出完成
        setTimeout(() => {
            get().executeFGroupSwitch(fGroupId);
        }, 50);
        return;
    }

    // 执行 FGroup 切换逻辑
    get().executeFGroupSwitch(fGroupId);
},

executeFGroupSwitch: (fGroupId: string) => {
    // ... 原有的 FGroup 切换逻辑 ...
},
```

**影响范围**：
- 修复了 Zen Mode 下切换 FGroup 的空白问题
- 提升了用户体验，不需要手动退出 Zen Mode
- 不影响非 Zen Mode 下的 FGroup 切换
- 不影响手动切换 Zen Mode 的功能

**使用场景**：

修复后的行为：

1. **在 Zen Mode 下点击 FGroup 标题**：
   - 自动退出 Zen Mode
   - 切换到新的 FGroup
   - 显示新 FGroup 的所有组

2. **在 Zen Mode 下使用快捷键**：
   - `Switch to next FGroup` 或 `Switch to previous FGroup`
   - 自动退出 Zen Mode
   - 切换到目标 FGroup

3. **在非 Zen Mode 下切换**：
   - 直接切换 FGroup
   - 不受影响

**测试方法**：
1. 启用 Zen Mode（`Toggle zen mode` 命令）
2. 创建多个 FGroup
3. 点击侧边栏中的 FGroup 标题切换
4. 验证是否自动退出 Zen Mode
5. 验证主界面是否正常显示新 FGroup 的所有组
6. 使用 `Switch to next FGroup` 快捷键测试
7. 验证功能是否正常

---

## 📦 构建信息

- 版本号：0.23.2
- 构建日期：2026-02-12
- 最低 Obsidian 版本：1.6.2
- 基于版本：0.23.1（FGroup 布局修复）

## 📁 文件位置

构建文件位于：`dist/0.23.2/`
- main.js
- manifest.json
- styles.css

## 🔗 相关修复

本版本建议与之前的版本一起使用：
- v0.22.4：修复 workspace 切换时侧边栏空白问题
- v0.22.5：修复 FGroup 折叠时排他性显示失效问题
- v0.22.6：修复 FGroup 排他性显示的持久化问题
- v0.23.0：修复 Zen Mode 下 FGroup 切换不生效问题（CSS 修复）
- v0.23.1：修复 FGroup 切换时的布局不均衡问题
- v0.23.2：修复 Zen Mode 下切换 FGroup 的空白问题（自动退出）

## 💡 技术说明

### 为什么需要延迟 50ms？

1. **CSS 类移除是异步的**：`toggleZenMode` 会移除 `vt-zen-mode` 类，但浏览器需要时间处理
2. **DOM 更新需要时间**：浏览器需要重新计算样式和布局
3. **避免竞态条件**：如果立即执行 FGroup 切换，可能读取到旧的 DOM 状态
4. **用户体验**：50ms 足够短，用户几乎感觉不到延迟

### 为什么不在 CSS 中解决？

1. **逻辑复杂**：Zen Mode 和 FGroup 的显示逻辑本身就很复杂
2. **CSS 优先级难以控制**：即使使用 `!important`，也可能有其他规则干扰
3. **用户体验更好**：自动退出 Zen Mode 更符合用户预期
4. **代码更清晰**：逻辑分离，更容易维护

### 设计理念

**Zen Mode 和 FGroup 是两种不同的工作模式**：

1. **Zen Mode**：
   - 专注模式，只显示当前激活的标签组
   - 适合专注于单个任务
   - 隐藏其他干扰

2. **FGroup**：
   - 项目模式，显示一组相关的标签组
   - 适合在多个相关任务之间切换
   - 需要看到所有相关的组

**两者不应该同时使用**：
- Zen Mode 强调"单一"，FGroup 强调"分组"
- 同时使用会导致显示冲突
- 自动退出 Zen Mode 是最合理的解决方案

### 与其他功能的兼容性

- ✅ 不影响手动切换 Zen Mode 的功能
- ✅ 不影响在非 Zen Mode 下切换 FGroup
- ✅ 不影响 Zen Mode 的其他功能
- ✅ 与之前的修复（布局调整、持久化等）完全兼容

## 🎯 版本里程碑

v0.23.2 完成了 FGroup 和 Zen Mode 的完整兼容：
- ✅ 基础 FGroup 排他性显示（v0.22.x）
- ✅ Zen Mode CSS 支持（v0.23.0）
- ✅ 布局自动调整（v0.23.1）
- ✅ 自动退出 Zen Mode（v0.23.2）

FGroup 功能现在可以在所有场景下稳定工作，包括与 Zen Mode 的配合！

## 📝 使用建议

1. **专注工作时**：使用 Zen Mode，只显示当前任务
2. **项目工作时**：使用 FGroup，显示项目相关的所有组
3. **切换项目时**：直接切换 FGroup，系统会自动退出 Zen Mode
4. **需要专注时**：手动启用 Zen Mode，专注于当前激活的组
