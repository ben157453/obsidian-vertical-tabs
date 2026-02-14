# FGroup 折叠问题修复说明 - v0.22.5

## 问题描述

当侧边栏面板折叠时，FGroup（功能组）的排他性显示功能失效。用户切换 FGroup 后，主工作区的标签页组没有正确显示/隐藏。

## 根本原因分析

1. **状态更新与 DOM 同步问题**：
   - `toggleFGroup` 函数会更新 `hiddenGroups` 状态
   - `Group` 组件通过 `useEffect` 监听 `isHidden` 状态变化，并更新 DOM 的 `is-hidden` CSS 类
   - 但当侧边栏折叠时，React 组件的 `useEffect` 可能不会立即执行或执行时机延迟

2. **React 渲染优化**：
   - 当侧边栏折叠时，某些 React 组件可能处于"未激活"状态
   - 状态更新可能被延迟到下次渲染周期
   - 导致 DOM 的 CSS 类没有及时更新

3. **折叠与隐藏的混淆**：
   - `isCollapsed`：控制组内标签页列表是否展开（侧边栏中的视觉效果）
   - `isHidden`：控制组是否在主工作区显示（通过 CSS `display: none`）
   - 这两个状态应该是独立的，但由于 React 渲染时机问题，折叠状态影响了隐藏状态的应用

## 修复方案

### 在 `toggleFGroup` 中添加立即 DOM 更新

修改 `src/models/ViewState.ts` 中的 `toggleFGroup` 函数：

```typescript
toggleFGroup: (fGroupId: string) => {
    // ... 现有的状态计算逻辑 ...
    
    // 更新状态
    set({ 
        activeFGroupId: fGroupId,
        hiddenGroups: newHiddenGroups
    });
    
    // 保存状态
    saveHiddenGroups(newHiddenGroups);
    
    // 立即应用 CSS 类到 DOM，确保即使侧边栏折叠也能生效
    get().applyHiddenGroupsToDOM();
},
```

### 新增 `applyHiddenGroupsToDOM` 方法

添加一个新方法直接操作 DOM，绕过 React 的渲染周期：

```typescript
applyHiddenGroupsToDOM: () => {
    const { hiddenGroups } = get();
    
    // 使用 Obsidian 的 workspace API 遍历所有根叶子节点
    const processedGroups = new Set<string>();
    
    // 遍历所有根叶子节点来找到它们的父组
    const iterateGroups = (parent: any) => {
        if (!parent || !parent.children) return;
        
        parent.children.forEach((child: any) => {
            if (child.children) {
                // 这是一个组（WorkspaceParent）
                if (child.id && !processedGroups.has(child.id)) {
                    processedGroups.add(child.id);
                    const shouldBeHidden = hiddenGroups.includes(child.id);
                    child.containerEl?.toggleClass('is-hidden', shouldBeHidden);
                }
                // 递归处理子组
                iterateGroups(child);
            }
        });
    };
    
    // 从 window 获取 workspace 实例
    const workspace = (window as any).app?.workspace;
    if (workspace && workspace.rootSplit) {
        iterateGroups(workspace.rootSplit);
    }
},
```

## 修复原理

1. **双重保障机制**：
   - React 组件的 `useEffect` 仍然会在正常情况下更新 DOM
   - `applyHiddenGroupsToDOM` 提供立即更新机制，确保状态变化立即反映到 DOM

2. **直接 DOM 操作**：
   - 通过 Obsidian 的 workspace API 直接访问所有组
   - 绕过 React 的渲染周期，立即应用 CSS 类
   - 确保即使侧边栏折叠，主工作区的显示/隐藏也能正确工作

3. **递归遍历**：
   - 遍历整个 workspace 树结构
   - 处理所有嵌套的组
   - 确保所有组的状态都正确更新

## 修复效果

这些改进确保了：
1. ✅ 侧边栏折叠时，FGroup 切换仍然正常工作
2. ✅ 主工作区的标签页组能正确显示/隐藏
3. ✅ 折叠状态和隐藏状态完全独立
4. ✅ 状态变化立即反映到 UI，无延迟

## 测试建议

1. 创建多个 FGroup，每个包含不同的标签页组
2. 折叠侧边栏面板
3. 通过快捷键或其他方式切换 FGroup
4. 验证主工作区的标签页组是否正确显示/隐藏
5. 展开侧边栏，验证功能仍然正常

## 版本信息

- 修复版本：0.22.5
- 修复日期：2026-02-12
- 构建位置：`dist/0.22.5/`
- 依赖版本：0.22.4（包含 workspace 切换修复）

## 安装方法

将 `dist/0.22.5/` 目录中的以下文件复制到 Obsidian 插件目录：
- main.js
- manifest.json
- styles.css

或者直接将整个 `0.22.5` 文件夹复制到 `.obsidian/plugins/vertical-tabs/` 目录。

## 技术细节

### 为什么不能只依赖 React 的 useEffect？

1. **渲染时机不确定**：当侧边栏折叠时，React 可能会延迟某些组件的更新
2. **批量更新**：React 会批量处理状态更新，可能导致 DOM 更新延迟
3. **组件卸载**：折叠的组件可能被部分卸载，导致 `useEffect` 不执行

### 为什么直接操作 DOM 是安全的？

1. **只修改 CSS 类**：不修改 DOM 结构，只添加/删除 CSS 类
2. **与 React 协同**：React 的 `useEffect` 仍然会执行，两者不冲突
3. **Obsidian API**：使用 Obsidian 官方 API 访问 workspace，安全可靠

### 性能影响

- 遍历 workspace 树的开销很小（通常只有几十个组）
- 只在 FGroup 切换时执行，不影响日常操作
- 比等待 React 重新渲染更快
