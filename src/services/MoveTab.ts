import {
	App,
	WorkspaceLeaf,
	WorkspaceMobileDrawer,
	WorkspaceParent,
	WorkspaceSidedock,
} from "obsidian";
import { syncUIForGroupView } from "src/models/VTGroupView";
import { Identifier } from "src/models/VTWorkspace";
import { VERTICAL_TABS_VIEW } from "src/views/VerticalTabsView";
import { REFRESH_TIMEOUT_LONG } from "src/constants/Timeouts";

export function reapplyEphemeralState(
	leaf: WorkspaceLeaf,
	state: unknown = null
) {
	setTimeout(() => {
		const ephemeralState = state ?? leaf.getEphemeralState();
		leaf.setEphemeralState(ephemeralState);
	}, REFRESH_TIMEOUT_LONG);
}

export function moveTab(
	app: App,
	sourceID: Identifier,
	targetID: Identifier | null
): WorkspaceLeaf | null {
	if (!targetID) return null;
	if (sourceID === targetID) return null;
	const sourceLeaf = app.workspace.getLeafById(sourceID);
	const targetLeaf = app.workspace.getLeafById(targetID);
	if (!sourceLeaf || !targetLeaf) return null;
	const sourceParent = sourceLeaf.parent;
	const targetParent = targetLeaf.parent;
	const sourceIndex = sourceParent.children.indexOf(sourceLeaf);
	const targetIndex = targetParent.children.indexOf(targetLeaf);
	const insertIndex =
		sourceParent.id === targetParent.id && sourceIndex < targetIndex
			? targetIndex - 1
			: targetIndex;
	sourceParent.removeChild(sourceLeaf);
	targetParent.insertChild(insertIndex, sourceLeaf);
	app.workspace.requestResize();
	syncUIForGroupView(sourceParent);
	syncUIForGroupView(targetParent);
	return sourceLeaf;
}

export function moveTabToEnd(
	app: App,
	sourceID: Identifier,
	targetParent: WorkspaceParent
): WorkspaceLeaf | null {
	const sourceLeaf = app.workspace.getLeafById(sourceID);
	if (!sourceLeaf) return null;
	const sourceParent = sourceLeaf.parent;

	// Use native Obsidian methods
	sourceParent.removeChild(sourceLeaf);
	targetParent.insertChild(targetParent.children.length, sourceLeaf);

	app.workspace.onLayoutChange();
	reapplyEphemeralState(sourceLeaf);
	return sourceLeaf;
}

export async function moveTabToNewGroup(
	app: App,
	sourceID: Identifier
): Promise<WorkspaceLeaf | null> {
	const sourceLeaf = app.workspace.getLeafById(sourceID);
	if (!sourceLeaf) return null;
	const sourceParent = sourceLeaf.parent;
	const height = sourceParent.containerEl.clientHeight;
	const width = sourceParent.containerEl.clientWidth;
	const preferredDirection = height > width ? "horizontal" : "vertical";
	const targetLeaf = await app.workspace.duplicateLeaf(
		sourceLeaf,
		"split",
		preferredDirection
	);
	targetLeaf.setPinned(!!sourceLeaf.getViewState().pinned);
	reapplyEphemeralState(targetLeaf, sourceLeaf.getEphemeralState());
	sourceLeaf.detach();
	return targetLeaf;
}

export async function moveSelfToNewGroupAndHide(app: App) {
	const workspace = app.workspace;
	const self = workspace.getLeavesOfType(VERTICAL_TABS_VIEW).first();
	if (!self) return;
	const newSelf = await moveTabToNewGroup(app, self.id);
	if (!newSelf) return;
	newSelf.parent.containerEl.addClass("is-hidden");
}

export function selfIsClosed(app: App) {
	const workspace = app.workspace;
	const self = workspace.getLeavesOfType(VERTICAL_TABS_VIEW).first();
	return !self;
}

export function ensureSelfIsOpen(app: App) {
	if (selfIsClosed(app)) {
		const leaf = this.app.workspace.getLeftLeaf(false);
		leaf.setViewState({ type: VERTICAL_TABS_VIEW, active: true });
	}
}

export function selfIsNotInTheSidebar(app: App) {
	const workspace = app.workspace;
	const self = workspace.getLeavesOfType(VERTICAL_TABS_VIEW).first();
	if (!self) return false;
	const root = self.getRoot();
	return root !== workspace.leftSplit && root !== workspace.rightSplit;
}

export async function moveSelfToDefaultLocation(app: App) {
	const workspace = app.workspace;
	const leaves = workspace.getLeavesOfType(VERTICAL_TABS_VIEW);
	if (leaves.length === 0) return;
	const self = leaves[0];
	const leftSidebar = workspace.leftSplit;
	if (leftSidebar instanceof WorkspaceSidedock) {
		const parent = leftSidebar.children[0] as unknown as WorkspaceParent;
		moveTabToEnd(app, self.id, parent);
	} else if (leftSidebar instanceof WorkspaceMobileDrawer) {
		const parent = leftSidebar.parent;
		moveTabToEnd(app, self.id, parent);
	}
}
