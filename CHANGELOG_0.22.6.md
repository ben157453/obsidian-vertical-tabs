# 版本 0.22.6 更新日志

## 🐛 Bug 修复

### 修复 FGroup 排他性显示在所有组折叠后失效的问题

**问题**：当所有 FGroup 在侧边栏中都折叠后（点击倒三角图标），FGroup 的排他性显示功能失效，主工作区显示了所有标签组。点击任意一个 FGroup 标题后，排他性显示又恢复正常。

**根本原因**：
- `hiddenGroups`（隐藏的组列表）被持久化保存
- 但 `activeFGroupId`（当前激活的 FGroup ID）没有被保存
- 导致页面刷新或状态重置后，系统不知道哪个 FGroup 是激活的
- 状态不一致导致排他性显示失效

**修复内容**：

1. **持久化 `activeFGroupId`**
   - 添加 `saveActiveFGroupId` 和 `loadActiveFGroupId` 函数
   - 在 `toggleFGroup` 时保存激活的 FGroup ID
   - 页面加载时从 localStorage 恢复

2. **初始化时恢复排他性显示**
   - 在 `NavigationContainer` 组件挂载时检查 `activeFGroupId`
   - 如果有激活的 FGroup，立即应用 `hiddenGroups` 到 DOM
   - 确保页面加载后立即显示正确的状态

3. **状态一致性保障**
   - `activeFGroupId` 和 `hiddenGroups` 始终配套保存和加载
   - 避免状态不一致导致的显示问题

**技术实现**：
```typescript
// 持久化 activeFGroupId
const saveActiveFGroupId = (fGroupId: string | null) => {
    if (fGroupId) {
        localStorage.setItem("active-fgroup-id", fGroupId);
    } else {
        localStorage.removeItem("active-fgroup-id");
    }
};

// 初始化时加载
activeFGroupId: loadActiveFGroupId(),

// 切换时保存
saveActiveFGroupId(fGroupId);

// 页面加载时应用
if (activeFGroupId) {
    setTimeout(() => {
        applyHiddenGroupsToDOM();
    }, 300);
}
```

**影响范围**：
- 修复了 FGroup 排他性显示的持久化问题
- 确保页面刷新后保持相同的视图状态
- 所有 FGroup 折叠后，排他性显示仍然有效

**测试方法**：
1. 创建多个 FGroup，每个包含不同的标签页组
2. 点击某个 FGroup 标题，激活排他性显示
3. 在侧边栏中折叠所有 FGroup（点击倒三角图标）
4. 验证主工作区的标签页显示是否保持正确
5. 刷新页面，验证排他性显示是否保持

---

## 📦 构建信息

- 版本号：0.22.6
- 构建日期：2026-02-12
- 最低 Obsidian 版本：1.6.2
- 基于版本：
  - 0.22.4（workspace 切换修复）
  - 0.22.5（FGroup 折叠修复）

## 📁 文件位置

构建文件位于：`dist/0.22.6/`
- main.js
- manifest.json
- styles.css

## 🔗 相关修复

本版本建议与之前的版本一起使用：
- v0.22.4：修复 workspace 切换时侧边栏空白问题
- v0.22.5：修复 FGroup 折叠时排他性显示失效问题
- v0.22.6：修复 FGroup 排他性显示的持久化问题

## 💡 技术说明

### localStorage 存储的数据

插件现在在 localStorage 中存储以下数据：
- `hidden-groups`：隐藏的组 ID 列表
- `active-fgroup-id`：当前激活的 FGroup ID（新增）
- `tab-groups`：所有 FGroup 的定义

这三个数据配合使用，完整保存了 FGroup 的状态。

### 为什么需要延迟应用 DOM 更新？

页面加载时使用 300ms 延迟的原因：
1. 等待 Obsidian workspace 的 DOM 完全构建
2. 避免与 React 组件渲染的竞态条件
3. 确保所有初始化完成后再应用状态

### 状态一致性

修复后，以下状态始终保持一致：
- `activeFGroupId`：指示哪个 FGroup 是激活的
- `hiddenGroups`：列出哪些组应该被隐藏
- DOM 的 `is-hidden` CSS 类：实际的显示/隐藏效果

这三者必须同步，才能确保 FGroup 排他性显示正常工作。
