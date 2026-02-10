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
import { useSettings } from "src/models/PluginContext";
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
import {
	GroupViewType,
	identifyGroupViewType,
	setGroupViewType,
} from "./VTGroupView";
import { managedLeafStore } from "src/stores/ManagedLeafStore";
import { EVENTS } from "src/constants/Events";
import { REFRESH_TIMEOUT_LONG } from "src/constants/Timeouts";
import { isHoverEditorEnabled } from "src/services/HoverEditorTabs";
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

interface ViewState {
	groupTitles: GroupTitles;
	hiddenGroups: Array<Identifier>;
	collapsedGroups: Array<Identifier>;
	nonEphemeralTabs: Array<Identifier>;
	latestActiveLeaf: WorkspaceLeaf | null;
	latestActiveTab: HTMLElement | null;
	pinningEvents: PinningEvents;
	ephermalToggleEvents: EphermalToggleEvents;
	groupViewToggleEvents: GroupViewToggleEvents;
	globalCollapseState: boolean;
	isEditingTabs: boolean;
	hasCtrlKeyPressed: boolean;
	hasAltKeyPressed: boolean;
	viewCueOffset: number;
	viewCueNativeCallbacks: ViewCueNativeCallbackMap;
	viewCueFirstTabs: ViewCueFirstTabs;
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
	setCtrlKeyState: (isPressed: boolean) => void;
	setAltKeyState: (isPressed: boolean) => void;
	increaseViewCueOffset: () => void;
	decreaseViewCueOffset: () => void;
	resetViewCueOffset: () => void;
	mapViewCueIndex(realIndex?: number, isLast?: boolean): ViewCueIndex;
	convertBackToRealIndex(
		userIndex: number,
		numOfLeaves: number
	): number | null;
	revealTabOfUserIndex: (
		app: App,
		userIndex: number,
		checking: boolean
	) => boolean | void;
	modifyViewCueCallback: (app: App) => void;
	resetViewCueCallback: (app: App) => void;
	registerViewCueTab: (
		leaf: WorkspaceLeaf,
		tab: HTMLElement | null,
		isFirst: boolean
	) => void;
	scorllToViewCueFirstTab: (app: App) => void;
	addLinkedGroup: (groupID: Identifier, linkedFolder: LinkedFolder) => void;
	removeLinkedGroup: (group: WorkspaceParent) => void;
	getLinkedFolder: (groupID: Identifier) => LinkedFolder | null;
	isLinkedGroup: (groupID: Identifier) => boolean;
	setGroupViewTypeForCurrentGroup: (viewType: GroupViewType) => void;
	exitMissionControlForCurrentGroup: () => void;
	createFGroup: (name: string, groupIds: string[]) => string;
	renameFGroup: (groupId: string, newName: string) => void;
	addGroupToFGroup: (groupId: string, fGroupId: string) => void;
	removeGroupFromFGroup: (groupId: string, fGroupId?: string) => void;
	deleteFGroup: (groupId: string) => void;
	toggleFGroupVisibility: (groupId: string, isHidden: boolean) => void;
	getFGroup: (groupId: string) => FGroup | null;
	getGroupByTabId: (tabId: string) => FGroup | null;
	restoreWorkspaceState: (state: any) => void;
}

const saveViewState = (titles: GroupTitles) => {
	const data = Array.from(titles.entries());
	useSettings.getState().setSettings({ groupTitles: data });
};

const loadViewState = (): GroupTitles | null => {
	const data = useSettings.getState().groupTitles;
	if (!data) return null;
	return new DefaultRecord(factory, data);
};

const saveHiddenGroups = (hiddenGroups: Array<Identifier>) => {
	useSettings.getState().setSettings({ hiddenGroups });
};

const loadHiddenGroups = (): Array<Identifier> => {
	const data = useSettings.getState().hiddenGroups;
	if (!data) return [];
	return data;
};

const saveCollapsedGroups = (collapsedGroups: Array<Identifier>) => {
	useSettings.getState().setSettings({ collapsedGroups });
};

const loadCollapsedGroups = (): Array<Identifier> => {
	const data = useSettings.getState().collapsedGroups;
	if (!data) return [];
	return data;
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
	useSettings.getState().setSettings({ fGroups: tabGroups });
};

