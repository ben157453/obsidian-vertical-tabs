import { create } from "zustand";
import { DefaultRecord } from "src/utils/DefaultRecord";
import {
	App,
	debounce,
	EventRef,
	Platform,
	View,
	Workspace,
	WorkspaceLeaf,
	WorkspaceParent,
} from "obsidian";
import ObsidianVerticalTabs from "src/main";
import {
	getFrameStyle,
	hasControlButtonsOnTheLeft,
	hasControlButtonsOnTheRight,
	isRibbonVisible,
	WindowFrameStyle,
} from "src/services/WindowFrame";
import {
	hasLeftSidebarToggle,
	hasRightSidebarToggle,
	insertLeftSidebarToggle,
	insertRightSidebarToggle,
} from "src/services/SidebarToggles";
import { getGroupType, GroupType, Identifier } from "./VTWorkspace";
import { tabCacheStore } from "../stores/TabCacheStore";
import { pinDrawer, unpinDrawer } from "src/services/MobileDrawer";
import { CommandCheckCallback, getCommandByName } from "src/services/Commands";
import { LinkedFolder } from "src/services/OpenFolder";
import { useSettings } from "./PluginContext";
import {
	GroupViewType,
	identifyGroupViewType,
	setGroupViewType,
} from "./VTGroupView";
import { managedLeafStore } from "src/stores/ManagedLeafStore";
import { EVENTS } from "src/constants/Events";
import { REFRESH_TIMEOUT_LONG } from "src/constants/Timeouts";
import { isHoverEditorEnabled } from "src/services/HoverEditorTabs";
import { autoResizeLayout } from "src/services/AutoResizeLayout";
export const DEFAULT_GROUP_TITLE = "Grouped tabs";
const factory = () => DEFAULT_GROUP_TITLE;

export type GroupTitles = DefaultRecord<Identifier, string>;
export const createNewGroupTitles = () =>
	new DefaultRecord(factory) as GroupTitles;

export type PinningEvents = DefaultRecord<Identifier, EventRef | null>;
export type PinningEventCallback = (pinned: boolean) => void;
export const createNewPinningEvents = () =>
	new DefaultRecord(() => null) as PinningEvents;

export type EphermalToggleEvents = DefaultRecord<Identifier, EventRef | null>;
export type EphermalToggleEventCallback = (isEphemeral: boolean) => void;
export const createNewEphermalToggleEvents = () =>
	new DefaultRecord(() => null) as EphermalToggleEvents;

export type GroupViewToggleEvents = DefaultRecord<Identifier, EventRef | null>;
export type GroupViewToggleEventCallback = (viewType: GroupViewType) => void;
export const createNewGroupViewToggleEvents = () =>
	new DefaultRecord(() => null) as GroupViewToggleEvents;

export type LinkedGroups = DefaultRecord<Identifier, LinkedFolder | null>;
export const createNewLinkedGroups = () =>
	new DefaultRecord(() => null) as LinkedGroups;

export interface FGroup {
	id: string;
	name: string;
	groupIds: string[];
	isHidden: boolean;
}

export type FGroups = Record<string, FGroup>;
export const createNewFGroups = (): FGroups => ({});

export type ViewCueIndex = number | string | undefined;
export const MIN_INDEX_KEY = 1;
export const MAX_INDEX_KEY = 8;
export const LAST_INDEX_KEY = 9;
export const VIEW_CUE_NEXT = "→";
export const VIEW_CUE_PREV = "←";
export const VIEW_CUE_DELAY = 600;
export type ViewCueNativeCallback = CommandCheckCallback;
export type ViewCueNativeCallbackMap = Map<number, ViewCueNativeCallback>;
export type ViewCueFirstTabs = DefaultRecord<Identifier, HTMLElement | null>;
export const createNewViewCueFirstTabs = () =>
	new DefaultRecord(() => null) as ViewCueFirstTabs;

export const ALT_KEY_EFFECT_DURATION = 2000;
export const SHIFT_ENTER_EFFECT_DURATION = 1000;

