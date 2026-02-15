import {
	FileView,
	ItemView,
	MarkdownView,
	Notice,
	OpenViewState,
	Platform,
	Plugin,
	View,
	Workspace,
	WorkspaceLeaf,
	WorkspaceParent,
	addIcon,
} from "obsidian";
import {
	VerticalTabsView,
	VERTICAL_TABS_VIEW,
} from "src/views/VerticalTabsView";
import { DEFAULT_SETTINGS, Settings } from "./models/PluginSettings";
import { around } from "monkey-around";

// Extended types for Obsidian API
interface WorkspaceLeafExtended extends WorkspaceLeaf {
    parent: any;
}

interface WorkspaceTabsExtended {
    id: string;
    type: "tabs";
    children: WorkspaceLeafExtended[];
}

// Supported view types
const supportedViewTypes = 'markdown';

// Get parents for each leaf
function getParentsForEachLeaf(allLeaves: WorkspaceLeafExtended[]): [Map<string, WorkspaceTabsExtended>, string[]] {
	const allTabGroupsMap: Map<string, WorkspaceTabsExtended> = new Map();
	const allTabGroups: string[] = [];
	
	allLeaves.forEach((leaf) => {
		const leafParent = leaf.parent;
		if (!leafParent || (leafParent as any).type !== "tabs") {
			console.error(`Unexpected parent of leaf of type ${(leafParent as any)?.type}, expected 'tabs'. This is not supported and this tab will be skipped`);
			return;
		}
		
		if (!allTabGroupsMap.get(leafParent.id)) {
			allTabGroupsMap.set(leafParent.id, leafParent as WorkspaceTabsExtended);
			allTabGroups.push(leafParent.id);
		}
	});
	
	return [allTabGroupsMap, allTabGroups];
}
import { ZOOM_FACTOR_TOLERANCE } from "./services/TabZoom";
import { useViewState } from "./models/ViewState";
import { ObsidianVerticalTabsSettingTab } from "./views/SettingTab";
import { useSettings } from "./models/PluginContext";
import { nanoid } from "nanoid";
import { patchQuickSwitcher } from "./services/EphemeralTabs";
import { linkTasksStore } from "./stores/LinkTaskStore";
import { parseLink } from "./services/ParseLink";
import { SAFE_DETACH_TIMEOUT } from "./services/CloseTabs";
import { REFRESH_TIMEOUT_LONG } from "./constants/Timeouts";
import { PersistenceManager } from "./models/PersistenceManager";
import { migrateAllData } from "./history/Migration";
import { VERTICAL_TABS_ICON } from "./icon";
import { DISABLE_KEY } from "./models/PluginContext";
import { scrollToActiveTab } from "./services/ScrollableTabs";
import { moveTabToEnd } from "./services/MoveTab";
import { tabCacheStore } from "src/stores/TabCacheStore";

export default class ObsidianVerticalTabs extends Plugin {
	settings: Settings = DEFAULT_SETTINGS;
	persistenceManager: PersistenceManager;

	async onload() {
		addIcon("vertical-tabs", VERTICAL_TABS_ICON);
		await this.loadSettings();
		await this.setupPersistenceManager();
		const disableOnThisDevice =
			this.persistenceManager.device.get<boolean>(DISABLE_KEY) ?? false;
		if (disableOnThisDevice) {
			useSettings.getState().loadSettings(this);
			this.addSettingTab(
				new ObsidianVerticalTabsSettingTab(this.app, this)
			);
			return;
		}
		await this.registerEventsAndViews();
		await this.setupCommands();
		await this.updateViewStates();
		await this.patchViews();
		this.addSettingTab(new ObsidianVerticalTabsSettingTab(this.app, this));
		this.app.workspace.onLayoutReady(() => {
			const isPhone = Platform.isPhone;
			const isUnknownMobile = Platform.isMobile && !Platform.isTablet;
			const tabletOrDesktop = Platform.isTablet || Platform.isDesktop;
			const sidebarCollapse = this.app.workspace.leftSplit.collapsed;
			const shouldCollapse =
				isPhone ||
				isUnknownMobile ||
				(tabletOrDesktop && sidebarCollapse);
			this.openVerticalTabs();
			if (shouldCollapse) {
				setTimeout(() => this.app.workspace.leftSplit.collapse());
			}
			setTimeout(() => {
				useViewState.getState().refreshToggleButtons(this.app);
			}, REFRESH_TIMEOUT_LONG);
		});
	}

