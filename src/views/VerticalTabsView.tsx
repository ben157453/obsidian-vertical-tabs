import { StrictMode } from "react";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { NavigationContainer } from "../components/NavigationContainer";
import { PluginContext } from "../models/PluginContext";
import ObsidianVerticalTabs from "../main";

export const VERTICAL_TABS_VIEW = "vertical-tabs";

export class VerticalTabsView extends ItemView {
	root: Root | null = null;
	plugin: ObsidianVerticalTabs;
	private isRendered: boolean = false;

	constructor(leaf: WorkspaceLeaf, plugin: ObsidianVerticalTabs) {
		super(leaf);
		this.navigation = false;
		this.plugin = plugin;
		this.icon = "vertical-tabs";
		this.leaf.containerEl?.addClass("obsidian-vertical-tabs-tab-content");
		this.leaf.tabHeaderEl?.addClass("obsidian-vertical-tabs-tab-header");
	}

	getViewType() {
		return VERTICAL_TABS_VIEW;
	}

	getDisplayText() {
		return "Vertical tabs";
	}

	async onOpen() {
		this.renderView();
	}

	private renderView() {
		// Clean up existing root if any
		if (this.root) {
			try {
				this.root.unmount();
			} catch (e) {
				console.warn("[VerticalTabs] Error unmounting root:", e);
			}
		}

		// Clear container
		this.containerEl.empty();

		// Create new root and render
		this.root = createRoot(this.containerEl);
		this.root.render(
			<StrictMode>
				<PluginContext.Provider value={this.plugin}>
					<NavigationContainer />
				</PluginContext.Provider>
			</StrictMode>
		);
		this.isRendered = true;
	}

	// Force re-render when view becomes visible
	async onResize() {
		super.onResize();
		// If the view was not properly rendered, force a re-render
		if (!this.isRendered || !this.containerEl.hasChildNodes()) {
			this.renderView();
		}
	}

	async onClose() {
		this.isRendered = false;
		this.root?.unmount();
	}
}
