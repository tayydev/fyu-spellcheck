import {
    App,
    Editor,
    EditorPosition,
    FuzzySuggestModal,
    Plugin,
    PluginSettingTab,
    Setting,
} from "obsidian";
import Typo from "typo-js";
import aff from "./dic/en_US.aff";
import dic from "./dic/en_US.dic";

export default class MyPlugin extends Plugin {
    dictionary: Typo;

    async onload() {
        //load library when plugin is loaded
        this.dictionary = new Typo("en_US", aff, dic, {});

        this.addCommand({
            id: "spellcheck-current",
            name: "Check Current Word",
            editorCheckCallback: (checking: boolean, editor: Editor) => {
                const cursor: EditorPosition = editor.getCursor();
                const wordRange = editor.wordAt(cursor);
                if (wordRange == null) return false;
                const word = editor.getRange(wordRange.from, wordRange.to);
                const dict = this.dictionary;

                /**
                 * At this point we have a valid word, even if its "correctly" spelled we want to pop up a modal
                 * so that the user can see if there are any suggestions, and also for future proofing when we
                 * have LLM correction
                 */
                if (checking) return true;

                const options = dict.suggest(word);
                new WordSelectModal(this.app, options, (corrected: string) => {
                    editor.replaceRange(
                        corrected,
                        { line: cursor.line, ch: wordRange.from.ch },
                        { line: cursor.line, ch: wordRange.to.ch }
                    );
                }).open();

                return true;
            },
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new fyuSpellcheckSettingsTab(this.app, this));
    }

    onunload() {}
}

export class WordSelectModal extends FuzzySuggestModal<string> {
    options: string[];
    replaceCallback: (item: string) => void;
    constructor(
        app: App,
        options: string[],
        replaceCallback: (item: string) => void
    ) {
        super(app);
        this.options = options;
        this.replaceCallback = replaceCallback;
    }

    getItemText(item: string): string {
        return item;
    }

    getItems(): string[] {
        return this.options;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChooseItem(item: string, _ignored: MouseEvent | KeyboardEvent): void {
        this.replaceCallback(item);
    }
}

class fyuSpellcheckSettingsTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Configuration is on it's way...")
            .setDesc("Eventually...");
    }
}