	async setupPersistenceManager() {
		this.persistenceManager = new PersistenceManager(
			this.app,
			// The following assertion is safe because we check for
			// `installationID` in `loadSettings`
			// eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
			this.settings.installationID!,
			this.manifest
		);
		migrateAllData(this);
	}

	async registerEventsAndViews() {
		this.registerView(
			VERTICAL_TABS_VIEW,
			(leaf) => new VerticalTabsView(leaf, this)
		);
		this.registerEvents();
	}

	registerEvents() {
		this.registerScrollableTabsEvents();
		this.registerKeyEvents();
		this.registerCtrlClickLinkEvents();
	}

	registerKeyEvents() {
		this.registerDomEvent(window, "keydown", (event) => {
			const {
				exitMissionControlForCurrentGroup,
			} = useViewState.getState();

			if (event.key === "Escape") {
				exitMissionControlForCurrentGroup();
			}
		});
	}

	registerCtrlClickLinkEvents() {
		// Track the last active leaf before Ctrl+click
		let lastActiveLeafBeforeClick: WorkspaceLeaf | null = null;
		let isExpectingNewTab = false;
		let clickTimestamp = 0;

		// Listen for Ctrl+click on links - use mousedown for earlier detection
		this.registerDomEvent(document, "mousedown", (event) => {
			const isCtrlPressed = event.ctrlKey || event.metaKey;
			if (!isCtrlPressed) return;

			// Check if clicked element is a link or inside a link
			const target = event.target as HTMLElement;
			const linkElement = target.closest("a");
			if (!linkElement) return;

			// Check if it's an internal link - more comprehensive detection
			const href = linkElement.getAttribute("href") || linkElement.getAttribute("data-href") || "";
			const isInternalLink = 
				href.startsWith("#") || 
				href.startsWith("app://") || 
				linkElement.hasAttribute("data-href") ||
				linkElement.classList.contains("internal-link") ||
				linkElement.classList.contains("markdown-preview-view") ||
				(!href.startsWith("http") && !href.startsWith("www") && href.length > 0);
			
			if (!isInternalLink) return;

			// Store the current active leaf before the new tab opens
			lastActiveLeafBeforeClick = this.app.workspace.activeLeaf;
			isExpectingNewTab = true;
			clickTimestamp = Date.now();
		}, true); // Use capture phase to catch the event early

		// Also listen on click as fallback
		this.registerDomEvent(document, "click", (event) => {
			if (isExpectingNewTab) return; // Already detected in mousedown
			
			const isCtrlPressed = event.ctrlKey || event.metaKey;
			if (!isCtrlPressed) return;

			const target = event.target as HTMLElement;
			const linkElement = target.closest("a");
			if (!linkElement) return;

			const href = linkElement.getAttribute("href") || linkElement.getAttribute("data-href") || "";
			const isInternalLink = 
				href.startsWith("#") || 
				href.startsWith("app://") || 
				linkElement.hasAttribute("data-href") ||
				linkElement.classList.contains("internal-link") ||
				(!href.startsWith("http") && !href.startsWith("www") && href.length > 0);
			
			if (!isInternalLink) return;

			lastActiveLeafBeforeClick = this.app.workspace.activeLeaf;
			isExpectingNewTab = true;
			clickTimestamp = Date.now();
		}, true);

		// Listen for new leaf creation after Ctrl+click
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (!isExpectingNewTab || !lastActiveLeafBeforeClick) return;
				if (!leaf) return;

				// Check if this is a new leaf (different from the one before click)
				if (leaf.id === lastActiveLeafBeforeClick.id) return;

				// Check if the timing is reasonable (within 2 seconds of click)
				const timeSinceClick = Date.now() - clickTimestamp;
				if (timeSinceClick > 2000) {
					isExpectingNewTab = false;
					lastActiveLeafBeforeClick = null;
					return;
				}

				// Reset the flag immediately to prevent duplicate processing
				isExpectingNewTab = false;

				// Check if the new leaf is a file view (not settings, etc.)
				const viewType = leaf.view.getViewType();
				if (viewType !== "markdown" && viewType !== "image" && viewType !== "pdf") {
					lastActiveLeafBeforeClick = null;
					return;
				}

				// Move the new tab to next FGroup subgroup immediately (no setTimeout)
				this.moveLeafToNextFGroupSubgroupFast(leaf);
				lastActiveLeafBeforeClick = null;
			})
		);
	}

	registerScrollableTabsEvents() {
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				scrollToActiveTab(leaf);
				useViewState.getState().setLatestActiveLeaf(this);
			})
		);
		this.registerEvent(
			this.app.workspace.on("editor-change", (_, info) => {
				if (info instanceof MarkdownView) {
					scrollToActiveTab(info.leaf);
				}
			})
		);
	}

	async setupCommands() {
		this.addCommand({
			id: "open-vertical-tabs",
			name: "Open vertical tabs",
			callback: () => {
				this.openVerticalTabs();
				useSettings.getState().toggleBackgroundMode(this.app, false);
			},
		});

		this.addCommand({
			id: "switch-to-next-fgroup",
			name: "Switch to next FGroup",
			callback: () => {
				useViewState.getState().switchToNextFGroup();
			},
		});

		this.addCommand({
			id: "switch-to-previous-fgroup",
			name: "Switch to previous FGroup",
			callback: () => {
				useViewState.getState().switchToPreviousFGroup();
			},
		});

		this.addCommand({
			id: "swap-fgroup-subgroups",
			name: "Swap FGroup subgroups positions",
			callback: () => {
				useViewState.getState().swapFGroupSubgroups(this.app);
			},
		});

		this.addCommand({
			id: "move-tab-to-next-fgroup-subgroup",
			name: "Move tab to next FGroup subgroup",
			callback: () => this.moveTabToNextGroup(1),
			hotkeys: [
				{
					modifiers: ["Ctrl", "Alt"],
					key: ']'
				}
			]
		});

		this.addCommand({
			id: "move-tab-to-prev-fgroup-subgroup",
			name: "Move tab to previous FGroup subgroup",
			callback: () => this.moveTabToNextGroup(-1),
			hotkeys: [
				{
					modifiers: ["Ctrl", "Alt"],
					key: '['
				}
			]
		});

		// Quick switch between recent subgroups (like Ctrl+Tab)
		this.addCommand({
			id: "switch-to-recent-fgroup-subgroup",
			name: "Switch to recent FGroup subgroup",
			callback: () => {
				useViewState.getState().switchToRecentSubgroup(this.app);
			},
			hotkeys: [
				{
					modifiers: ["Ctrl"],
					key: '`'
				}
			]
		});

		// Cycle through all subgroups in current FGroup
		this.addCommand({
			id: "cycle-fgroup-subgroups",
			name: "Cycle FGroup subgroups",
			callback: () => {
				useViewState.getState().cycleSubgroupsInFGroup(this.app);
			},
			hotkeys: [
				{
					modifiers: ["Ctrl", "Shift"],
					key: '`'
				}
			]
		});

		// Quick switch between recent FGroups (like Alt+Tab)
		this.addCommand({
			id: "switch-to-recent-fgroup",
			name: "Switch to recent FGroup",
			callback: () => {
				useViewState.getState().switchToRecentFGroup();
			}
		});
	}

	async openVerticalTabs() {
		try {
			const leaf: WorkspaceLeaf =
				this.app.workspace.getLeavesOfType(VERTICAL_TABS_VIEW)[0] ??
				this.app.workspace.getLeftLeaf(false);
			leaf.setViewState({ type: VERTICAL_TABS_VIEW, active: true });
			this.app.workspace.revealLeaf(leaf);
		} catch {
			// do nothing
		}
	}

	onunload() {
		// Clean up resources if needed
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		if (!this.settings.installationID) {
			this.settings.installationID = nanoid();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	toggle(classes: string | string[], value: boolean) {
		this.app.workspace.containerEl.doc.body.toggleClass(classes, value);
	}

	async updateViewStates() {
		this.toggle("vt-hide-sidebars", this.settings.hideSidebars);
		this.toggle("vt-show-active-tabs", this.settings.showActiveTabs);
		this.toggle("vt-scrollable-tabs", this.settings.scrollableTabs);
		this.toggle(
			"vt-auto-hide-horizontal-tabs",
			this.settings.autoHideHorizontalTabs
		);
		this.toggle("vt-exclude-self", this.settings.sidebarExcludeSelf);
		this.toggle("vt-trim-tab-names", this.settings.trimTabNames);
		this.toggle("vt-show-more-buttons", this.settings.showMoreButtons);
		this.toggle("vt-use-tab-editing", this.settings.useTabEditing);
		this.toggle("vt-zen-mode", this.settings.zenMode);
		this.toggle("vt-auto-hide-tabs", this.settings.showActiveTabsInZenMode);
		this.toggle("vt-enable-tab-zoom", this.settings.enableTabZoom);
		this.toggle("vt-ephemeral-tabs", this.settings.ephemeralTabs);
		this.toggle("vt-background-mode", this.settings.backgroundMode);
		this.toggle(
			"vt-mission-control-view-disable-pointer",
			this.settings.disablePointerInMissionControlView
		);
	}

	async patchViews() {
		const applyZoom = (view: View, zoom: number) => {
			if (!this.settings.enableTabZoom) {
				return;
			}
			if (zoom <= 0) return;
			const isNonUnitaryZoom = Math.abs(zoom - 1) > ZOOM_FACTOR_TOLERANCE;
			if (isNonUnitaryZoom) {
				view.containerEl.setCssProps({
					"--vt-tab-zoom-factor": zoom.toString(),
				});
			} else {
				view.containerEl.setCssProps({
					"--vt-tab-zoom-factor": "",
				});
			}
			view.leaf.containerEl?.toggleClass(
				"vt-apply-tab-zoom",
				isNonUnitaryZoom
			);
		};

		this.register(
			around(ItemView.prototype, {
				setEphemeralState(old) {
					return function (eState: object) {
						const newState = { zoom: this.zoom ?? 1, ...eState };
						old.call(this, newState);
						this.zoom = newState.zoom;
						applyZoom(this, this.zoom);
					};
				},
				getEphemeralState(old) {
					return function () {
						const eState = old.call(this);
						this.zoom = this.zoom ?? 1;
						applyZoom(this, this.zoom);
						return { zoom: this.zoom, ...eState };
					};
				},
				onload(old) {
					return function () {
						old.call(this);
						applyZoom(this, this.zoom ?? 1);
					};
				},
			})
		);

		const modifyCanNavigate = (
			target: WorkspaceLeaf,
			fallback: () => boolean
		): boolean => {
			if (this.settings.alwaysOpenInNewTab) {
				return false;
			} else if (
				this.settings.ephemeralTabs ||
				this.settings.smartNavigation
			) {
				const ephemeralTabsecision =
					target.isEphemeral === undefined || target.isEphemeral
						? fallback()
						: false;
				const smartNavigationDecision = useViewState
					.getState()
					.executeSmartNavigation(this.app, target, fallback);
				return ephemeralTabsecision && smartNavigationDecision;
			} else {
				return fallback();
			}
		};

		this.register(
			around(WorkspaceLeaf.prototype, {
				canNavigate(old) {
					return function () {
						return modifyCanNavigate(this, () => old.call(this));
					};
				},
				setParent(old) {
					return function (parent) {
						// If guessedCreationTime is not set, we assume the leaf was created now
						if (!this.guessedCreationTime) {
							this.guessedCreationTime = Date.now();
						}
						old.call(this, parent);
					};
				},
			})
		);



		this.register(
			around(FileView.prototype, {
				close(old) {
					return async function () {
						if (this.isDetachingFromVT) {
							return await setTimeout(
								() => old.call(this),
								SAFE_DETACH_TIMEOUT
							);
						} else {
							return old.call(this);
						}
					};
				},
			})
		);

		this.register(
			around(MarkdownView.prototype, {
				getSyncViewState(old) {
					return function () {
						const syncViewState = old.call(this);
						delete syncViewState.eState.zoom;
						return syncViewState;
					};
				},
			})
		);

		this.register(patchQuickSwitcher(this.app));
	}

	// Check if a leaf is in the sidebar (left or right)
	isLeafInSidebar(leaf: WorkspaceLeaf): boolean {
		const workspace = this.app.workspace;
		const leftSplit = workspace.leftSplit;
		const rightSplit = workspace.rightSplit;
		
		// Walk up the parent chain to check if it's in left or right sidebar
		let current: any = leaf;
		while (current) {
			if (current === leftSplit || current === rightSplit) {
				return true;
			}
			current = current.parent;
		}
		return false;
	}

	// Move tab to next/previous group within current active FGroup
	async moveTabToNextGroup(leftOrRight: -1 | 1) {
		const workspace = this.app.workspace;
		const activeLeaf = workspace.activeLeaf;
		if (!activeLeaf) {
			console.log("No active leaf, so cannot move tab to next group");
			return;
		}
		
		// Check if active leaf is in sidebar
		if (this.isLeafInSidebar(activeLeaf)) {
			console.log("Active leaf is in sidebar, skipping");
			return;
		}
		
		const activeFile = (activeLeaf.view as any).file;
		if (!activeFile) {
			console.log("No active file, can't determine what to open in new tab");
			return;
		}

		// Get current active FGroup
		const { fGroups, activeFGroupId } = useViewState.getState();
		if (!activeFGroupId) {
			console.log("No active FGroup, cannot move tab");
			return;
		}
		
		const currentFGroup = fGroups[activeFGroupId];
		if (!currentFGroup) {
			console.log("Active FGroup not found");
			return;
		}
		
		// Get subgroups in current FGroup
		const fGroupSubgroupIds = currentFGroup.groupIds;
		if (fGroupSubgroupIds.length === 0) {
			console.log("Current FGroup has no subgroups");
			return;
		}

		// Get all open leaves of supported types
		const allLeaves = workspace.getLeavesOfType('markdown');
		if (allLeaves.length <= 1) {
			console.log(`0 or 1 leaves; nothing to move`);
			return;
		}

		// Get tab groups (parents of all leaves) that are in current FGroup, excluding sidebar
		const tabGroupsMap = new Map<string, any>();
		const tabGroups: string[] = [];
		
		allLeaves.forEach((leaf) => {
			// Skip leaves in sidebar
			if (this.isLeafInSidebar(leaf)) {
				return;
			}
			
			const parent = (leaf as any).parent;
			if (parent && parent.type === "tabs" && parent.id) {
				// Only include groups that are in current FGroup
				if (fGroupSubgroupIds.includes(parent.id) && !tabGroupsMap.has(parent.id)) {
					tabGroupsMap.set(parent.id, parent);
					tabGroups.push(parent.id);
				}
			}
		});

		if (tabGroups.length === 0) {
			console.error("No tab groups found in current FGroup");
			return;
		}

		let newLeaf: WorkspaceLeaf | null = null;
		if (tabGroups.length === 1) {
			// Only one tab group in FGroup, so split
			newLeaf = workspace.getLeaf('split', 'vertical');
		} else {
			// Multiple tab groups in FGroup, so move to next/previous
			const currentParent = (activeLeaf as any).parent;
			if (!currentParent || !currentParent.id) {
				console.error("Current leaf has no valid parent");
				return;
			}
			
			const currentIndex = tabGroups.findIndex(id => id === currentParent.id);
			if (currentIndex === -1) {
				console.error("Current tab group not found in current FGroup");
				return;
			}

			// Calculate next index with wrap-around within FGroup
			let nextIndex = currentIndex + leftOrRight;
			if (nextIndex >= tabGroups.length) {
				nextIndex = 0;
			} else if (nextIndex < 0) {
				nextIndex = tabGroups.length - 1;
			}
			
			const targetTabGroup = tabGroupsMap.get(tabGroups[nextIndex]);
			if (!targetTabGroup) {
				console.error("Target tab group not found");
				return;
			}

			// Open at the end of the tab group
			const lastIdxInNewTabGroup = targetTabGroup.children.length;
			newLeaf = workspace.createLeafInParent(targetTabGroup, lastIdxInNewTabGroup);
		}

		if (newLeaf) {
			// Close existing leaf and open the same file in the newly created leaf
			activeLeaf.detach();
			await newLeaf.openFile(activeFile);
			workspace.setActiveLeaf(newLeaf, { focus: true });
		}
	}

	// Move a specific leaf to next FGroup subgroup (used for Ctrl+click link handling)
	async moveLeafToNextFGroupSubgroup(leaf: WorkspaceLeaf) {
		const workspace = this.app.workspace;
		
		// Check if leaf is in sidebar
		if (this.isLeafInSidebar(leaf)) {
			console.log("Leaf is in sidebar, skipping");
			return;
		}
		
		const activeFile = (leaf.view as any).file;
		if (!activeFile) {
			console.log("No file in leaf, cannot move");
			return;
		}

		// Get current active FGroup
		const { fGroups, activeFGroupId } = useViewState.getState();
		if (!activeFGroupId) {
			console.log("No active FGroup, cannot move tab");
			return;
		}
		
		const currentFGroup = fGroups[activeFGroupId];
		if (!currentFGroup) {
			console.log("Active FGroup not found");
			return;
		}
		
		// Get subgroups in current FGroup
		const fGroupSubgroupIds = currentFGroup.groupIds;
		if (fGroupSubgroupIds.length === 0) {
			console.log("Current FGroup has no subgroups");
			return;
		}

		// Get all open leaves of supported types
		const allLeaves = workspace.getLeavesOfType('markdown');

		// Get tab groups (parents of all leaves) that are in current FGroup, excluding sidebar
		const tabGroupsMap = new Map<string, any>();
		const tabGroups: string[] = [];
		
		allLeaves.forEach((l) => {
			// Skip leaves in sidebar
			if (this.isLeafInSidebar(l)) {
				return;
			}
			
			const parent = (l as any).parent;
			if (parent && parent.type === "tabs" && parent.id) {
				// Only include groups that are in current FGroup
				if (fGroupSubgroupIds.includes(parent.id) && !tabGroupsMap.has(parent.id)) {
					tabGroupsMap.set(parent.id, parent);
					tabGroups.push(parent.id);
				}
			}
		});

		if (tabGroups.length === 0) {
			console.error("No tab groups found in current FGroup");
			return;
		}

		// Get current leaf's parent group
		const currentParent = (leaf as any).parent;
		if (!currentParent || !currentParent.id) {
			console.error("Leaf has no valid parent");
			return;
		}

		let targetTabGroup: any = null;
		
		if (tabGroups.length === 1) {
			// Only one tab group - need to create a new split
			const newLeaf = workspace.getLeaf('split', 'vertical');
			if (newLeaf) {
				leaf.detach();
				await newLeaf.openFile(activeFile);
				workspace.setActiveLeaf(newLeaf, { focus: true });
			}
			return;
		} else {
			// Multiple tab groups - find next one
			const currentIndex = tabGroups.findIndex(id => id === currentParent.id);
			if (currentIndex === -1) {
				console.error("Current tab group not found in current FGroup");
				return;
			}

			// Calculate next index with wrap-around within FGroup
			let nextIndex = currentIndex + 1;
			if (nextIndex >= tabGroups.length) {
				nextIndex = 0;
			}
			
			targetTabGroup = tabGroupsMap.get(tabGroups[nextIndex]);
			if (!targetTabGroup) {
				console.error("Target tab group not found");
				return;
			}
		}

		if (targetTabGroup) {
			// Move the leaf to the target tab group
			const lastIdxInNewTabGroup = targetTabGroup.children.length;
			const newLeaf = workspace.createLeafInParent(targetTabGroup, lastIdxInNewTabGroup);
			
			if (newLeaf) {
				leaf.detach();
				await newLeaf.openFile(activeFile);
				workspace.setActiveLeaf(newLeaf, { focus: true });
			}
		}
	}

	// Fast version for Ctrl+click - uses setViewState instead of detach/openFile for better performance
	moveLeafToNextFGroupSubgroupFast(leaf: WorkspaceLeaf) {
		const workspace = this.app.workspace;
		
		// Check if leaf is in sidebar
		if (this.isLeafInSidebar(leaf)) {
			return;
		}

		// Get current active FGroup
		const { fGroups, activeFGroupId } = useViewState.getState();
		if (!activeFGroupId) {
			return;
		}
		
		const currentFGroup = fGroups[activeFGroupId];
		if (!currentFGroup) {
			return;
		}
		
		// Get subgroups in current FGroup
		const fGroupSubgroupIds = currentFGroup.groupIds;
		if (fGroupSubgroupIds.length === 0) {
			return;
		}

		// Get current leaf's parent group
		const currentParent = (leaf as any).parent;
		if (!currentParent || !currentParent.id) {
			return;
		}

		// Quick check: if current parent is not in FGroup, skip
		if (!fGroupSubgroupIds.includes(currentParent.id)) {
			return;
		}

		// Get tab groups in FGroup - use cached info from ViewState if possible
		const tabGroups: string[] = [];
		fGroupSubgroupIds.forEach((id: string) => {
			// Try to find the tab group in workspace
			const allLeaves = workspace.getLeavesOfType('markdown');
			for (const l of allLeaves) {
				const parent = (l as any).parent;
				if (parent && parent.id === id && !tabGroups.includes(id)) {
					tabGroups.push(id);
					break;
				}
			}
		});

		if (tabGroups.length <= 1) {
			// Only one tab group - need to split
			// For fast version, we just split and move
			const viewState = leaf.getViewState();
			const newLeaf = workspace.getLeaf('split', 'vertical');
			if (newLeaf) {
				// Use setViewState for faster switching
				newLeaf.setViewState(viewState);
				leaf.detach();
				workspace.setActiveLeaf(newLeaf, { focus: true });
			}
			return;
		}

		// Find current index and next index
		const currentIndex = tabGroups.findIndex(id => id === currentParent.id);
		if (currentIndex === -1) {
			return;
		}

		let nextIndex = currentIndex + 1;
		if (nextIndex >= tabGroups.length) {
			nextIndex = 0;
		}

		const targetGroupId = tabGroups[nextIndex];
		
		// Find target tab group
		let targetTabGroup: any = null;
		const allLeaves = workspace.getLeavesOfType('markdown');
		for (const l of allLeaves) {
			const parent = (l as any).parent;
			if (parent && parent.id === targetGroupId) {
				targetTabGroup = parent;
				break;
			}
		}

		if (!targetTabGroup) {
			return;
		}

		// Fast move: create new leaf, set view state, detach old leaf
		const lastIdxInNewTabGroup = targetTabGroup.children.length;
		const newLeaf = workspace.createLeafInParent(targetTabGroup, lastIdxInNewTabGroup);
		
		if (newLeaf) {
			// Get view state before detaching
			const viewState = leaf.getViewState();
			// Set view state on new leaf (faster than openFile)
			newLeaf.setViewState(viewState);
			// Detach old leaf
			leaf.detach();
			// Set active
			workspace.setActiveLeaf(newLeaf, { focus: true });
		}
	}
}