interface ViewState {
	groupTitles: GroupTitles;
	hiddenGroups: Array<Identifier>;
	collapsedGroups: Array<Identifier>;
	expandedGroups: Array<Identifier>;
	nonEphemeralTabs: Array<Identifier>;
	latestActiveLeaf: WorkspaceLeaf | null;
	latestActiveTab: HTMLElement | null;
	pinningEvents: PinningEvents;
	ephermalToggleEvents: EphermalToggleEvents;
	groupViewToggleEvents: GroupViewToggleEvents;
	globalCollapseState: boolean;
	isEditingTabs: boolean;
	memoizedCollapsedGroups: Array<Identifier>;
	memoizedExpandedGroups: Array<Identifier>;
	fGroups: FGroups;
	activeFGroupId: string | null;
	toggleFGroup: (fGroupId: string) => void;
	getAllFGroups: () => FGroup[];
	switchToNextFGroup: () => void;
	switchToPreviousFGroup: () => void;
	setGroupTitle: (id: Identifier, name: string) => void;
	toggleCollapsedGroup: (id: Identifier, isCollapsed: boolean) => void;
	toggleHiddenGroup: (id: Identifier, isHidden: boolean) => void;
	rememberNonephemeralTab: (app: App, id: Identifier) => void;
	forgetNonephemeralTabs: () => void;
	setLatestActiveLeaf: (
		plugin: ObsidianVerticalTabs,
		leaf?: WorkspaceLeaf | null
	) => void;
	lockFocus: (plugin: ObsidianVerticalTabs) => void;
	lockFocusOnLeaf: (app: App, leaf: WorkspaceLeaf) => void;
	linkedGroups: LinkedGroups;
	resetFocusFlags: () => void;
	hookLatestActiveTab: (tab: HTMLElement | null) => void;
	scorllToActiveTab: () => void;
	leftButtonClone: HTMLElement | null;
	rightButtonClone: HTMLElement | null;
	topLeftContainer: Element | null;
	topRightContainer: Element | null;
	topRightMainContainer: Element | null;
	allTopContainers: Array<Element>;
	cloneToggleButtons: (app: App) => void;
	removeCloneButtons: () => void;
	insertCloneButtons: () => void;
	updatePositionLabels: () => void;
	refreshToggleButtons: (app: App) => void;
	bindPinningEvent: (
		leaf: WorkspaceLeaf,
		callback: PinningEventCallback
	) => void;
	unbindPinningEvent: (leaf: WorkspaceLeaf) => void;
	bindEphemeralToggleEvent: (
		app: App,
		leaf: WorkspaceLeaf,
		callback: EphermalToggleEventCallback
	) => void;
	unbindEphemeralToggleEvent: (leaf: WorkspaceLeaf) => void;
	bindGroupViewToggleEvent: (
		group: WorkspaceParent | null,
		callback: GroupViewToggleEventCallback
	) => void;
	unbindGroupViewToggleEvent: (group: WorkspaceParent | null) => void;
	setAllCollapsed: () => void;
	setAllExpanded: () => void;
	uncollapseActiveGroup: (app: App) => void;
	executeSmartNavigation: (
		app: App,
		target: WorkspaceLeaf,
		fallback: () => boolean
	) => boolean;
	checkIfGroupChanged: (
		workspace: Workspace,
		oldLeaf: WorkspaceLeaf | null,
		newLeaf: WorkspaceLeaf | null
	) => boolean;
	setIsEditingTabs: (app: App, isEditing: boolean) => void;
	addLinkedGroup: (groupID: Identifier, linkedFolder: LinkedFolder) => void;
	removeLinkedGroup: (group: WorkspaceParent) => void;
	getLinkedFolder: (groupID: Identifier) => LinkedFolder | null;
	isLinkedGroup: (groupID: Identifier) => boolean;
	setGroupViewTypeForCurrentGroup: (viewType: GroupViewType) => void;
	exitMissionControlForCurrentGroup: () => void;
	createFGroup: (name: string, groupIds?: string[]) => string;
	renameFGroup: (groupId: string, newName: string) => void;
	addGroupToFGroup: (groupId: string, fGroupId: string) => void;
	removeGroupFromFGroup: (groupId: string, fGroupId?: string) => void;
	deleteFGroup: (groupId: string) => void;
	toggleFGroupVisibility: (groupId: string, isHidden: boolean) => void;
	getFGroup: (groupId: string) => FGroup | null;
	getGroupByTabId: (tabId: string) => FGroup | null;
	copyFGroupMembership: (sourceGroupId: string, targetGroupId: string) => void;
	swapFGroupSubgroups: (app: App) => void;
	getNextSubgroupId: (fGroupId: string, currentSubgroupId: string) => string | null;
	resetSubgroups: () => void;
	// Recent subgroup tracking for quick switching
	recentSubgroupIds: Map<string, string[]>; // fGroupId -> [mostRecent, secondMostRecent]
	updateRecentSubgroup: (fGroupId: string, subgroupId: string) => void;
	switchToRecentSubgroup: (app: App) => void;
	cycleSubgroupsInFGroup: (app: App) => void;
	// Recent FGroup tracking for quick switching
	recentFGroupIds: string[]; // [mostRecent, secondMostRecent]
	updateRecentFGroup: (fGroupId: string) => void;
	switchToRecentFGroup: () => void;
	cycleFGroups: () => void;
}

const saveViewState = (titles: GroupTitles) => {
	const data = Array.from(titles.entries());
	localStorage.setItem("view-state", JSON.stringify(data));
};

const loadViewState = (): GroupTitles | null => {
	const data = localStorage.getItem("view-state");
	if (!data) return null;
	const entries = JSON.parse(data) as [Identifier, string][];
	return new DefaultRecord(factory, entries);
};

const saveHiddenGroups = (hiddenGroups: Array<Identifier>) => {
	localStorage.setItem("hidden-groups", JSON.stringify(hiddenGroups));
};

const loadHiddenGroups = (): Array<Identifier> => {
	const data = localStorage.getItem("hidden-groups");
	if (!data) return [];
	return JSON.parse(data);
};

const saveCollapsedGroups = (collapsedGroups: Array<Identifier>) => {
	localStorage.setItem("collapsed-groups", JSON.stringify(collapsedGroups));
};

const loadCollapsedGroups = (): Array<Identifier> => {
	const data = localStorage.getItem("collapsed-groups");
	if (!data) return [];
	return JSON.parse(data);
};

const saveExpandedGroups = (expandedGroups: Array<Identifier>) => {
	localStorage.setItem("expanded-groups", JSON.stringify(expandedGroups));
};

const loadExpandedGroups = (): Array<Identifier> => {
	const data = localStorage.getItem("expanded-groups");
	if (!data) return [];
	return JSON.parse(data);
};

const saveNonEphemeralTabs = (tabs: Array<Identifier>) => {
	localStorage.setItem("nonephemeral-tabs", JSON.stringify(Array.from(tabs)));
};

const loadNonEphemeralTabs = (): Array<Identifier> => {
	const data = localStorage.getItem("nonephemeral-tabs");
	if (!data) return [];
	return JSON.parse(data);
};

const clearNonEphemeralTabs = () => {
	localStorage.removeItem("nonephemeral-tabs");
};

const saveTabGroups = (tabGroups: FGroups) => {
	localStorage.setItem("tab-groups", JSON.stringify(tabGroups));
};

const loadTabGroups = (): FGroups => {
	const data = localStorage.getItem("tab-groups");
	if (!data) return createNewFGroups();
	return JSON.parse(data);
};

const getCornerContainers = (tabContainers: Array<Element>) => {
	const visibleTabContainers = tabContainers.filter(
		(tabContainer) =>
			tabContainer.clientHeight > 0 && tabContainer.clientWidth > 0
	);
	const x = visibleTabContainers.map(
		(tabContainer) => tabContainer.getBoundingClientRect().x
	);
	const y = visibleTabContainers.map(
		(tabContainer) => tabContainer.getBoundingClientRect().y
	);
	const xMin = Math.min(...x);
	const yMin = Math.min(...y);
	const xMax = Math.max(...x);
	const topLeftContainer = visibleTabContainers.find(
		(tabContainer) =>
			tabContainer.getBoundingClientRect().x === xMin &&
			tabContainer.getBoundingClientRect().y === yMin
	);
	const topRightContainer = visibleTabContainers.find(
		(tabContainer) =>
			tabContainer.getBoundingClientRect().x === xMax &&
			tabContainer.getBoundingClientRect().y === yMin
	);
	const allTopContainers = visibleTabContainers.filter(
		(tabContainer) => tabContainer.getBoundingClientRect().y === yMin
	);
	return { topLeftContainer, topRightContainer, allTopContainers };
};

