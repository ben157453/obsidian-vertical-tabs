import { usePlugin, useSettings } from "src/models/PluginContext";
import { IconButton } from "./IconButton";
import { Menu, Platform, WorkspaceLeaf } from "obsidian";
import { tabCacheStore } from "src/stores/TabCacheStore";
import { sortStrategies } from "src/services/SortTabs";
import { useViewState } from "src/models/ViewState";
import { EVENTS } from "src/constants/Events";
import { REFRESH_TIMEOUT_LONG } from "src/constants/Timeouts";
import { useEffect, useState } from "react";

interface NavigationHeaderProps {
	container: HTMLElement | null;
}

// Default group title constant
const DEFAULT_GROUP_TITLE = "Group";

export const NavigationHeader = (props: NavigationHeaderProps) => {
	const plugin = usePlugin();
	const app = plugin.app;
	const { hasOnlyOneGroup } = tabCacheStore.getActions();
	const { setSettings } = useSettings();
	const showActiveTabs = useSettings.use.showActiveTabs();
	const hideSidebars = useSettings.use.hideSidebars();
	const zenMode = useSettings.use.zenMode();
	const toggleZenMode = useSettings.use.toggleZenMode();
	const useTabEditing = useSettings.use.useTabEditing();
	const sortStrategy = tabCacheStore((state) => state.sortStrategy);
	const { setSortStrategy } = tabCacheStore.getActions();
	const { lockFocus, setAllCollapsed, setAllExpanded, scorllToActiveTab } =
		useViewState();
	const globalCollapseState = useViewState(
		(state) => state.globalCollapseState
	);
	const {
		uncollapseActiveGroup,
		setIsEditingTabs,
		resetSubgroups,
	} = useViewState();
	const isSingleGroup = hasOnlyOneGroup() && hideSidebars;
	const isEditingTabs = useViewState((state) => state.isEditingTabs);

	// Get FGroup state
	const fGroups = useViewState((state) => state.fGroups);
	const activeFGroupId = useViewState((state) => state.activeFGroupId);
	const latestActiveLeaf = useViewState((state) => state.latestActiveLeaf);
	const groupTitles = useViewState((state) => state.groupTitles);
	
	// Get current active FGroup
	const currentFGroup = activeFGroupId ? fGroups[activeFGroupId] : null;
	
	// State for active subgroup ID
	const [activeSubgroupId, setActiveSubgroupId] = useState<string | null>(null);

	// Update active subgroup when leaf changes
	useEffect(() => {
		if (latestActiveLeaf) {
			const parent = (latestActiveLeaf as any).parent;
			if (parent && parent.id) {
				setActiveSubgroupId(parent.id);
			}
		}
	}, [latestActiveLeaf]);

	// Get all existing subgroups globally with their titles (exclude sidebars)
	const allSubgroupIds = tabCacheStore((state) => state.groupIDs);
	const subgroupIds = allSubgroupIds.filter(id => !id.endsWith('-sidebar'));
	
	// Sort subgroups by their actual position on screen (left to right)
	const sortedSubgroupIds = [...subgroupIds].sort((a, b) => {
		// Find the actual tab group elements in the workspace
		const workspace = app.workspace;
		const rootSplit = (workspace as any).rootSplit;
		if (!rootSplit) return 0;
		
		// Get all tab groups in the main workspace
		const getTabGroupPosition = (groupId: string): number => {
			// Try to find the tab group element by looking at the DOM
			// Tab groups have data attributes or can be found through the workspace
			const leaves = workspace.getLeavesOfType('markdown');
			for (const leaf of leaves) {
				const parent = (leaf as any).parent;
				if (parent && parent.id === groupId) {
					// Get the container element's position
					const containerEl = (parent as any).containerEl;
					if (containerEl) {
						const rect = containerEl.getBoundingClientRect();
						return rect.left;
					}
				}
			}
			// Fallback: try to find any leaf in this group
			const allLeaves = workspace.getLeavesOfType('');
			for (const leaf of allLeaves) {
				const parent = (leaf as any).parent;
				if (parent && parent.id === groupId) {
					const containerEl = (parent as any).containerEl;
					if (containerEl) {
						const rect = containerEl.getBoundingClientRect();
						return rect.left;
					}
				}
			}
			return Infinity; // Put unknown groups at the end
		};
		
		const posA = getTabGroupPosition(a);
		const posB = getTabGroupPosition(b);
		return posA - posB;
	});
	
	// Get display name for a subgroup (first char of title, or first char of ID)
	const getSubgroupDisplayName = (subgroupId: string): string => {
		const title = groupTitles.get(subgroupId) || DEFAULT_GROUP_TITLE;
		// Return first character, fallback to '?' if empty
		return title.charAt(0).toUpperCase() || '?';
	};

	const toggleTabVisibility = () =>
		setSettings({ showActiveTabs: !showActiveTabs });
	const toggleSidebarVisibility = () =>
		setSettings({ hideSidebars: !hideSidebars });

	const toggleZenModeAndLockFocus = () => {
		toggleZenMode();
		lockFocus(plugin);
		const workspace = app.workspace;
		workspace.trigger(EVENTS.UPDATE_TOGGLE);
	};

	const toggleEditingTabs = () => {
		setIsEditingTabs(app, !isEditingTabs);
		props.container?.toggleClass("editing-tabs", !isEditingTabs);
	};

	const revealActiveTab = () => {
		uncollapseActiveGroup(app);
		setTimeout(() => {
			scorllToActiveTab();
		}, REFRESH_TIMEOUT_LONG);
	};

	const sortMenu = new Menu();
	sortMenu.addItem((item) => {
		item.setTitle("Disable").onClick(() => setSortStrategy(null));
	});
	sortMenu.addItem((item) => {
		item.setTitle("Title name (A to Z)")
			.onClick(() => setSortStrategy(sortStrategies.titleAToZ))
			.setChecked(sortStrategy === sortStrategies.titleAToZ);
	});
	sortMenu.addItem((item) => {
		item.setTitle("Title name (Z to A)")
			.onClick(() => setSortStrategy(sortStrategies.titleZToA))
			.setChecked(sortStrategy === sortStrategies.titleZToA);
	});
	sortMenu.addSeparator();
	sortMenu.addItem((item) => {
		item.setTitle("Pinned at top")
			.onClick(() => setSortStrategy(sortStrategies.pinnedAtTop))
			.setChecked(sortStrategy === sortStrategies.pinnedAtTop);
	});
	sortMenu.addItem((item) => {
		item.setTitle("Pinned at bottom")
			.onClick(() => setSortStrategy(sortStrategies.pinnedAtBottom))
			.setChecked(sortStrategy === sortStrategies.pinnedAtBottom);
	});
	sortMenu.addSeparator();
	sortMenu.addItem((item) => {
		item.setTitle("Recent on top")
			.onClick(() => setSortStrategy(sortStrategies.recentOnTop))
			.setChecked(sortStrategy === sortStrategies.recentOnTop);
	});
	sortMenu.addItem((item) => {
		item.setTitle("Recent on bottom")
			.onClick(() => setSortStrategy(sortStrategies.recentOnBottom))
			.setChecked(sortStrategy === sortStrategies.recentOnBottom);
	});
	sortMenu.addSeparator();
	sortMenu.addItem((item) => {
		item.setTitle("Oldest on top")
			.onClick(() => setSortStrategy(sortStrategies.oldestOnTop))
			.setChecked(sortStrategy === sortStrategies.oldestOnTop);
	});
	sortMenu.addItem((item) => {
		item.setTitle("Oldest on bottom")
			.onClick(() => setSortStrategy(sortStrategies.oldestOnBottom))
			.setChecked(sortStrategy === sortStrategies.oldestOnBottom);
	});

	// Get all FGroups for display
	const allFGroups = Object.values(fGroups);
	const { toggleFGroup } = useViewState();

	return (
		<div className="nav-header obsidian-vertical-tabs-toolbar">
			<div className="nav-buttons-container">
				{/* Left side: FGroup indicators (clickable) */}
				{allFGroups.length > 0 && (
					<div className="fgroup-indicators">
						{allFGroups.map((fGroup) => {
							const isActive = fGroup.id === activeFGroupId;
							// Get first character of FGroup name
							const displayName = fGroup.name.charAt(0).toUpperCase() || '?';
							return (
								<div
									key={fGroup.id}
									className={`fgroup-indicator ${isActive ? 'is-active' : ''}`}
									title={fGroup.name}
									onClick={() => toggleFGroup(fGroup.id)}
								>
									{displayName}
								</div>
							);
						})}
					</div>
				)}

				{/* Middle: Subgroup indicators (display only, sorted by position) */}
				{sortedSubgroupIds.length > 0 && (
					<div className="subgroup-indicators">
						{sortedSubgroupIds.map((subgroupId) => {
							const isActive = subgroupId === activeSubgroupId;
							const displayName = getSubgroupDisplayName(subgroupId);
							const fullTitle = groupTitles.get(subgroupId) || DEFAULT_GROUP_TITLE;
							// Check if active subgroup is in current FGroup
							const isInCurrentFGroup = currentFGroup?.groupIds.includes(subgroupId);
							const isActiveButNotInFGroup = isActive && !isInCurrentFGroup;
							return (
								<div
									key={subgroupId}
									className={`subgroup-indicator ${isActive ? 'is-active' : ''} ${isActiveButNotInFGroup ? 'is-active-dimmed' : ''}`}
									title={fullTitle}
								>
									{displayName}
								</div>
							);
							})}
					</div>
				)}
				
				{/* Spacer to push icons to the right */}
				<div className="nav-buttons-spacer" />
				
				{/* Right side: Original icons */}
				<IconButton
					icon="app-window"
					action="toggle-tab"
					tooltip="Show active tabs only"
					onClick={toggleTabVisibility}
					isActive={showActiveTabs}
					isNavAction={true}
				/>
				<IconButton
					icon="panel-left"
					action="toggle-sidebar"
					tooltip="Hide sidebars"
					onClick={toggleSidebarVisibility}
					isActive={hideSidebars}
					isNavAction={true}
				/>
				<IconButton
					icon="arrow-up-narrow-wide"
					action="sort-tabs"
					tooltip="Sort tabs"
					onClick={(e) => sortMenu.showAtMouseEvent(e.nativeEvent)}
					isActive={sortStrategy !== null}
					isNavAction={true}
				/>
				<IconButton
					icon="focus"
					action="zen-mode"
					tooltip="Zen mode"
					onClick={toggleZenModeAndLockFocus}
					isActive={zenMode}
					isNavAction={true}
				/>
				<IconButton
					icon="crosshair"
					action="reveal-tab"
					tooltip="Reveal active tab"
					disabled={isSingleGroup}
					onClick={revealActiveTab}
					isNavAction={true}
				/>
				<IconButton
					icon={
						globalCollapseState
							? "chevrons-up-down"
							: "chevrons-down-up"
					}
					action="global-collapse"
					tooltip={
						globalCollapseState ? "Expand all" : "Collapse all"
					}
					disabled={isSingleGroup}
					onClick={() =>
						globalCollapseState
							? setAllExpanded()
							: setAllCollapsed()
					}
					isNavAction={true}
				/>
				<IconButton
					icon="rotate-ccw"
					action="reset-subgroups"
					tooltip="Restore subgroups collapse state"
					disabled={isSingleGroup}
					onClick={resetSubgroups}
					isActive={false}
					isNavAction={true}
				/>
				{Platform.isMobile && useTabEditing && (
					<IconButton
						icon="copy-check"
						action="editing-tabs"
						tooltip="Edit tabs"
						onClick={toggleEditingTabs}
						isActive={isEditingTabs}
						isNavAction={true}
					/>
				)}
			</div>
		</div>
	);
};
