# 工作区状态管理指南

本指南详细介绍如何在 Obsidian 插件中实现工作区状态管理功能，使每个工作区能够保存和加载对应的插件状态。

## 适用场景

- 插件需要为不同工作区保持不同的状态
- 用户在切换工作区时希望插件状态能够自动恢复
- 需要与 `obsidian-workspaces-plus` 插件配合使用

## 实现原理

1. **事件监听**：监听 `workspace-save` 和 `workspace-load` 事件
2. **状态存储**：在工作区保存时存储插件状态
3. **状态恢复**：在工作区加载时恢复对应状态
4. **设置选项**：提供开关让用户控制此功能

## 核心实现步骤

### 1. 定义状态接口

首先，在插件的主文件中定义状态接口：

```typescript
// 工作区状态接口
interface WorkspacePluginState {
  // 在此定义你的插件需要保存的状态
  // 例如：activeTab: string | null;
  //       expandedItems: string[];
}

// 插件设置接口
interface PluginSettings {
  // 其他设置...
  workspaceStates?: Record<string, WorkspacePluginState>;
  workspaceIntegration?: boolean;
}

// 默认设置
const DEFAULT_SETTINGS: PluginSettings = {
  // 其他默认值...
  workspaceStates: {},
  workspaceIntegration: true
};
```

### 2. 注册事件监听器

在插件的 `onload` 方法中注册工作区事件监听器：

```typescript
async onload() {
  await this.loadSettings();
  
  // 其他初始化代码...
  
  // 注册工作区事件监听器
  this.registerEvent((this.app.workspace as any).on("workspace-save", this.onWorkspaceSave));
  this.registerEvent((this.app.workspace as any).on("workspace-load", this.onWorkspaceLoad));
}
```

### 3. 实现事件处理方法

添加工作区事件处理方法：

```typescript
// 获取当前插件状态
private getCurrentPluginState(): WorkspacePluginState {
  // 实现获取当前状态的逻辑
  // 例如：return { activeTab: this.currentTab, expandedItems: this.expandedItems };
  return {};
}

// 设置插件状态
private setPluginState(state: WorkspacePluginState) {
  // 实现设置状态的逻辑
  // 例如：this.currentTab = state.activeTab;
  //       this.expandedItems = state.expandedItems;
  
  // 触发状态更新
  this.triggerStateUpdate();
}

// 处理工作区保存事件
private onWorkspaceSave = (workspaceName: string) => {
  try {
    if (!workspaceName || !this.settings.workspaceIntegration) return;

    const state = this.getCurrentPluginState();
    
    if (!this.settings.workspaceStates) {
      this.settings.workspaceStates = {};
    }
    
    this.settings.workspaceStates[workspaceName] = state;
    this.saveSettings(false);
    
    console.log(`[YourPlugin] Saved state for workspace: ${workspaceName}`);
  } catch (error) {
    console.error('[YourPlugin] Error saving workspace state:', error);
  }
};

// 处理工作区加载事件
private onWorkspaceLoad = (workspaceName: string) => {
  try {
    if (!workspaceName || !this.settings.workspaceIntegration || !this.settings.workspaceStates) return;

    const state = this.settings.workspaceStates[workspaceName];
    if (state) {
      this.setPluginState(state);
      console.log(`[YourPlugin] Loaded state for workspace: ${workspaceName}`);
    }
  } catch (error) {
    console.error('[YourPlugin] Error loading workspace state:', error);
  }
};
```

### 4. 添加设置选项

在设置标签页中添加工作区集成开关：

```typescript
// 在设置标签页的 display 方法中添加
new Setting(containerEl)
  .setName("Workspace Integration")
  .setDesc("Save and load plugin state with workspaces (requires Workspaces Plus plugin)")
  .addToggle(toggle => {
    toggle
      .setValue(this.plugin.settings.workspaceIntegration ?? true)
      .onChange(async (value) => {
        this.plugin.settings.workspaceIntegration = value;
        await this.plugin.saveSettings();
      });
  });
```

### 5. 组件状态管理（React 组件）

如果你的插件使用 React 组件，可以这样暴露状态：

```typescript
// 在组件中添加
const getCurrentState = () => {
  return {
    // 返回组件的当前状态
  };
};

// 暴露状态给插件
useEffect(() => {
  if (plugin) {
    (plugin as any).getPluginState = getCurrentState;
  }
  
  return () => {
    if (plugin) {
      delete (plugin as any).getPluginState;
    }
  };
}, [/* 依赖项 */]);

// 在插件中更新 getCurrentPluginState 方法
private getCurrentPluginState(): WorkspacePluginState {
  // 尝试从组件获取状态
  if ((this as any).getPluginState) {
    try {
      return (this as any).getPluginState();
    } catch (error) {
      console.warn('[YourPlugin] Error getting state from component:', error);
    }
  }
  
  //  fallback 逻辑
  return {};
}
```

## 完整示例

### 插件主文件示例

