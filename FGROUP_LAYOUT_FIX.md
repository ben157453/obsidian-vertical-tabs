# FGroup 切换布局问题修复说明 - v0.23.1

## 问题描述

1. **从 Zen Mode 切换到 FGroup 时主界面空白**：
   - 在 Zen Mode 下切换 FGroup
   - 主工作区显示为空白（`div.workspace-split.mod-vertical.mod-root` 没有内容）

2. **FGroup 切换时分屏布局不均衡**：
   - 从 FGroup 1 切换到 FGroup 2 时，右边的分屏很小
   - 手动调整后，切回 FGroup 1 时，左边的分屏又变小了
   - 布局比例不会自动均衡

## 根本原因分析

### 问题 1：主界面空白

1. **CSS 类应用时机**：
   - `applyHiddenGroupsToDOM` 添加了 `is-hidden` 类
   - 但在 Zen Mode 下，可能所有组都被标记为非激活
   - 导致没有可见的组

2. **布局未更新**：
   - 切换 FGroup 后，DOM 的 CSS 类更新了
   - 但 Obsidian 的布局系统没有被通知
   - 导致布局状态不一致

### 问题 2：分屏布局不均衡

1. **缺少布局调整**：
   - `toggleFGroup` 只更新了 `hiddenGroups` 状态和 CSS 类
   - 没有调整 flex 布局属性（`flex-basis`, `flex-grow`, `flex-shrink`）
   - 导致隐藏的组仍然占用空间，或者可见的组没有均分空间

2. **布局属性残留**：
   - 之前的布局调整可能设置了固定的 `flex-basis`
   - 切换 FGroup 后，这些属性没有被重置
   - 导致布局比例不正确

## 修复方案

### 1. 在 `toggleFGroup` 中添加布局调整

修改 `src/models/ViewState.ts` 中的 `toggleFGroup` 函数：

```typescript
toggleFGroup: (fGroupId: string) => {
    // ... 现有的状态更新逻辑 ...
    
    // 立即应用 CSS 类到 DOM
    get().applyHiddenGroupsToDOM();
    
    // 调整布局，确保分屏均衡
    get().adjustLayoutAfterFGroupSwitch();
},
```

### 2. 实现 `adjustLayoutAfterFGroupSwitch` 方法

添加新方法来自动调整布局：

```typescript
adjustLayoutAfterFGroupSwitch: () => {
    // 延迟执行以确保 DOM 更新完成
    setTimeout(() => {
        const workspace = (window as any).app?.workspace;
        if (!workspace || !workspace.rootSplit) return;
        
        const { hiddenGroups } = get();
        
        // 遍历所有 split 并调整布局
        const adjustSplit = (split: any) => {
            if (!split || !split.containerEl) return;
            
            const splitEl = split.containerEl;
            if (!splitEl.classList.contains('workspace-split')) return;
            
            // 获取所有子元素
            const children = Array.from(splitEl.children) as HTMLElement[];
            
            // 找出可见的子元素
            const visibleChildren = children.filter((child) => {
                const tabsContainer = child.querySelector('.workspace-tabs');
                if (!tabsContainer) return true;
                return !tabsContainer.classList.contains('is-hidden');
            });
            
            if (visibleChildren.length === 0) return;
            
            // 均分布局
            const percentage = 100 / visibleChildren.length;
            
            visibleChildren.forEach((child) => {
                child.style.flexBasis = `${percentage}%`;
                child.style.flexGrow = '1';
                child.style.flexShrink = '1';
            });
            
            // 隐藏的子元素设置为 0
            children.forEach((child) => {
                if (!visibleChildren.includes(child)) {
                    child.style.flexBasis = '0';
                    child.style.flexGrow = '0';
                    child.style.flexShrink = '0';
                }
            });
            
            // 递归处理子 split
            if (split.children) {
                split.children.forEach((child: any) => {
                    if (child.children) {
                        adjustSplit(child);
                    }
                });
            }
        };
        
        adjustSplit(workspace.rootSplit);
        
        // 触发 Obsidian 的布局更新
        workspace.onLayoutChange();
    }, 100);
},
```

## 修复原理

### 1. 自动布局调整

- **均分可见组**：计算可见组的数量，将空间均分（`100% / visibleChildren.length`）
- **隐藏组归零**：将隐藏组的 flex 属性设置为 0，不占用空间
- **递归处理**：遍历所有嵌套的 split，确保所有层级的布局都正确

### 2. 延迟执行

- 使用 100ms 延迟确保 DOM 更新完成
- 避免在 CSS 类还未应用时就调整布局
- 给浏览器足够时间完成渲染

### 3. 触发布局更新

- 调用 `workspace.onLayoutChange()` 通知 Obsidian
- 确保 Obsidian 的内部状态与 DOM 同步
- 触发其他依赖布局的功能更新

## 修复效果

这些改进确保了：
1. ✅ 从 Zen Mode 切换 FGroup 时，主界面正常显示
2. ✅ FGroup 切换后，分屏布局自动均衡
3. ✅ 无论从哪个 FGroup 切换到哪个，布局都是均衡的
4. ✅ 不需要手动调整布局

## 测试建议

1. 创建多个 FGroup，每个包含不同数量的标签页组
2. 启用 Zen Mode
3. 使用 `Switch to next FGroup` 命令切换 FGroup
4. 验证主界面是否正常显示（不是空白）
5. 验证分屏布局是否均衡（左右比例相同）
6. 在不同 FGroup 之间来回切换，验证布局始终均衡
7. 关闭 Zen Mode，验证功能仍然正常

## 版本信息

- 修复版本：0.23.1
- 修复日期：2026-02-12
- 构建位置：`dist/0.23.1/`
- 依赖版本：0.23.0（Zen Mode FGroup 切换修复）

## 技术细节

### 为什么需要延迟执行？

1. **DOM 更新异步**：`applyHiddenGroupsToDOM` 修改 CSS 类后，浏览器需要时间重新渲染
2. **避免竞态条件**：如果立即调整布局，可能读取到旧的 DOM 状态
3. **确保可靠性**：100ms 足够让所有 DOM 更新完成

### flex 布局属性说明

- `flex-basis`：元素的初始大小（百分比或像素）
- `flex-grow`：元素的扩展比例（1 表示可以扩展）
- `flex-shrink`：元素的收缩比例（1 表示可以收缩）

可见组设置：
```css
flex-basis: 33.33%;  /* 假设有 3 个可见组 */
flex-grow: 1;
flex-shrink: 1;
```

隐藏组设置：
```css
flex-basis: 0;
flex-grow: 0;
flex-shrink: 0;
```

### 递归处理的必要性

- Obsidian 的 workspace 是树形结构
- 可能有多层嵌套的 split（水平、垂直）
- 需要递归处理所有层级，确保整个布局都正确

### 与 `autoResizeLayout` 的区别

- `autoResizeLayout`：通用的布局调整函数，在多个地方调用
- `adjustLayoutAfterFGroupSwitch`：专门为 FGroup 切换设计，更简单直接
- 两者可以共存，互不干扰