// Guard to prevent recursive callback calls
const callbackGuard = new Set<number>();

export const useViewState = create<ViewState>()((set, get) => ({
	groupTitles: loadViewState() ?? createNewGroupTitles(),
	hiddenGroups: loadHiddenGroups(),
	collapsedGroups: loadCollapsedGroups(),
	expandedGroups: loadExpandedGroups(),
	nonEphemeralTabs: loadNonEphemeralTabs(),
	latestActiveLeaf: null,
	latestActiveTab: null,
	pinningEvents: createNewPinningEvents(),
	ephermalToggleEvents: createNewEphermalToggleEvents(),
	groupViewToggleEvents: createNewGroupViewToggleEvents(),
	globalCollapseState: false,
	isEditingTabs: false,
	memoizedCollapsedGroups: [],
	memoizedExpandedGroups: [],
	fGroups: loadTabGroups(),
	activeFGroupId: null,
	recentSubgroupIds: new Map(),
	recentFGroupIds: [],
	linkedGroups: createNewLinkedGroups(),
	leftButtonClone: null,
	rightButtonClone: null,
	topLeftContainer: null,
	topRightContainer: null,
	topRightMainContainer: null,
	allTopContainers: [],
	setGroupTitle: (id: Identifier, name: string) =>
		set((state) => {
			state.groupTitles.set(id, name);
			saveViewState(state.groupTitles);
			return state;
		}),
	toggleHiddenGroup: (id: Identifier, isHidden: boolean) => {
		if (isHidden) {
			set((state) => ({ hiddenGroups: [...state.hiddenGroups, id] }));
		} else {
			set((state) => ({
				hiddenGroups: state.hiddenGroups.filter((gid) => gid !== id),
			}));
		}
		saveHiddenGroups(get().hiddenGroups);
	},
	toggleCollapsedGroup: (id: Identifier, isCollapsed: boolean) => {
		if (isCollapsed) {
			set((state) => ({
				collapsedGroups: Array.from(new Set([...state.collapsedGroups, id])),
				expandedGroups: state.expandedGroups.filter((gid) => gid !== id),
			}));
		} else {
			set((state) => ({
				collapsedGroups: state.collapsedGroups.filter((gid) => gid !== id),
				expandedGroups: Array.from(new Set([...state.expandedGroups, id])),
				globalCollapseState: false,
			}));
		}
		saveCollapsedGroups(get().collapsedGroups);
		saveExpandedGroups(get().expandedGroups);
	},
	rememberNonephemeralTab(app: App, id: Identifier) {
		const { nonEphemeralTabs } = get();
		if (nonEphemeralTabs.contains(id)) return;
		const newList = nonEphemeralTabs.filter(
			(id) => app.workspace.getLeafById(id) !== null
		);
		set({ nonEphemeralTabs: [...newList, id] });
		saveNonEphemeralTabs(get().nonEphemeralTabs);
	},
	forgetNonephemeralTabs() {
		clearNonEphemeralTabs();
		set({ nonEphemeralTabs: [] });
	},
	setLatestActiveLeaf(plugin: ObsidianVerticalTabs) {
		const { refresh, isManagedLeaf } = managedLeafStore.getActions();
		refresh(plugin.app);
		const oldActiveLeaf = get().latestActiveLeaf;
		const workspace = plugin.app.workspace;
		const activeView = workspace.getActiveViewOfType(View);
		if (!activeView) {
			// Focus has already been moved, try our best to lock it back
			get().lockFocus(plugin);
			return;
		}
		const activeLeaf = activeView.leaf;
		// We exclude managed leaves
		const isRootLeaf =
			activeLeaf.getRoot() === workspace.rootSplit &&
			!isManagedLeaf(plugin.app, activeLeaf);
		if (isRootLeaf) {
			set({ latestActiveLeaf: activeLeaf });
		} else {
			// Focus has been moved to sidebars, so we need to move it back
			get().lockFocus(plugin);
		}
		const newActiveLeaf = get().latestActiveLeaf;
		const groupChanged = get().checkIfGroupChanged(
			workspace,
			oldActiveLeaf,
			newActiveLeaf
		);
		// Focus has been moved to another group, we lock on the new group
		if (groupChanged) {
			get().lockFocus(plugin);
			// Update recent subgroup tracking when switching to a different subgroup
			const { activeFGroupId } = get();
			if (activeFGroupId && newActiveLeaf) {
				const newParent = (newActiveLeaf as any).parent;
				if (newParent && newParent.id) {
					get().updateRecentSubgroup(activeFGroupId, newParent.id);
				}
			}
		}
	},
	checkIfGroupChanged(
		workspace: Workspace,
		oldLeaf: WorkspaceLeaf | null,
		newLeaf: WorkspaceLeaf | null
	) {
		let changed = false;
		if (oldLeaf === null && newLeaf === null) return false;
		if (oldLeaf === null || newLeaf === null) {
			changed = true;
		} else if (oldLeaf.parent === null || newLeaf.parent === null) {
			changed = true;
		} else if (oldLeaf.parent.id !== newLeaf.parent.id) {
			changed = true;
		}
		if (changed) workspace.trigger(EVENTS.UPDATE_TOGGLE);
		return changed;
	},
	lockFocus(plugin: ObsidianVerticalTabs) {
		// We only need to force focus on the most recent leaf when Zen mode is enabled
		if (!plugin.settings.zenMode) return;
		const { isManagedLeaf } = managedLeafStore.getActions();
		const workspace = plugin.app.workspace;
		const activeLeaf = get().latestActiveLeaf;
		if (isHoverEditorEnabled(plugin.app)) {
			if (activeLeaf && !activeLeaf.parent?.parentSplit) return;
		}
		const isRootLeaf =
			activeLeaf?.getRoot() === workspace.rootSplit &&
			!isManagedLeaf(plugin.app, activeLeaf);
		// We should check this again, since the user may have moved or closed the tab
		if (activeLeaf && isRootLeaf) {
			get().lockFocusOnLeaf(plugin.app, activeLeaf);
			return;
		}
		// No active leaf in the RootSplit has been recorded,
		// try to get the first active one in the first group
		const groups: WorkspaceParent[] = [];
		workspace.iterateRootLeaves((leaf) => {
			const group = leaf.parent;
			const isProcessed = groups.includes(group);
			const hasOnlyManagedLeaves = group.children.every((leaf) =>
				isManagedLeaf(plugin.app, leaf)
			);
			if (!isProcessed && !hasOnlyManagedLeaves) {
				groups.push(group);
			}
		});
		for (const group of groups) {
			const activeLeaf = group.children[group.currentTab];
			// If the active leaf is not managed, we lock focus on it
			if (activeLeaf && !isManagedLeaf(plugin.app, activeLeaf)) {
				get().lockFocusOnLeaf(plugin.app, activeLeaf);
				return;
			}
			// Otherwise, we try to find the last non-managed leaf in the group
			const leaves = group.children.filter(
				(leaf) => !isManagedLeaf(plugin.app, leaf)
			);
			const lastLeaf = leaves.pop();
			if (lastLeaf) {
				get().lockFocusOnLeaf(plugin.app, lastLeaf);
				return;
			}
			// We continue to the next group
		}
		// No root group has been found, this shall never happen?
	},
	lockFocusOnLeaf(app: App, leaf: WorkspaceLeaf) {
		get().resetFocusFlags();
		const parent = leaf.parent;
		// Focus on the parent group with CSS class
		parent.containerEl.toggleClass("vt-mod-active", true);
		// Force maximize the active leaf in stacked mode
		if (parent.isStacked) {
			parent.setStacked(false);
			parent.setStacked(true);
		}
	},
	resetFocusFlags() {
		document.querySelectorAll(".vt-mod-active").forEach((el) => {
			el.classList.remove("vt-mod-active");
		});
	},
	hookLatestActiveTab(tab: HTMLElement | null) {
		if (tab && get().latestActiveLeaf) {
			set({ latestActiveTab: tab });
		} else {
			set({ latestActiveTab: null });
		}
	},
	scorllToActiveTab() {
		const { latestActiveTab } = get();
		if (!latestActiveTab) return;
		latestActiveTab.scrollIntoView({
			behavior: "smooth",
			block: "center",
			inline: "nearest",
		});
	},
	cloneToggleButtons(app: App) {
		const workspace = app.workspace;
		const leftButton = workspace.leftSidebarToggleButtonEl;
		const rightButton = workspace.rightSidebarToggleButtonEl;
		const leftButtonClone = leftButton.cloneNode(true) as HTMLElement;
		const rightButtonClone = rightButton.cloneNode(true) as HTMLElement;
		const { leftSplit, rightSplit } = workspace;
		const onClickLeftButton = () => leftSplit.toggle();
		const onClickRightButton = () => rightSplit.toggle();
		leftButtonClone.classList.add("vt-mod-toggle");
		rightButtonClone.classList.add("vt-mod-toggle");
		leftButtonClone.addEventListener("click", onClickLeftButton);
		rightButtonClone.addEventListener("click", onClickRightButton);
		set({ leftButtonClone, rightButtonClone });
	},
	removeCloneButtons() {
		const { leftButtonClone, rightButtonClone } = get();
		leftButtonClone?.remove();
		rightButtonClone?.remove();
	},
	insertCloneButtons() {
		if (!Platform.isDesktop && !Platform.isTablet) return;
		const isFrameHidden = getFrameStyle() === WindowFrameStyle.Hidden;
		if (
			!isRibbonVisible() ||
			(hasControlButtonsOnTheLeft() && isFrameHidden)
		) {
			const { topLeftContainer, leftButtonClone } = get();
			if (!hasLeftSidebarToggle(topLeftContainer))
				insertLeftSidebarToggle(topLeftContainer, leftButtonClone);
		}
		const excludeRightSidebar =
			hasControlButtonsOnTheRight() && isFrameHidden;
		const topRightContainer = excludeRightSidebar
			? get().topRightMainContainer
			: get().topRightContainer;
		const { rightButtonClone } = get();
		if (!hasRightSidebarToggle(topRightContainer))
			insertRightSidebarToggle(topRightContainer, rightButtonClone);
	},
	updatePositionLabels: () => {
		const tabContainers = Array.from(
			document.querySelectorAll(".workspace-tabs")
		);
		tabContainers.forEach((tabContainer) => {
			tabContainer.classList.remove(
				"vt-mod-top-left-space",
				"vt-mod-top-right-space"
			);
		});
		const { topLeftContainer, topRightContainer, allTopContainers } =
			getCornerContainers(tabContainers);
		topLeftContainer?.classList.add("vt-mod-top-left-space");
		topRightContainer?.classList.add("vt-mod-top-right-space");
		const excludedRightSidebar = tabContainers.filter(
			(tabContainer) =>
				!tabContainer.parentElement?.hasClass("mod-right-split")
		);
		const topRightMainContainer =
			getCornerContainers(excludedRightSidebar).topRightContainer;
		allTopContainers.forEach((container) => {
			container.classList.add("vt-mod-top-space");
		});
		set({
			topLeftContainer,
			topRightContainer,
			topRightMainContainer,
			allTopContainers,
		});
	},
	refreshToggleButtons(app: App) {
		get().removeCloneButtons();
		get().updatePositionLabels();
		const { leftButtonClone, rightButtonClone } = get();
		if (!leftButtonClone || !rightButtonClone)
			get().cloneToggleButtons(app);
		get().insertCloneButtons();
	},
	bindPinningEvent(leaf: WorkspaceLeaf, callback: (pinned: boolean) => void) {
		const { pinningEvents } = get();
		const event = pinningEvents.get(leaf.id);
		if (event) return;
		const newEvent = leaf.on("pinned-change", callback);
		pinningEvents.set(leaf.id, newEvent);
		set({ pinningEvents });
	},
	unbindPinningEvent(leaf: WorkspaceLeaf) {
		const { pinningEvents } = get();
		const event = pinningEvents.get(leaf.id);
		if (event) {
			leaf.offref(event);
			pinningEvents.set(leaf.id, null);
			set({ pinningEvents });
		}
	},
	bindEphemeralToggleEvent(
		app: App,
		leaf: WorkspaceLeaf,
		callback: EphermalToggleEventCallback
	) {
		const { ephermalToggleEvents } = get();
		const event = ephermalToggleEvents.get(leaf.id);
		if (event) return;
		const newEvent = leaf.on(EVENTS.EPHEMERAL_TOGGLE, (isEphemeral) => {
			if (!isEphemeral) get().rememberNonephemeralTab(app, leaf.id);
			callback(isEphemeral);
		});
		ephermalToggleEvents.set(leaf.id, newEvent);
		set({ ephermalToggleEvents });
	},
	unbindEphemeralToggleEvent(leaf: WorkspaceLeaf) {
		const { ephermalToggleEvents } = get();
		const event = ephermalToggleEvents.get(leaf.id);
		if (event) {
			leaf.offref(event);
			ephermalToggleEvents.set(leaf.id, null);
			set({ ephermalToggleEvents });
		}
	},
	bindGroupViewToggleEvent(group, callback) {
		if (!group) return;
		const { groupViewToggleEvents } = get();
		const event = groupViewToggleEvents.get(group.id);
		if (event) return;
		const newEvent = group.on(
			EVENTS.GROUP_VIEW_CHANGE,
			(viewType: GroupViewType) => callback(viewType)
		);
		groupViewToggleEvents.set(group.id, newEvent);
		set({ groupViewToggleEvents });
	},
	unbindGroupViewToggleEvent(group) {
		if (!group) return;
		const { groupViewToggleEvents } = get();
		const event = groupViewToggleEvents.get(group.id);
		if (event) {
			group.offref(event);
			groupViewToggleEvents.set(group.id, null);
			set({ groupViewToggleEvents });
		}
	},
	setAllCollapsed() {
		const ids = tabCacheStore.getState().groupIDs;
		const { collapseSubgroupsByDefault } = useSettings.getState();

		if (collapseSubgroupsByDefault) {
			set({ globalCollapseState: true, expandedGroups: [] });
			saveExpandedGroups([]);
		} else {
			set({ globalCollapseState: true, collapsedGroups: ids });
			saveCollapsedGroups(ids);
		}
	},
	setAllExpanded() {
		const ids = tabCacheStore.getState().groupIDs;
		const { collapseSubgroupsByDefault } = useSettings.getState();

		if (collapseSubgroupsByDefault) {
			set({ globalCollapseState: false, expandedGroups: ids });
			saveExpandedGroups(ids);
		} else {
			set({ globalCollapseState: false, collapsedGroups: [] });
			saveCollapsedGroups([]);
		}
	},
	resetSubgroups() {
		const {
			collapsedGroups,
			expandedGroups,
			memoizedCollapsedGroups,
			memoizedExpandedGroups,
			globalCollapseState,
		} = get();
		const ids = tabCacheStore.getState().groupIDs;
		const { collapseSubgroupsByDefault } = useSettings.getState();

		if (globalCollapseState) {
			// Restore to memoized state
			if (collapseSubgroupsByDefault) {
				set({
					globalCollapseState: false,
					expandedGroups: memoizedExpandedGroups.length
						? memoizedExpandedGroups
						: [],
				});
				saveExpandedGroups(get().expandedGroups);
			} else {
				set({
					globalCollapseState: false,
					collapsedGroups: memoizedCollapsedGroups.length
						? memoizedCollapsedGroups
						: [],
				});
				saveCollapsedGroups(get().collapsedGroups);
			}
		} else {
			// Memoize current and collapse all
			if (collapseSubgroupsByDefault) {
				set({
					globalCollapseState: true,
					memoizedExpandedGroups: expandedGroups,
					expandedGroups: [],
				});
				saveExpandedGroups([]);
			} else {
				set({
					globalCollapseState: true,
					memoizedCollapsedGroups: collapsedGroups,
					collapsedGroups: ids,
				});
				saveCollapsedGroups(ids);
			}
		}
	},
	// Update recent subgroup tracking when switching subgroups
	updateRecentSubgroup(fGroupId: string, subgroupId: string) {
		const { recentSubgroupIds } = get();
		const currentRecent = recentSubgroupIds.get(fGroupId) || [];
		
		// Don't update if it's already the most recent
		if (currentRecent[0] === subgroupId) return;
		
		// Update: new most recent, previous most recent becomes second
		const newRecent = [subgroupId, currentRecent[0]].filter(Boolean) as string[];
		recentSubgroupIds.set(fGroupId, newRecent);
		set({ recentSubgroupIds });
	},
	// Switch between the two most recent subgroups (like Ctrl+Tab)
	switchToRecentSubgroup(app: App) {
		const { activeFGroupId, recentSubgroupIds, fGroups } = get();
		if (!activeFGroupId) return;
		
		const fGroup = fGroups[activeFGroupId];
		if (!fGroup || fGroup.groupIds.length < 2) return;
		
		const recent = recentSubgroupIds.get(activeFGroupId) || [];
		if (recent.length < 2) return;
		
		const [mostRecent, secondMostRecent] = recent;
		
		// Find the subgroup to switch to (the one that's not currently active)
		const activeLeaf = app.workspace.activeLeaf;
		if (!activeLeaf) return;
		
		const currentParent = (activeLeaf as any).parent;
		if (!currentParent || !currentParent.id) return;
		
		const currentSubgroupId = currentParent.id;
		const targetSubgroupId = currentSubgroupId === mostRecent ? secondMostRecent : mostRecent;
		
		if (!targetSubgroupId || !fGroup.groupIds.includes(targetSubgroupId)) return;
		
		// Find a leaf in the target subgroup and activate it
		const allLeaves = app.workspace.getLeavesOfType('markdown');
		for (const leaf of allLeaves) {
			const parent = (leaf as any).parent;
			if (parent && parent.id === targetSubgroupId) {
				// Update recent tracking before switching
				get().updateRecentSubgroup(activeFGroupId, targetSubgroupId);
				app.workspace.setActiveLeaf(leaf, { focus: true });
				return;
			}
		}
	},
	// Cycle through all subgroups in current FGroup
	cycleSubgroupsInFGroup(app: App) {
		const { activeFGroupId, fGroups } = get();
		if (!activeFGroupId) return;
		
		const fGroup = fGroups[activeFGroupId];
		if (!fGroup || fGroup.groupIds.length === 0) return;
		
		const activeLeaf = app.workspace.activeLeaf;
		if (!activeLeaf) return;
		
		const currentParent = (activeLeaf as any).parent;
		if (!currentParent || !currentParent.id) return;
		
		const currentSubgroupId = currentParent.id;
		const subgroupIds = fGroup.groupIds;
		
		const currentIndex = subgroupIds.indexOf(currentSubgroupId);
		if (currentIndex === -1) return;
		
		// Calculate next index with wrap-around
		const nextIndex = (currentIndex + 1) % subgroupIds.length;
		const targetSubgroupId = subgroupIds[nextIndex];
		
		// Find a leaf in the target subgroup and activate it
		const allLeaves = app.workspace.getLeavesOfType('markdown');
		for (const leaf of allLeaves) {
			const parent = (leaf as any).parent;
			if (parent && parent.id === targetSubgroupId) {
				// Update recent tracking before switching
				get().updateRecentSubgroup(activeFGroupId, targetSubgroupId);
				app.workspace.setActiveLeaf(leaf, { focus: true });
				return;
			}
		}
	},
	// Update recent FGroup tracking when switching FGroups
	updateRecentFGroup(fGroupId: string) {
		const { recentFGroupIds } = get();
		
		// Don't update if it's already the most recent
		if (recentFGroupIds[0] === fGroupId) return;
		
		// Update: new most recent, previous most recent becomes second
		const newRecent = [fGroupId, recentFGroupIds[0]].filter(Boolean) as string[];
		set({ recentFGroupIds: newRecent });
	},
	// Switch between the two most recent FGroups (like Alt+Tab)
	switchToRecentFGroup() {
		const { recentFGroupIds, fGroups, activeFGroupId, toggleFGroup } = get();
		
		if (recentFGroupIds.length < 2) return;
		
		const [mostRecent, secondMostRecent] = recentFGroupIds;
		
		// Find the FGroup to switch to (the one that's not currently active)
		const targetFGroupId = activeFGroupId === mostRecent ? secondMostRecent : mostRecent;
		
		if (!targetFGroupId || !fGroups[targetFGroupId]) return;
		
		// Update recent tracking before switching
		get().updateRecentFGroup(targetFGroupId);
		
		// Toggle to the target FGroup
		toggleFGroup(targetFGroupId);
	},
	// Cycle through all FGroups
	cycleFGroups() {
		const { fGroups, activeFGroupId, toggleFGroup } = get();
		
		const fGroupIds = Object.keys(fGroups);
		if (fGroupIds.length === 0) return;
		
		const currentIndex = activeFGroupId ? fGroupIds.indexOf(activeFGroupId) : -1;
		
		// Calculate next index with wrap-around
		const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % fGroupIds.length;
		const targetFGroupId = fGroupIds[nextIndex];
		
		if (!targetFGroupId || !fGroups[targetFGroupId]) return;
		
		// Update recent tracking before switching
		get().updateRecentFGroup(targetFGroupId);
		
		// Toggle to the target FGroup
		toggleFGroup(targetFGroupId);
	},
	uncollapseActiveGroup(app: App) {
		const { latestActiveLeaf } = get();
		if (!latestActiveLeaf) return;
		const group = latestActiveLeaf.parent;
		if (!group) return;
		const type = getGroupType(app, group);
		const isSidebar =
			type === GroupType.LeftSidebar || type === GroupType.RightSidebar;
		if (isSidebar) return;
		if (!group.id) return;
		get().toggleCollapsedGroup(group.id, false);
		set({ globalCollapseState: false });
	},
	executeSmartNavigation(
		app: App,
		target: WorkspaceLeaf,
		fallback: () => boolean
	) {
		const root = target.getRoot();
		// If the target is in the sidebar, it is not navigatable
		if (
			root === app.workspace.leftSplit ||
			root === app.workspace.rightSplit
		)
			return false;
		const { latestActiveLeaf } = get();
		// If we do not know the latest active leaf, use the default handler
		if (!latestActiveLeaf) return fallback();
		const latestParent = latestActiveLeaf.parent;
		const targetParent = target.parent;
		// If one of the parent is not found, use the default handler
		if (latestParent === null || targetParent === null) return fallback();
		// if the target is not in the same group, it is not navigatable
		if (latestParent.id !== targetParent.id) return false;
		// otherwise, use the default handler
		return fallback();
	},
	setIsEditingTabs(app: App, isEditing: boolean) {
		if (Platform.isMobile) {
			if (isEditing) {
				pinDrawer(app);
			} else {
				unpinDrawer(app);
			}
		}
		set({ isEditingTabs: isEditing });
	},
	setCtrlKeyState(isPressed: boolean) {},
	setAltKeyState(isPressed: boolean) {},
	setShiftKeyState(isPressed: boolean) {},
	setLinkThrowingState(isThrowing: boolean) {},
	increaseViewCueOffset: debounce(() => {}, REFRESH_TIMEOUT_LONG),
	decreaseViewCueOffset: debounce(() => {}, REFRESH_TIMEOUT_LONG),
	resetViewCueOffset() {},
	mapViewCueIndex(realIndex?: number, isLast?: boolean): ViewCueIndex {
		return undefined;
	},
	convertBackToRealIndex(userIndex: number, numOfLeaves: number): number | null {
		return null;
	},
	revealTabOfUserIndex(app: App, userIndex: number, checking: boolean): boolean | void {
		return false;
	},
	modifyViewCueCallback(app: App) {},
	resetViewCueCallback(app: App) {},
	registerViewCueTab(leaf: WorkspaceLeaf, tab: HTMLElement | null, isFirst: boolean) {},
	scorllToViewCueFirstTab(app: App) {},
	addLinkedGroup(groupID: Identifier, linkedFolder: LinkedFolder) {
		const { linkedGroups } = get();
		linkedGroups.set(groupID, linkedFolder);
		set({ linkedGroups: linkedGroups });
	},
	removeLinkedGroup(group: WorkspaceParent) {
		const { linkedGroups } = get();
		linkedGroups.set(group.id, null);
		group.isLinkedGroup = false;
		group.children.forEach((leaf) => (leaf.isLinkedFile = false));
		set({ linkedGroups: linkedGroups });
	},
	getLinkedFolder(groupID: Identifier) {
		const { linkedGroups: linkedGroups } = get();
		return linkedGroups.get(groupID);
	},
	isLinkedGroup(groupID: Identifier | null) {
		if (!groupID) return false;
		const { linkedGroups } = get();
		return linkedGroups.get(groupID) !== null;
	},
	setGroupViewTypeForCurrentGroup(viewType: GroupViewType) {
		const { latestActiveLeaf } = get();
		if (!latestActiveLeaf) return;
		setGroupViewType(latestActiveLeaf.parent, viewType);
	},
	exitMissionControlForCurrentGroup() {
		const { latestActiveLeaf } = get();
		if (!latestActiveLeaf) return;
		const group = latestActiveLeaf.parent;
		const viewType = identifyGroupViewType(group);
		if (viewType === GroupViewType.MissionControlView) {
			setGroupViewType(group, GroupViewType.Default);
		}
	},
	createFGroup(name: string, groupIds?: string[]) {
		const { fGroups, groupTitles } = get();
		// 如果没有提供groupIds，获取当前所有存在的子组ID
		let initialGroupIds = groupIds || tabCacheStore.getState().groupIDs;
		// 按组名称字母排序
		initialGroupIds = [...initialGroupIds].sort((a, b) => {
			const nameA = groupTitles.get(a) || "";
			const nameB = groupTitles.get(b) || "";
			return nameA.localeCompare(nameB);
		});
		const newGroup: FGroup = {
			id: `fgroup-${Date.now()}`,
			name,
			groupIds: initialGroupIds,
			isHidden: false,
		};
		const newFGroups = { ...fGroups, [newGroup.id]: newGroup };
		set({ fGroups: newFGroups });
		saveTabGroups(newFGroups);
		return newGroup.id;
	},
	renameFGroup(groupId: string, newName: string) {
		const { fGroups } = get();
		const group = fGroups[groupId];
		if (!group) return;
		const newFGroups = { ...fGroups };
		newFGroups[groupId] = { ...group, name: newName };
		set({ fGroups: newFGroups });
		saveTabGroups(newFGroups);
	},
	addGroupToFGroup(groupId: string, fGroupId: string) {
		const { fGroups } = get();
		const fGroup = fGroups[fGroupId];
		if (!fGroup) return;

		if (fGroup.groupIds.includes(groupId)) return;

		const newFGroups = { ...fGroups };
		newFGroups[fGroupId] = {
			...fGroup,
			groupIds: [...fGroup.groupIds, groupId],
		};

		set({ fGroups: newFGroups });
		saveTabGroups(newFGroups);
	},
	removeGroupFromFGroup(groupId: string, fGroupId?: string) {
		const { fGroups } = get();

		if (fGroupId) {
			const fGroup = fGroups[fGroupId];
			if (!fGroup) return;

			const newGroupIds = fGroup.groupIds.filter((id) => id !== groupId);

			if (newGroupIds.length === 0) {
				const newFGroups = { ...fGroups };
				delete newFGroups[fGroupId];
				set({ fGroups: newFGroups });
				saveTabGroups(newFGroups);
			} else {
				const newFGroups = { ...fGroups };
				newFGroups[fGroupId] = {
					...fGroup,
					groupIds: newGroupIds,
				};
				set({ fGroups: newFGroups });
				saveTabGroups(newFGroups);
			}
		} else {
			const containingFGroupIds: string[] = [];
			for (const fgId in fGroups) {
				if (fGroups[fgId].groupIds.includes(groupId)) {
					containingFGroupIds.push(fgId);
				}
			}

			if (containingFGroupIds.length === 0) return;

			const targetFGroupId = containingFGroupIds[0];
			const fGroup = fGroups[targetFGroupId];
			const newGroupIds = fGroup.groupIds.filter((id) => id !== groupId);

			if (newGroupIds.length === 0) {
				const newFGroups = { ...fGroups };
				delete newFGroups[targetFGroupId];
				set({ fGroups: newFGroups });
				saveTabGroups(newFGroups);
			} else {
				const newFGroups = { ...fGroups };
				newFGroups[targetFGroupId] = {
					...fGroup,
					groupIds: newGroupIds,
				};
				set({ fGroups: newFGroups });
				saveTabGroups(newFGroups);
			}
		}
	},
	deleteFGroup(groupId: string) {
		const { fGroups } = get();
		const newFGroups = { ...fGroups };
		delete newFGroups[groupId];
		set({ fGroups: newFGroups });
		saveTabGroups(newFGroups);
	},
	toggleFGroupVisibility(groupId: string, isHidden: boolean) {
		const { fGroups } = get();
		const group = fGroups[groupId];
		if (!group) return;

		const newFGroups = { ...fGroups };
		newFGroups[groupId] = { ...group, isHidden };

		set({ fGroups: newFGroups });
		saveTabGroups(newFGroups);
	},
	getFGroup(groupId: string) {
		const { fGroups } = get();
		return fGroups[groupId] || null;
	},
	getGroupByTabId(tabId: string) {
		const { fGroups } = get();
		for (const fGroupId in fGroups) {
			if (fGroups[fGroupId].groupIds.includes(tabId)) {
				return fGroups[fGroupId];
			}
		}
		return null;
	},
	toggleFGroup: (fGroupId: string) => {
		const { fGroups, activeFGroupId } = get();
		const targetFGroup = fGroups[fGroupId];
		if (!targetFGroup) return;

		// 每个F组现在维护独立的groupIds
		// 显示当前F组的子组，隐藏不在当前F组中的子组
		const targetGroupIds = new Set(targetFGroup.groupIds);

		// 先处理显示：移除当前F组子组的隐藏状态
		let newHiddenGroups = [...get().hiddenGroups];
		newHiddenGroups = newHiddenGroups.filter((id) => !targetGroupIds.has(id));

		// 再处理隐藏：添加不在当前F组中的子组
		for (const fgId in fGroups) {
			if (fgId !== fGroupId) {
				const fg = fGroups[fgId];
				fg.groupIds.forEach((groupId) => {
					// 只有不在当前F组中的才隐藏
					if (!targetGroupIds.has(groupId) && !newHiddenGroups.includes(groupId)) {
						newHiddenGroups.push(groupId);
					}
				});
			}
		}

		// 更新状态
		set({
			activeFGroupId: fGroupId,
			hiddenGroups: newHiddenGroups
		});

		// 保存状态
		saveHiddenGroups(newHiddenGroups);

		// 更新最近访问的FGroup记录
		get().updateRecentFGroup(fGroupId);
	},
	getAllFGroups: () => {
		const { fGroups } = get();
		return Object.values(fGroups);
	},
	switchToNextFGroup: () => {
		const { fGroups, activeFGroupId } = get();
		const fGroupList = Object.values(fGroups);
		if (fGroupList.length === 0) return;

		let currentIndex = -1;
		if (activeFGroupId) {
			currentIndex = fGroupList.findIndex((fg) => fg.id === activeFGroupId);
		}

		const nextIndex = (currentIndex + 1) % fGroupList.length;
		get().toggleFGroup(fGroupList[nextIndex].id);
	},
	switchToPreviousFGroup: () => {
		const { fGroups, activeFGroupId } = get();
		const fGroupList = Object.values(fGroups);
		if (fGroupList.length === 0) return;

		let currentIndex = -1;
		if (activeFGroupId) {
			currentIndex = fGroupList.findIndex((fg) => fg.id === activeFGroupId);
		}

		const prevIndex = currentIndex <= 0 ? fGroupList.length - 1 : currentIndex - 1;
		get().toggleFGroup(fGroupList[prevIndex].id);
	},
	copyFGroupMembership: (sourceGroupId: string, targetGroupId: string) => {
		if (!sourceGroupId || !targetGroupId) return;

		const { fGroups } = get();
		const containingFGroups = Object.values(fGroups).filter(
			(fGroup) => fGroup.groupIds.includes(sourceGroupId)
		);

		containingFGroups.forEach((fGroup) => {
			if (!fGroup.groupIds.includes(targetGroupId)) {
				const newFGroups = { ...fGroups };
				newFGroups[fGroup.id] = {
					...fGroup,
					groupIds: [...fGroup.groupIds, targetGroupId],
				};
				set({ fGroups: newFGroups });
				saveTabGroups(newFGroups);
			}
		});
	},
	swapFGroupSubgroups: (app: App) => {
		const { fGroups, activeFGroupId } = get();

		if (!activeFGroupId) return;

		const activeFGroup = fGroups[activeFGroupId];
		if (!activeFGroup) return;

		if (activeFGroup.groupIds.length < 2) return;

		// 轮询逻辑：将最后一个子组移动到第一个位置
		const newGroupIds = [...activeFGroup.groupIds];
		const lastGroupId = newGroupIds.pop();
		if (lastGroupId) {
			newGroupIds.unshift(lastGroupId);
		}

		// 更新状态
		const newFGroups = { ...fGroups };
		newFGroups[activeFGroupId] = {
			...activeFGroup,
			groupIds: newGroupIds,
		};

		set({ fGroups: newFGroups });
		saveTabGroups(newFGroups);

		// 重新排列实际的 DOM 和内部数组顺
		reorderFGroupChildren(app, newGroupIds);

		// 触发UI显隐状态更新
		get().toggleFGroup(activeFGroupId);

		// 关键：强制刷新布局样式，重新计算宽度
		setTimeout(() => {
			autoResizeLayout(app);
		}, 50);
	},
	getNextSubgroupId: (fGroupId: string, currentSubgroupId: string) => {
		const { fGroups } = get();
		const fGroup = fGroups[fGroupId];
		if (!fGroup || fGroup.groupIds.length < 2) return null;

		const index = fGroup.groupIds.indexOf(currentSubgroupId);
		if (index === -1) return null;

		const nextIndex = (index + 1) % fGroup.groupIds.length;
		return fGroup.groupIds[nextIndex];
	},
}));