```typescript
import { Plugin } from "obsidian";
import { YourPluginSettingTab } from "./settings";

interface WorkspacePluginState {
  activeTab: string | null;
  expandedItems: string[];
}

interface PluginSettings {
  workspaceStates?: Record<string, WorkspacePluginState>;
  workspaceIntegration?: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
  workspaceStates: {},
  workspaceIntegration: true
};

export default class YourPlugin extends Plugin {
  settings: PluginSettings;
  activeTab: string | null = null;
  expandedItems: string[] = [];

  async onload() {
    await this.loadSettings();
    
    this.addSettingTab(new YourPluginSettingTab(this.app, this));
    
    // 注册工作区事件监听器
    this.registerEvent((this.app.workspace as any).on("workspace-save", this.onWorkspaceSave));
    this.registerEvent((this.app.workspace as any).on("workspace-load", this.onWorkspaceLoad));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(triggerListener: boolean = true) {
    await this.saveData(this.settings);
    // 触发设置更改事件（如果需要）
  }

  private getCurrentPluginState(): WorkspacePluginState {
    return {
      activeTab: this.activeTab,
      expandedItems: this.expandedItems
    };
  }

  private setPluginState(state: WorkspacePluginState) {
    this.activeTab = state.activeTab;
    this.expandedItems = state.expandedItems || [];
    // 触发 UI 更新
  }

  private onWorkspaceSave = (workspaceName: string) => {
    try {
      if (!workspaceName || !this.settings.workspaceIntegration) return;

      const state = this.getCurrentPluginState();
      
      if (!this.settings.workspaceStates) {
        this.settings.workspaceStates = {};
      }
      
      this.settings.workspaceStates[workspaceName] = state;
      this.saveSettings(false);
    } catch (error) {
      console.error('[YourPlugin] Error saving workspace state:', error);
    }
  };

  private onWorkspaceLoad = (workspaceName: string) => {
    try {
      if (!workspaceName || !this.settings.workspaceIntegration || !this.settings.workspaceStates) return;

      const state = this.settings.workspaceStates[workspaceName];
      if (state) {
        this.setPluginState(state);
      }
    } catch (error) {
      console.error('[YourPlugin] Error loading workspace state:', error);
    }
  };
}
```

### 设置标签页示例

```typescript
import { App, PluginSettingTab, Setting } from "obsidian";
import YourPlugin from "./main";

export class YourPluginSettingTab extends PluginSettingTab {
  plugin: YourPlugin;

  constructor(app: App, plugin: YourPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Your Plugin Settings" });

    // 工作区集成设置
    new Setting(containerEl)
      .setName("Workspace Integration")
      .setDesc("Save and load plugin state with workspaces (requires Workspaces Plus plugin)")
      .addToggle(toggle => {
        toggle
          .setValue(this.plugin.settings.workspaceIntegration ?? true)
          .onChange(async (value) => {
            this.plugin.settings.workspaceIntegration = value;
            await this.plugin.saveSettings();
          });
      });

    // 其他设置...
  }
}
```

## 依赖要求

- **Obsidian**：最新版本
- **obsidian-workspaces-plus**：任意版本（已内置事件触发机制）

## 最佳实践

1. **状态精简**：只保存必要的状态，避免存储过多数据
2. **错误处理**：添加适当的错误处理，确保功能稳定
3. **默认值**：提供合理的默认值，确保状态恢复失败时的回退机制
4. **用户反馈**：在控制台添加适当的日志，方便调试
5. **性能优化**：对于复杂状态，考虑使用防抖或节流

## 测试方法

1. **功能测试**：
   - 启用工作区集成
   - 切换工作区并修改插件状态
   - 切换回原工作区，检查状态是否恢复

2. **边界测试**：
   - 禁用工作区集成，检查是否停止工作
   - 测试空状态的处理
   - 测试状态恢复失败的情况

## 故障排除

### 常见问题

1. **事件未触发**：
   - 确保已安装并启用 `obsidian-workspaces-plus` 插件
   - 检查事件名称是否正确

2. **状态未保存**：
   - 检查 `workspaceIntegration` 选项是否启用
   - 检查状态获取方法是否正确

3. **状态未恢复**：
   - 检查状态存储路径是否正确
   - 检查状态设置方法是否正确

### 调试技巧

1. **添加日志**：在关键位置添加 console.log 语句
2. **检查存储**：在设置文件中检查 `workspaceStates` 是否正确存储
3. **事件监听**：确认事件监听器已正确注册

## 总结

通过本指南的实现方法，你可以为任何 Obsidian 插件添加工作区状态管理功能，使插件能够为不同工作区保持不同的状态。这种方法不需要修改 `obsidian-workspaces-plus` 插件，只需要在你的插件中添加相应的事件监听器和状态管理逻辑即可。

此实现方式不仅适用于书签插件，也适用于任何需要状态管理的插件，如文件浏览器、任务管理、笔记组织等。