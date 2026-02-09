import { NavigationTreeItem } from "./NavigationTreeItem";
import { IconButton } from "./IconButton";
import { useViewState } from "src/models/ViewState";
import { useApp } from "src/models/PluginContext";
import { EVENTS } from "src/constants/Events";
import { FGroup as FGroupData } from "src/models/ViewState";
import { autoResizeLayout } from "src/services/AutoResizeLayout";
import { REFRESH_TIMEOUT } from "src/constants/Timeouts";
import { App, Modal } from "obsidian";

interface FGroupProps {
	fGroup: FGroupData;
	children?: React.ReactNode;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
}

class FGroupNameModal extends Modal {
	private onSubmit: (name: string) => void;
	private inputEl: HTMLInputElement | null = null;

	constructor(app: App, title: string, onSubmit: (name: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.titleEl.setText(title);
	}

	onOpen() {
		const { contentEl } = this;

		const inputContainer = contentEl.createDiv();
		this.inputEl = inputContainer.createEl("input", {
			type: "text",
			placeholder: "Enter fgroup name",
		});
		this.inputEl.style.width = "100%";
		this.inputEl.style.padding = "8px";
		this.inputEl.style.marginBottom = "16px";
		this.inputEl.style.fontSize = "14px";

		const buttonContainer = contentEl.createDiv({
			cls: "modal-button-container",
		});

		const submitButton = buttonContainer.createEl("button", {
			cls: "mod-cta",
			text: "OK",
		});
		submitButton.onclick = () => {
			const name = this.inputEl?.value?.trim();
			if (name) {
				this.onSubmit(name);
				this.close();
			}
		};

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.onclick = () => {
			this.close();
		};

		setTimeout(() => {
			if (this.inputEl) {
				this.inputEl.focus();
				this.inputEl.select();
			}
		}, 100);

		this.inputEl?.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				const name = this.inputEl?.value?.trim();
				if (name) {
					this.onSubmit(name);
					this.close();
				}
			} else if (e.key === "Escape") {
				this.close();
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export const FGroup = (props: FGroupProps) => {
	const app = useApp();
	const workspace = app.workspace;
	const { fGroup, children, isCollapsed, onToggleCollapse } = props;

	const {
		deleteFGroup,
		renameFGroup,
		toggleFGroupVisibility,
		getFGroup,
	} = useViewState();

	const currentGroup = getFGroup(fGroup.id);
	const isHidden = currentGroup?.isHidden ?? false;

	const toggleVisibility = () => {
		toggleFGroupVisibility(fGroup.id, !isHidden);
		workspace.trigger(EVENTS.UPDATE_TOGGLE);
		setTimeout(() => {
			autoResizeLayout(app);
		}, REFRESH_TIMEOUT);
	};

	const deleteGroup = () => {
		if (confirm(`Delete fgroup "${fGroup.name}"?`)) {
			deleteFGroup(fGroup.id);
		}
	};

	const renameGroup = () => {
		new FGroupNameModal(app, "Rename FGroup", (newName) => {
			renameFGroup(fGroup.id, newName);
		}).open();
	};

	const menuItems = (
		<>
			<IconButton
				icon={isCollapsed ? "right-triangle" : "down-triangle"}
				action="collapse"
				tooltip={isCollapsed ? "Expand" : "Collapse"}
				onClick={onToggleCollapse}
			/>
			<IconButton
				icon={isHidden ? "eye" : "eye-off"}
				action="show"
				tooltip={isHidden ? "Show" : "Hide"}
				onClick={toggleVisibility}
			/>
			<IconButton
				icon="pencil"
				action="rename"
				tooltip="Rename fgroup"
				onClick={renameGroup}
			/>
			<IconButton
				icon="trash"
				action="delete"
				tooltip="Delete fgroup"
				onClick={deleteGroup}
			/>
		</>
	);

	return (
		<NavigationTreeItem
			id={fGroup.id}
			isTab={false}
			title={fGroup.name}
			onClick={onToggleCollapse}
			dataType="fgroup"
			toolbar={menuItems}
			icon="folder"
			isCollapsed={isCollapsed}
			isSidebar={false}
			isSingleGroup={false}
			isActiveGroup={false}
			classNames={{
				"is-hidden": isHidden,
				"is-fgroup": true,
			}}
		>
			{!isCollapsed && children}
		</NavigationTreeItem>
	);
};