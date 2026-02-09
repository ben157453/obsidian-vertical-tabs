import { App, WorkspaceParent } from "obsidian";
import { useViewState } from "src/models/ViewState";

interface SplitInfo {
	element: HTMLElement;
	isHorizontal: boolean;
	isVertical: boolean;
	visibleGroups: WorkspaceParent[];
}

export function autoResizeLayout(app: App) {
	const workspace = app.workspace;
	const rootSplit = workspace.rootSplit;
	
	if (!rootSplit) return;

	const splitInfos = collectSplitInfo(rootSplit);
	
	splitInfos.forEach((splitInfo) => {
		adjustSplitLayout(splitInfo);
	});
	
	workspace.onLayoutChange();
}

function collectSplitInfo(rootSplit: WorkspaceParent): SplitInfo[] {
	const splitInfos: SplitInfo[] = [];
	const hiddenGroups = useViewState.getState().hiddenGroups;
	
	function traverseSplit(split: WorkspaceParent) {
		const splitEl = split.containerEl;
		
		if (!splitEl || !splitEl.classList.contains("workspace-split")) {
			return;
		}
		
		const isHorizontal = splitEl.classList.contains("mod-horizontal");
		const isVertical = splitEl.classList.contains("mod-vertical");
		
		if (isHorizontal || isVertical) {
			const visibleGroups: WorkspaceParent[] = [];
			
			split.children.forEach((child) => {
				if (child instanceof WorkspaceParent) {
					const isHidden = hiddenGroups.includes(child.id);
					if (!isHidden) {
						visibleGroups.push(child);
					}
					traverseSplit(child);
				}
			});
			
			if (visibleGroups.length > 0) {
				splitInfos.push({
					element: splitEl,
					isHorizontal,
					isVertical,
					visibleGroups,
				});
			}
		}
	}
	
	traverseSplit(rootSplit);
	
	return splitInfos;
}

function adjustSplitLayout(splitInfo: SplitInfo) {
	const { element, isHorizontal, isVertical, visibleGroups } = splitInfo;
	
	if (visibleGroups.length === 0) {
		element.classList.add("is-empty-split");
		return;
	}
	
	element.classList.remove("is-empty-split");
	
	const children = Array.from(element.children) as HTMLElement[];
	const visibleChildren = children.filter((child) => {
		const tabsContainer = child.querySelector(".workspace-tabs");
		if (!tabsContainer) return true;
		
		return !tabsContainer.classList.contains("is-hidden");
	});
	
	if (visibleChildren.length === 0) {
		element.classList.add("is-empty-split");
		return;
	}
	
	element.classList.remove("is-empty-split");
	
	const percentage = 100 / visibleChildren.length;
	
	visibleChildren.forEach((child) => {
		child.style.flexBasis = `${percentage}%`;
		child.style.flexGrow = "1";
		child.style.flexShrink = "1";
	});
	
	children.forEach((child) => {
		if (!visibleChildren.includes(child)) {
			child.style.flexBasis = "0";
			child.style.flexGrow = "0";
			child.style.flexShrink = "0";
		}
	});
}

export function resetLayoutStyles(rootSplit: WorkspaceParent) {
	function traverseSplit(split: WorkspaceParent) {
		const splitEl = split.containerEl;
		
		if (!splitEl || !splitEl.classList.contains("workspace-split")) {
			return;
		}
		
		splitEl.classList.remove("is-empty-split");
		
		const children = Array.from(splitEl.children) as HTMLElement[];
		children.forEach((child) => {
			child.style.flexBasis = "";
			child.style.flexGrow = "";
			child.style.flexShrink = "";
		});
		
		split.children.forEach((child) => {
			if (child instanceof WorkspaceParent) {
				traverseSplit(child);
			}
		});
	}
	
	traverseSplit(rootSplit);
}