# Zen Mode 下 FGroup 切换修复说明 - v0.23.0

## 问题描述

在 Zen Mode（禅模式）下，使用 `Switch to next FGroup` 命令切换 FGroup 时不生效，无法实现 FGroup 的排他性显示。

## 根本原因分析

1. **CSS 规则冲突**：
   - `is-hidden` CSS 类用于隐藏不属于当前激活 FGroup 的标签组
   - 但在 `ZenMode.scss` 中，`is-hidden` 规则只在**非 Zen Mode** 下生效
   - Zen Mode 下的 CSS 规则只检查 `.mod-active` 和 `.vt-mod-active` 类

2. **Zen Mode 的显示逻辑**：
   ```scss
   body.vt-zen-mode .workspace-split.mod-root {
       .workspace-tabs {
           &:not(.mod-active),
           &:not(.vt-mod-active) {
               display: none;  // 只显示激活的标签组
           }
       }
   }
   ```
   这个规则会隐藏所有非激活的标签组，但没有考虑 `is-hidden` 类。

3. **状态更新但不生效**：
   - `switchToNextFGroup` 正确更新了 `hiddenGroups` 状态
   - `applyHiddenGroupsToDOM` 正确添加了 `is-hidden` CSS 类到 DOM
   - 但由于 CSS 规则不匹配，`is-hidden` 类在 Zen Mode 下被忽略

## 修复方案

### 在 Zen Mode 的 CSS 规则中添加 `is-hidden` 支持

修改 `src/styles/ZenMode.scss`，在 Zen Mode 规则中优先处理 `is-hidden` 类：

```scss
body.vt-zen-mode:not(.is-popout-window) .workspace-split.mod-root {
    .workspace-tabs {
        // Hide tabs that are explicitly marked as hidden (for FGroup exclusivity)
        &.is-hidden {
            display: none !important;
        }

        &:not(.mod-active),
        &:not(.vt-mod-active) {
            display: none;
            flex-basis: unset;
        }

        &.mod-active,
        &.vt-mod-active {
            display: flex;
            flex-basis: 100%;
        }
    }
    // ...
}
```

### 修复原理

1. **优先级提升**：
   - 将 `&.is-hidden` 规则放在最前面
   - 使用 `!important` 确保优先级最高
   - 任何带有 `is-hidden` 类的标签组都会被隐藏，无论是否激活

2. **兼容性保持**：
   - 不影响 Zen Mode 的原有逻辑（只显示激活的标签组）
   - 在此基础上增加 FGroup 排他性显示的支持
   - 两种隐藏机制可以共存

3. **CSS 层叠顺序**：
   ```
   1. is-hidden (最高优先级) → 完全隐藏
   2. :not(.mod-active) → 隐藏非激活的
   3. .mod-active → 显示激活的
   ```

## 修复效果

这些改进确保了：
1. ✅ Zen Mode 下可以正常使用 `Switch to next FGroup` 命令
2. ✅ FGroup 的排他性显示在 Zen Mode 下正常工作
3. ✅ 不影响 Zen Mode 的原有功能（只显示激活的标签组）
4. ✅ 两种显示控制机制（Zen Mode + FGroup）可以协同工作

## 测试建议

1. 创建多个 FGroup，每个包含不同的标签页组
2. 启用 Zen Mode（`Toggle zen mode` 命令）
3. 使用 `Switch to next FGroup` 命令切换 FGroup
4. 验证主工作区是否只显示当前 FGroup 的标签组
5. 验证切换到下一个 FGroup 时，标签组正确切换
6. 关闭 Zen Mode，验证功能仍然正常

## 版本信息

- 修复版本：0.23.0
- 修复日期：2026-02-12
- 构建位置：`dist/0.23.0/`
- 依赖版本：
  - 0.22.4（workspace 切换修复）
  - 0.22.5（FGroup 折叠修复）
  - 0.22.6（FGroup 持久化修复）

## 技术细节

### Zen Mode 的两种隐藏机制

修复后，Zen Mode 下有两种隐藏机制：

1. **Zen Mode 原生隐藏**：
   - 隐藏所有非激活的标签组
   - 通过 `.mod-active` 和 `.vt-mod-active` 类控制
   - 目的：专注于当前工作的标签组

2. **FGroup 排他性隐藏**：
   - 隐藏不属于当前 FGroup 的标签组
   - 通过 `is-hidden` 类控制
   - 目的：只显示当前 FGroup 的标签组

### CSS 优先级

使用 `!important` 的原因：
- 确保 `is-hidden` 优先级最高
- 避免被其他 CSS 规则覆盖
- 保证 FGroup 排他性显示的可靠性

### 为什么不修改 JavaScript 代码？

- JavaScript 逻辑已经正确（状态更新、DOM 操作都正常）
- 问题出在 CSS 层面（规则不匹配）
- 修改 CSS 是最简单、最直接的解决方案
- 不会引入额外的复杂性或性能开销

## 使用场景

修复后，以下场景都能正常工作：

1. **Zen Mode + FGroup 切换**：
   - 在 Zen Mode 下切换 FGroup
   - 只显示当前 FGroup 的激活标签组

2. **Zen Mode + 手动隐藏组**：
   - 在 Zen Mode 下手动隐藏某些组
   - 隐藏的组不会显示

3. **非 Zen Mode + FGroup 切换**：
   - 正常的 FGroup 排他性显示
   - 不受影响

4. **组合使用**：
   - Zen Mode、FGroup、手动隐藏可以同时使用
   - 各种机制协同工作，不会冲突
