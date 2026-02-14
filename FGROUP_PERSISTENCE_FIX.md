# FGroup 排他性持久化修复说明 - v0.22.6

## 问题描述

当所有 FGroup 在侧边栏中都折叠后，FGroup 的排他性显示功能失效，主工作区显示了所有标签组。点击任意一个 FGroup 标题后，排他性显示又恢复正常。

## 根本原因分析

1. **状态持久化不完整**：
   - `hiddenGroups`（隐藏的组列表）被保存到 localStorage
   - 但 `activeFGroupId`（当前激活的 FGroup ID）没有被保存
   - 页面刷新或所有 FGroup 折叠后，`activeFGroupId` 重置为 `null`

2. **状态不一致**：
   - `hiddenGroups` 有值（表示某些组应该被隐藏）
   - 但 `activeFGroupId` 为 `null`（表示没有激活的 FGroup）
   - 这导致系统不知道应该显示哪个 FGroup 的组

3. **初始化时机问题**：
   - 页面加载时，`hiddenGroups` 从 localStorage 加载
   - 但没有立即应用到 DOM（需要等待 React 渲染）
   - 如果此时所有 FGroup 都折叠，可能导致状态不同步

## 修复方案

### 1. 持久化 `activeFGroupId`

添加保存和加载 `activeFGroupId` 的函数：

```typescript
const saveActiveFGroupId = (fGroupId: string | null) => {
    if (fGroupId) {
        localStorage.setItem("active-fgroup-id", fGroupId);
    } else {
        localStorage.removeItem("active-fgroup-id");
    }
};

const loadActiveFGroupId = (): string | null => {
    return localStorage.getItem("active-fgroup-id");
};
```

### 2. 初始化时加载 `activeFGroupId`

修改 ViewState 的初始化：

```typescript
export const useViewState = create<ViewState>()((set, get) => ({
    // ...
    activeFGroupId: loadActiveFGroupId(),  // 从 localStorage 加载
    // ...
}));
```

### 3. 切换 FGroup 时保存 `activeFGroupId`

在 `toggleFGroup` 函数中添加保存逻辑：

```typescript
toggleFGroup: (fGroupId: string) => {
    // ... 计算 hiddenGroups ...
    
    // 更新状态
    set({ 
        activeFGroupId: fGroupId,
        hiddenGroups: newHiddenGroups
    });
    
    // 保存状态
    saveHiddenGroups(newHiddenGroups);
    saveActiveFGroupId(fGroupId);  // 新增：保存激活的 FGroup ID
    
    // 立即应用到 DOM
    get().applyHiddenGroupsToDOM();
},
```

### 4. 页面加载时恢复排他性显示

在 `NavigationContainer` 组件挂载时，检查并应用保存的状态：

```typescript
useEffect(() => {
    // ... 其他初始化逻辑 ...
    
    // 应用保存的 FGroup 排他性显示
    const { activeFGroupId, applyHiddenGroupsToDOM } = useViewState.getState();
    if (activeFGroupId) {
        setTimeout(() => {
            applyHiddenGroupsToDOM();
        }, 300);
    }
    
    // ...
}, []);
```

## 修复效果

这些改进确保了：
1. ✅ FGroup 的排他性显示状态在页面刷新后保持
2. ✅ 所有 FGroup 折叠后，排他性显示仍然有效
3. ✅ `activeFGroupId` 和 `hiddenGroups` 状态始终保持一致
4. ✅ 页面加载时自动恢复上次的 FGroup 显示状态

## 测试建议

1. 创建多个 FGroup，每个包含不同的标签页组
2. 点击某个 FGroup 标题，激活排他性显示
3. 在侧边栏中折叠所有 FGroup（点击倒三角图标）
4. 验证主工作区的标签页显示是否保持正确（只显示激活的 FGroup 的组）
5. 刷新页面，验证排他性显示是否保持
6. 展开 FGroup，验证功能仍然正常

## 版本信息

- 修复版本：0.22.6
- 修复日期：2026-02-12
- 构建位置：`dist/0.22.6/`
- 依赖版本：
  - 0.22.4（workspace 切换修复）
  - 0.22.5（FGroup 折叠修复）

## 技术细节

### 为什么需要持久化 `activeFGroupId`？

1. **状态一致性**：`hiddenGroups` 和 `activeFGroupId` 必须配套使用
2. **用户体验**：用户期望刷新页面后保持相同的视图状态
3. **避免混淆**：如果只保存 `hiddenGroups`，系统不知道哪个 FGroup 是激活的

### 为什么需要延迟应用 DOM 更新？

1. **等待 DOM 就绪**：页面加载时，workspace 的 DOM 可能还未完全构建
2. **避免竞态条件**：React 组件的渲染和 Obsidian 的初始化可能有时序问题
3. **确保可靠性**：300ms 的延迟足够让所有初始化完成

### localStorage 存储的数据

- `hidden-groups`：隐藏的组 ID 列表（JSON 数组）
- `active-fgroup-id`：当前激活的 FGroup ID（字符串）
- `tab-groups`：所有 FGroup 的定义（JSON 对象）

这三个数据配合使用，完整保存了 FGroup 的状态。
