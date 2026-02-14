# 版本 0.23.0 更新日志

## 🐛 Bug 修复

### 修复 Zen Mode 下 FGroup 切换不生效的问题

**问题**：在 Zen Mode（禅模式）下，使用 `Switch to next FGroup` 命令切换 FGroup 时不生效，无法实现 FGroup 的排他性显示。

**根本原因**：
- `is-hidden` CSS 类用于实现 FGroup 排他性显示
- 但在 Zen Mode 的 CSS 规则中，`is-hidden` 类被忽略
- Zen Mode 只检查 `.mod-active` 和 `.vt-mod-active` 类
- 导致 FGroup 切换时，虽然状态更新了，但 CSS 不生效

**修复内容**：

1. **在 Zen Mode CSS 规则中添加 `is-hidden` 支持**
   - 在 `ZenMode.scss` 中添加 `&.is-hidden` 规则
   - 使用 `!important` 确保优先级最高
   - 任何带有 `is-hidden` 类的标签组都会被隐藏

2. **保持 Zen Mode 原有功能**
   - 不影响 Zen Mode 的原有逻辑（只显示激活的标签组）
   - 在此基础上增加 FGroup 排他性显示的支持
   - 两种隐藏机制可以共存

**技术实现**：
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
}
```

**影响范围**：
- 修复了 Zen Mode 下 FGroup 切换功能
- 不影响 Zen Mode 的原有功能
- 不影响非 Zen Mode 下的 FGroup 功能

**测试方法**：
1. 创建多个 FGroup，每个包含不同的标签页组
2. 启用 Zen Mode（`Toggle zen mode` 命令）
3. 使用 `Switch to next FGroup` 命令切换 FGroup
4. 验证主工作区是否只显示当前 FGroup 的标签组
5. 验证切换到下一个 FGroup 时，标签组正确切换

---

## 📦 构建信息

- 版本号：0.23.0
- 构建日期：2026-02-12
- 最低 Obsidian 版本：1.6.2
- 基于版本：
  - 0.22.4（workspace 切换修复）
  - 0.22.5（FGroup 折叠修复）
  - 0.22.6（FGroup 持久化修复）

## 📁 文件位置

构建文件位于：`dist/0.23.0/`
- main.js
- manifest.json
- styles.css

## 🔗 相关修复

本版本建议与之前的版本一起使用：
- v0.22.4：修复 workspace 切换时侧边栏空白问题
- v0.22.5：修复 FGroup 折叠时排他性显示失效问题
- v0.22.6：修复 FGroup 排他性显示的持久化问题
- v0.23.0：修复 Zen Mode 下 FGroup 切换不生效问题

## 💡 技术说明

### Zen Mode 的两种隐藏机制

修复后，Zen Mode 下有两种隐藏机制协同工作：

1. **Zen Mode 原生隐藏**：
   - 隐藏所有非激活的标签组
   - 通过 `.mod-active` 和 `.vt-mod-active` 类控制
   - 目的：专注于当前工作的标签组

2. **FGroup 排他性隐藏**：
   - 隐藏不属于当前 FGroup 的标签组
   - 通过 `is-hidden` 类控制
   - 目的：只显示当前 FGroup 的标签组

### CSS 层叠顺序

修复后的 CSS 优先级：
```
1. is-hidden (最高优先级) → 完全隐藏
2. :not(.mod-active) → 隐藏非激活的
3. .mod-active → 显示激活的
```

### 为什么使用 `!important`？

- 确保 `is-hidden` 优先级最高
- 避免被其他 CSS 规则覆盖
- 保证 FGroup 排他性显示的可靠性

### 使用场景

修复后，以下场景都能正常工作：

1. **Zen Mode + FGroup 切换**：在 Zen Mode 下切换 FGroup，只显示当前 FGroup 的激活标签组
2. **Zen Mode + 手动隐藏组**：在 Zen Mode 下手动隐藏某些组，隐藏的组不会显示
3. **非 Zen Mode + FGroup 切换**：正常的 FGroup 排他性显示，不受影响
4. **组合使用**：Zen Mode、FGroup、手动隐藏可以同时使用，各种机制协同工作

## 🎯 版本里程碑

v0.23.0 标志着 FGroup 功能的完善：
- ✅ 基础 FGroup 排他性显示
- ✅ 侧边栏折叠时的正确行为
- ✅ 状态持久化
- ✅ Zen Mode 兼容性

FGroup 功能现在可以在各种场景下稳定工作！