function reorderFGroupChildren(app: App, groupIds: string[]) {
	const workspace = app.workspace;
	const rootSplit = workspace.rootSplit;

	if (!rootSplit) return;

	function reorderInSplit(split: any) {
		const splitEl = split.containerEl;
		if (!splitEl) return;

		const children = split.children as any[];
		const visibleMatching = children.filter(child => groupIds.includes(child.id));

		// 如果当前 split 下含有两个或以上属于该 F 组的子组，进行重排
		if (visibleMatching.length >= 2) {
			// 按 groupIds 的新顺序筛选出这些子组
			const ordered = groupIds
				.map(id => children.find(c => c.id === id))
				.filter(Boolean) as any[];

			ordered.forEach(child => {
				// 1. 同步逻辑数组：将该子组移到末尾（依次 append，最终即为目标顺序）
				const currentIndex = split.children.indexOf(child);
				if (currentIndex !== -1) {
					split.children.splice(currentIndex, 1);
					split.children.push(child);
				}

				// 2. 同步物理 DOM：使用 appendChild 移动元素位置
				if (child.containerEl && splitEl) {
					splitEl.appendChild(child.containerEl);
				}
			});
		}

		// 递归处理嵌套的 split
		children.forEach(child => {
			if (child.children && child.containerEl) {
				reorderInSplit(child);
			}
		});
	}

	reorderInSplit(rootSplit);
	workspace.onLayoutChange();
}