const loadTabGroups = (): FGroups => {
	const data = useSettings.getState().fGroups;
	if (!data) return createNewFGroups();
	return data;
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
	nonEphemeralTabs: loadNonEphemeralTabs(),
	latestActiveLeaf: null,
	latestActiveTab: null,
	pinningEvents: createNewPinningEvents(),
	ephermalToggleEvents: createNewEphermalToggleEvents(),
	groupViewToggleEvents: createNewGroupViewToggleEvents(),
	globalCollapseState: false,
	isEditingTabs: false,
	hasCtrlKeyPressed: false,
	hasAltKeyPressed: false,
	viewCueOffset: 0,
	viewCueNativeCallbacks: new Map(),
	viewCueFirstTabs: createNewViewCueFirstTabs(),
	fGroups: loadTabGroups(),
	activeFGroupId: null,
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
				collapsedGroups: [...state.collapsedGroups, id],
			}));
		} else {
			set((state) => ({
				collapsedGroups: state.collapsedGroups.filter(
					(gid) => gid !== id
				),
				globalCollapseState: false,
			}));
		}
		saveCollapsedGroups(get().collapsedGroups);
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
		if (groupChanged) get().lockFocus(plugin);
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
		set({ globalCollapseState: true, collapsedGroups: ids });
		saveCollapsedGroups(ids);
	},
	setAllExpanded() {
		set({ globalCollapseState: false, collapsedGroups: [] });
		saveCollapsedGroups([]);
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
	setCtrlKeyState(isPressed: boolean) {
		set({ hasCtrlKeyPressed: isPressed });
		if (!isPressed) get().resetViewCueOffset();
	},
	setAltKeyState(isPressed: boolean) {
		set({ hasAltKeyPressed: isPressed });
	},
	increaseViewCueOffset: debounce(() => {
		const { viewCueOffset, latestActiveLeaf } = get();
		if (latestActiveLeaf) {
			const latestParent = latestActiveLeaf.parent;
			const numOfLeaves = latestParent.children.length;
			const maxOffset = Math.floor((numOfLeaves - 1) / MAX_INDEX_KEY);
			set({ viewCueOffset: Math.min(maxOffset, viewCueOffset + 1) });
		} else {
			set({ viewCueOffset: viewCueOffset + 1 });
		}
	}, REFRESH_TIMEOUT_LONG),
	decreaseViewCueOffset: debounce(() => {
		const { viewCueOffset } = get();
		set({ viewCueOffset: Math.max(0, viewCueOffset - 1) });
	}, REFRESH_TIMEOUT_LONG),
	resetViewCueOffset() {
		set({ viewCueOffset: 0 });
	},
	mapViewCueIndex(realIndex?: number, isLast?: boolean): ViewCueIndex {
		if (realIndex === undefined) return undefined;
		const { viewCueOffset } = get();
		const userIndex = realIndex - viewCueOffset * MAX_INDEX_KEY;
		if (MIN_INDEX_KEY <= userIndex && userIndex <= MAX_INDEX_KEY) {
			return userIndex;
		} else if (isLast) {
			return LAST_INDEX_KEY;
		} else if (userIndex === MAX_INDEX_KEY + 1) {
			return VIEW_CUE_NEXT;
		} else if (userIndex === MIN_INDEX_KEY - 1) {
			return VIEW_CUE_PREV;
		}
	},
	convertBackToRealIndex(
		userIndex: number,
		numOfLeaves: number
	): number | null {
		const { viewCueOffset } = get();
		const realIndex = userIndex + viewCueOffset * MAX_INDEX_KEY;
		if (MIN_INDEX_KEY <= realIndex && realIndex <= numOfLeaves) {
			return realIndex;
		} else {
			return null;
		}
	},
	revealTabOfUserIndex(
		app: App,
		userIndex: number,
		checking: boolean
	): boolean | void {
		const { latestActiveLeaf, viewCueNativeCallbacks } = get();
		if (latestActiveLeaf) {
			const latestParent = latestActiveLeaf.parent;
			const numOfLeaves = latestParent.children.length;
			const realIndex = get().convertBackToRealIndex(
				userIndex,
				numOfLeaves
			);
			if (!realIndex) return;
			const target = latestParent.children[realIndex - 1];
			if (!target) return;
			if (checking) return true;
			set({ latestActiveLeaf: target });
			app.workspace.setActiveLeaf(target, { focus: true });
			const viewType = identifyGroupViewType(target.parent);
			if (viewType === GroupViewType.MissionControlView) {
				setGroupViewType(target.parent, GroupViewType.Default);
			}
		} else {
			// Prevent infinite recursion by using a guard
			if (callbackGuard.has(userIndex)) return false;
			const defaultCallback = viewCueNativeCallbacks.get(userIndex);
			if (defaultCallback) {
				callbackGuard.add(userIndex);
				try {
					return defaultCallback(checking);
				} finally {
					callbackGuard.delete(userIndex);
				}
			}
		}
	},
	modifyViewCueCallback(app: App) {
		const nativeCallbacks: ViewCueNativeCallbackMap = new Map();
		for (let index = 1; index < MAX_INDEX_KEY; index++) {
			const commandName = `workspace:goto-tab-${index}`;
			const command = getCommandByName(app, commandName);
			const callback = command?.checkCallback;
			if (command && callback) {
				nativeCallbacks.set(index, callback);
				command.checkCallback = (checking: boolean) => {
					return get().revealTabOfUserIndex(app, index, checking);
				};
			}
		}
		set({ viewCueNativeCallbacks: nativeCallbacks });
	},
	resetViewCueCallback(app: App) {
		const { viewCueNativeCallbacks } = get();
		for (const [index, callback] of viewCueNativeCallbacks) {
			const commandName = `workspace:goto-tab-${index}`;
			const command = getCommandByName(app, commandName);
			if (command) {
				command.checkCallback = callback;
			}
		}
	},
	registerViewCueTab(
		leaf: WorkspaceLeaf,
		tab: HTMLElement | null,
		isFirst: boolean
	) {
		const { viewCueFirstTabs } = get();
		if (isFirst && tab) viewCueFirstTabs.set(leaf.id, tab);
		else viewCueFirstTabs.delete(leaf.id);
		set({ viewCueFirstTabs });
	},
	scorllToViewCueFirstTab(app: App) {
		const { latestActiveLeaf, viewCueFirstTabs } = get();
		let targetTab: HTMLElement | null = null;
		let targetLeaf: WorkspaceLeaf | null = null;
		if (!latestActiveLeaf && viewCueFirstTabs.size === 1) {
			// If latestActiveLeaf is not set and viewCueFirstTabs has only one entry,
			// we should scroll to that tab
			const firstEntry = viewCueFirstTabs.entries().next().value;
			if (!firstEntry) return; // should never happen
			const [id, tab] = firstEntry;
			targetTab = tab;
			targetLeaf = app.workspace.getLeafById(id);
		} else if (latestActiveLeaf) {
			// If latestActiveLeaf is set, we should scroll to the tab that has the
			// same parent as the latestActiveLeaf
			const activeGroup = latestActiveLeaf.parent;
			if (!activeGroup) return;
			for (const [id, tab] of viewCueFirstTabs) {
				const leaf = app.workspace.getLeafById(id);
				if (!leaf || !tab || !leaf.parent) continue;
				if (activeGroup.id === leaf.parent.id) {
					targetTab = tab;
					targetLeaf = leaf;
					break;
				}
			}
		}
		if (targetTab) {
			targetTab.scrollIntoView({
				behavior: "smooth",
				block: "start",
				inline: "nearest",
			});
		}
		if (targetLeaf) {
			targetLeaf.tabHeaderEl.scrollIntoView({
				behavior: "smooth",
				block: "start",
				inline: "start",
			});
			targetLeaf.containerEl.scrollIntoView({
				behavior: "smooth",
				block: "start",
				inline: "start",
			});
		}
	},
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
	createFGroup(name: string, groupIds: string[]) {
		const { fGroups } = get();
		const newGroup: FGroup = {
			id: `fgroup-${Date.now()}`,
			name,
			groupIds,
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

		// 计算所有FGroup中共享的子组ID
		const groupIdCounts = new Map<string, number>();
		for (const fgId in fGroups) {
			const fg = fGroups[fgId];
			fg.groupIds.forEach((groupId) => {
				groupIdCounts.set(groupId, (groupIdCounts.get(groupId) || 0) + 1);
			});
		}
		const sharedGroupIds = new Set<string>();
		groupIdCounts.forEach((count, groupId) => {
			if (count > 1) {
				sharedGroupIds.add(groupId);
			}
		});

		// 计算需要隐藏的组ID
		const groupsToHide = new Set<string>();
		for (const fgId in fGroups) {
			if (fgId !== fGroupId) {
				const fg = fGroups[fgId];
				fg.groupIds.forEach((groupId) => {
					// 只隐藏非共享的组
					if (!sharedGroupIds.has(groupId)) {
						groupsToHide.add(groupId);
					}
				});
			}
		}

		// 计算需要显示的组ID
		const groupsToShow = new Set<string>();
		targetFGroup.groupIds.forEach((groupId) => {
			groupsToShow.add(groupId);
		});
		// 添加所有共享组
		sharedGroupIds.forEach((groupId) => {
			groupsToShow.add(groupId);
		});

		// 更新隐藏组状态
		let newHiddenGroups = [...get().hiddenGroups];
		
		// 先移除所有需要显示的组
		newHiddenGroups = newHiddenGroups.filter((id) => !groupsToShow.has(id));
		
		// 再添加所有需要隐藏的组
		groupsToHide.forEach((id) => {
			if (!newHiddenGroups.includes(id)) {
				newHiddenGroups.push(id);
			}
		});

		// 更新状态
		set({ 
			activeFGroupId: fGroupId,
			hiddenGroups: newHiddenGroups
		});
		
		// 保存状态
		saveHiddenGroups(newHiddenGroups);
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
	restoreWorkspaceState: (state: any) => {
		if (!state) return;
		
		set({
			fGroups: state.fGroups || {},
			activeFGroupId: state.activeFGroupId || null,
			hiddenGroups: state.hiddenGroups || [],
			collapsedGroups: state.collapsedGroups || [],
			groupTitles: state.groupTitles || createNewGroupTitles(),
		});
		
		saveTabGroups(state.fGroups || {});
		saveHiddenGroups(state.hiddenGroups || []);
		saveCollapsedGroups(state.collapsedGroups || []);
		saveViewState(state.groupTitles || createNewGroupTitles());
	},
}));
