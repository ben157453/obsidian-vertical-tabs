# 版本 0.22.5 更新日志

## 🐛 Bug 修复

### 修复 FGroup 折叠时排他性显示失效问题

**问题**：当侧边栏面板折叠时，切换 FGroup（功能组）后，主工作区的标签页组没有正确显示/隐藏，FGroup 的排他性显示功能失效。

**根本原因**：
- React 组件的 `useEffect` 在侧边栏折叠时可能延迟执行
- 状态更新到 DOM 的同步存在时间差
- 折叠状态（collapsed）和隐藏状态（hidden）的更新时机不一致

**修复内容**：

1. **添加立即 DOM 更新机制**
   - 在 `toggleFGroup` 函数中添加 `applyHiddenGroupsToDOM()` 调用
   - 确保状态变化立即反映到 DOM，不依赖 React 渲染周期

2. **新增 `applyHiddenGroupsToDOM` 方法**
   - 直接通过 Obsidian workspace API 遍历所有组
   - 立即应用 `is-hidden` CSS 类到对应的 DOM 元素
   - 绕过 React 渲染周期，实现即时更新

3. **双重保障机制**
   - React 的 `useEffect` 仍然正常工作（正常情况）
   - 直接 DOM 操作提供即时更新（折叠情况）
   - 两种机制互补，确保所有场景都能正常工作

**技术实现**：
```typescript
// 在 toggleFGroup 中添加
get().applyHiddenGroupsToDOM();

// 新增方法
applyHiddenGroupsToDOM: () => {
    // 遍历 workspace 树结构
    // 直接更新所有组的 is-hidden CSS 类
}
```

**影响范围**：
- 修复了侧边栏折叠时 FGroup 切换功能
- 确保折叠状态和隐藏状态完全独立
- 不影响现有功能和性能

**测试方法**：
1. 创建多个 FGroup，每个包含不同的标签页组
2. 折叠侧边栏面板
3. 切换 FGroup（通过快捷键或其他方式）
4. 验证主工作区的标签页组是否正确显示/隐藏

---

## 📦 构建信息

- 版本号：0.22.5
- 构建日期：2026-02-12
- 最低 Obsidian 版本：1.6.2
- 基于版本：0.22.4（包含 workspace 切换修复）

## 📁 文件位置

构建文件位于：`dist/0.22.5/`
- main.js
- manifest.json
- styles.css

## 🔗 相关修复

本版本建议与 v0.22.4 一起使用，该版本修复了 workspace 切换时侧边栏空白的问题。

## 💡 技术说明

### 为什么需要直接操作 DOM？

1. **React 渲染时机不确定**：侧边栏折叠时，React 可能延迟更新
2. **批量更新机制**：React 会批量处理状态更新，导致延迟
3. **组件生命周期**：折叠的组件可能处于非激活状态

### 直接 DOM 操作的安全性

1. **只修改 CSS 类**：不改变 DOM 结构，只添加/删除 CSS 类
2. **与 React 协同**：不干扰 React 的正常渲染流程
3. **使用官方 API**：通过 Obsidian workspace API 安全访问

### 性能影响

- 遍历开销极小（通常只有几十个组）
- 仅在 FGroup 切换时执行
- 比等待 React 渲染更快，用户体验更好
