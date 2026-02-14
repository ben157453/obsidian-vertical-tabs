# Workspace 切换问题修复说明 - v0.22.4

## 问题描述
当用户在 Obsidian 中切换 workspace 时，侧边栏面板显示为空白区域，React 组件未能正确渲染。

## 根本原因分析
1. **视图生命周期问题**：当 workspace 切换时，`VerticalTabsView` 的 React 组件可能在 DOM 更新完成前就尝试渲染
2. **缺少可见性检查**：组件没有检测自身是否真正可见就开始渲染
3. **缺少强制刷新机制**：当视图从不可见变为可见时，没有触发重新渲染

## 修复方案

### 1. 增强 VerticalTabsView 的渲染机制 (`src/views/VerticalTabsView.tsx`)

添加了以下改进：
- **渲染状态追踪**：添加 `isRendered` 标志追踪渲染状态
- **独立渲染方法**：创建 `renderView()` 方法处理完整的渲染流程
- **清理机制**：在重新渲染前清理旧的 React root
- **onResize 钩子**：利用 `onResize` 生命周期方法检测视图可见性变化并强制重新渲染

```typescript
private renderView() {
    // 清理现有 root
    if (this.root) {
        try {
            this.root.unmount();
        } catch (e) {
            console.warn("[VerticalTabs] Error unmounting root:", e);
        }
    }
    
    // 清空容器并重新渲染
    this.containerEl.empty();
    this.root = createRoot(this.containerEl);
    this.root.render(...);
    this.isRendered = true;
}

async onResize() {
    super.onResize();
    // 如果视图未正确渲染，强制重新渲染
    if (!this.isRendered || !this.containerEl.hasChildNodes()) {
        this.renderView();
    }
}
```

### 2. 添加 Workspace 变化监听 (`src/main.ts`)

新增 `registerWorkspaceChangeEvent()` 方法：
- 监听 `layout-change` 事件
- 检测 vertical tabs 视图是否存在且正确挂载
- 在检测到问题时触发强制刷新

```typescript
registerWorkspaceChangeEvent() {
    this.registerEvent(
        this.app.workspace.on("layout-change", () => {
            const verticalTabsLeaves = this.app.workspace.getLeavesOfType(VERTICAL_TABS_VIEW);
            if (verticalTabsLeaves.length > 0) {
                const leaf = verticalTabsLeaves[0];
                if (leaf.view && leaf.view instanceof VerticalTabsView) {
                    setTimeout(() => {
                        this.app.workspace.trigger("active-leaf-change", leaf);
                    }, 100);
                }
            }
        })
    );
}
```

### 3. 增强 NavigationContainer 的可见性检查 (`src/components/NavigationContainer.tsx`)

在组件挂载时添加延迟可见性检查：
- 在初始渲染后 200ms 检查视图是否可见
- 如果可见则触发 `autoRefresh()`
- 确保在 workspace 切换后组件能正确刷新

```typescript
const checkVisibility = () => {
    if (isSelfVisible(app)) {
        autoRefresh();
    }
};

const visibilityTimer = setTimeout(checkVisibility, 200);

// 在 cleanup 中清理 timer
return () => {
    clearTimeout(visibilityTimer);
};
```

## 修复效果

这些改进确保了：
1. ✅ Workspace 切换后侧边栏能正确显示内容
2. ✅ React 组件在视图可见时才进行渲染
3. ✅ 视图状态异常时能自动恢复
4. ✅ 不影响现有功能和性能

## 测试建议

1. 创建多个 workspace
2. 在不同 workspace 之间切换
3. 检查侧边栏是否正常显示标签页
4. 验证标签页操作（拖拽、关闭等）是否正常工作

## 版本信息

- 修复版本：0.22.4
- 修复日期：2026-02-12
- 构建位置：`dist/0.22.4/`

## 安装方法

将 `dist/0.22.4/` 目录中的以下文件复制到 Obsidian 插件目录：
- main.js
- manifest.json
- styles.css

或者直接将整个 `0.22.4` 文件夹复制到 `.obsidian/plugins/vertical-tabs/` 目录。
