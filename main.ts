import {App, Editor, EditorPosition, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting} from 'obsidian';
import Typo from "typo-js";
import {aff, dic} from "./data";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		//load library when plugin is loaded
		const dictionary: Typo = new Typo(
			'en_US',
			aff,
			dic,
			{}
		)

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'spellcheck-leftmost',
			name: 'Spellcheck leftmost word',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const cursor: EditorPosition = editor.getCursor();
				const line: string = editor.getLine(cursor.line);
				const splitWords = line.split(/\s+/);
				for(const word of splitWords) {
					console.log("word", word)
					if(!dictionary.check(word)) {
						const corrected: string = dictionary.suggest(word).first() ?? word //TODO: Does this null check do anything
						const updatedLine: string = line.replace(word, corrected);
						editor.replaceRange(updatedLine, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: line.length });
						break;
					}
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
