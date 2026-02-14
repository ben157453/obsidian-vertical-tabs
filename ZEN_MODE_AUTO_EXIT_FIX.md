# Zen Mode 自动退出修复说明 - v0.23.2

## 问题描述

从 Zen Mode 切换到 FGroup 时，主界面仍然显示空白，即使已经修复了布局调整逻辑。

## 根本原因分析

1. **Zen Mode 和 FGroup 的冲突**：
   - Zen Mode 的逻辑：只显示激活的标签组（`.mod-active` 或 `.vt-mod-active`）
   - FGroup 的逻辑：通过 `is-hidden` 类隐藏不属于当前 FGroup 的组
   - 两种机制同时生效时，可能导致所有组都被隐藏

2. **CSS 优先级问题**：
   - 虽然在 v0.23.0 中添加了 `&.is-hidden { display: none !important; }`
   - 但 Zen Mode 的 `:not(.mod-active)` 规则仍然会影响显示
   - 导致即使组不是 `is-hidden`，也可能因为不是 `mod-active` 而被隐藏

3. **用户体验问题**：
   - 用户在 Zen Mode 下切换 FGroup，期望看到新 FGroup 的所有组
   - 但 Zen Mode 只显示激活的组，导致大部分组不可见
   - 这不符合用户的预期

## 解决方案

### 在切换 FGroup 前自动退出 Zen Mode

修改 `toggleFGroup` 函数，在执行 FGroup 切换前先检查并退出 Zen Mode：

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
            // 继续执行 FGroup 切换逻辑
            get().executeFGroupSwitch(fGroupId);
        }, 50);
        return;
    }

    // 执行 FGroup 切换逻辑
    get().executeFGroupSwitch(fGroupId);
},
```

### 将 FGroup 切换逻辑提取为独立方法

创建 `executeFGroupSwitch` 方法，包含原有的 FGroup 切换逻辑：

```typescript
executeFGroupSwitch: (fGroupId: string) => {
    // ... 原有的 FGroup 切换逻辑 ...
    // 计算共享组、隐藏组、显示组
    // 更新状态、保存状态
    // 应用 DOM 更新、调整布局
},
```

## 修复原理

1. **检测 Zen Mode**：
   - 从 `useSettings` 获取当前的 `zenMode` 状态
   - 如果为 `true`，说明当前在 Zen Mode

2. **自动退出**：
   - 调用 `toggleZenMode()` 退出 Zen Mode
   - 这会移除 `vt-zen-mode` CSS 类
   - 恢复正常的显示模式

3. **延迟执行**：
   - 使用 50ms 延迟等待 Zen Mode 退出完成
   - 确保 CSS 类已经被移除，DOM 已经更新
   - 然后再执行 FGroup 切换逻辑

4. **逻辑分离**：
   - `toggleFGroup`：入口函数，处理 Zen Mode 检测和退出
   - `executeFGroupSwitch`：核心逻辑，执行实际的 FGroup 切换

## 修复效果

这些改进确保了：
1. ✅ 从 Zen Mode 切换 FGroup 时，自动退出 Zen Mode
2. ✅ 切换后显示新 FGroup 的所有组，不会空白
3. ✅ 用户体验更流畅，不需要手动退出 Zen Mode
4. ✅ 避免了 Zen Mode 和 FGroup 的显示冲突

## 使用场景

修复后的行为：

1. **在 Zen Mode 下点击 FGroup 标题**：
   - 自动退出 Zen Mode
   - 切换到新的 FGroup
   - 显示新 FGroup 的所有组

2. **在 Zen Mode 下使用快捷键切换**：
   - `Switch to next FGroup` 命令
   - 自动退出 Zen Mode
   - 切换到下一个 FGroup

3. **在非 Zen Mode 下切换**：
   - 直接切换 FGroup
   - 不受影响

## 测试建议

1. 启用 Zen Mode
2. 创建多个 FGroup
3. 点击侧边栏中的 FGroup 标题切换
4. 验证是否自动退出 Zen Mode
5. 验证主界面是否正常显示新 FGroup 的所有组
6. 使用 `Switch to next FGroup` 快捷键测试
7. 验证功能是否正常

## 版本信息

- 修复版本：0.23.2
- 修复日期：2026-02-12
- 构建位置：`dist/0.23.2/`
- 依赖版本：0.23.1（FGroup 布局修复）

## 技术细节

### 为什么需要延迟 50ms？

1. **CSS 类移除需要时间**：`toggleZenMode` 会移除 `vt-zen-mode` 类，但这是异步的
2. **DOM 更新需要时间**：浏览器需要重新计算样式和布局
3. **避免竞态条件**：如果立即执行 FGroup 切换，可能读取到旧的 DOM 状态
4. **50ms 足够短**：用户几乎感觉不到延迟，但足够让 DOM 更新完成

### 为什么不在 CSS 中解决？

1. **逻辑复杂**：Zen Mode 和 FGroup 的显示逻辑本身就很复杂
2. **CSS 优先级难以控制**：即使使用 `!important`，也可能有其他规则干扰
3. **用户体验更好**：自动退出 Zen Mode 更符合用户预期
4. **代码更清晰**：逻辑分离，更容易维护

### 与其他功能的兼容性

- 不影响手动切换 Zen Mode 的功能
- 不影响在非 Zen Mode 下切换 FGroup
- 不影响 Zen Mode 的其他功能
- 与之前的修复（布局调整、持久化等）完全兼容

## 设计理念

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

## 未来改进建议

如果需要在 Zen Mode 下也支持 FGroup，可以考虑：

1. **Zen Mode + FGroup 模式**：
   - 只显示当前 FGroup 的激活组
   - 需要更复杂的 CSS 规则和逻辑

2. **配置选项**：
   - 让用户选择是否自动退出 Zen Mode
   - 或者选择 Zen Mode 的行为（严格/宽松）

但目前的实现（自动退出）是最简单、最可靠的方案。
