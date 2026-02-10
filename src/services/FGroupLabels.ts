import { WorkspaceLeaf } from "obsidian";
import { useViewState } from "src/models/ViewState";
import { EVENTS } from "src/constants/Events";

const F_GROUP_LABEL_CLASS = "vt-fgroup-label";
const F_GROUP_LABEL_ACTIVE_CLASS = "vt-fgroup-label-active";
const F_GROUP_LABEL_INACTIVE_CLASS = "vt-fgroup-label-inactive";
const GROUP_LABEL_CLASS = "vt-group-label";

export function updateFGroupLabelsForLeaf(leaf: WorkspaceLeaf) {
	if (!leaf.tabHeaderEl) return;

	// Only show F group labels for active tabs
	if (!leaf.tabHeaderEl.hasClass('is-active')) return;

	const group = leaf.parent;
	if (!group) return;

	const { fGroups, activeFGroupId, groupTitles } = useViewState.getState();
	const groupId = group.id;

	const containingFGroups = Object.values(fGroups).filter(
		(fGroup) => fGroup.groupIds.includes(groupId)
	);

	// Remove all existing labels and containers
	const existingLabels = leaf.tabHeaderEl.querySelectorAll(`.${F_GROUP_LABEL_CLASS}, .${GROUP_LABEL_CLASS}`);
	existingLabels.forEach((label) => label.remove());

	const labelsContainer = leaf.tabHeaderEl.querySelector(".vt-fgroup-labels");
	if (labelsContainer) {
		labelsContainer.remove();
	}

	if (containingFGroups.length === 0 && !groupTitles.get(groupId)) return;

	const newLabelsContainer = leaf.tabHeaderEl.createDiv({
		cls: "vt-fgroup-labels",
	});

	const groupTitle = groupTitles.get(groupId);
	if (groupTitle) {
		const groupLabel = newLabelsContainer.createSpan({
			cls: GROUP_LABEL_CLASS,
			text: groupTitle,
		});
	}

	containingFGroups.forEach((fGroup) => {
		const label = newLabelsContainer.createSpan({
			cls: F_GROUP_LABEL_CLASS,
			text: fGroup.name,
		});

		if (fGroup.id === activeFGroupId) {
			label.addClass(F_GROUP_LABEL_ACTIVE_CLASS);
		} else {
			label.addClass(F_GROUP_LABEL_INACTIVE_CLASS);
		}
	});
}

export function removeFGroupLabelsForLeaf(leaf: WorkspaceLeaf) {
	if (!leaf.tabHeaderEl) return;

	const existingLabels = leaf.tabHeaderEl.querySelectorAll(`.${F_GROUP_LABEL_CLASS}`);
	existingLabels.forEach((label) => label.remove());

	const labelsContainer = leaf.tabHeaderEl.querySelector(".vt-fgroup-labels");
	if (labelsContainer) {
		labelsContainer.remove();
	}
}

export function updateAllFGroupLabels(app: any) {
	const { iterateRootOrFloatingLeaves } = require("./GetTabs");
	iterateRootOrFloatingLeaves(app, (leaf: WorkspaceLeaf) => {
		updateFGroupLabelsForLeaf(leaf);
	});
}
