import {
    App,
    Editor,
    EditorPosition,
    MarkdownView,
    Plugin,
    PluginSettingTab,
    Setting,
} from "obsidian";
import Typo from "typo-js";
import { aff, dic } from "./data";

export default class MyPlugin extends Plugin {
    dictionary: Typo;

    correctWord(fromLeft: boolean, editor: Editor) {
        const cursor: EditorPosition = editor.getCursor();
        const line: string = editor.getLine(cursor.line);
        const dict = this.dictionary;

        function didReplace(word: string): boolean {
            // console.log("Processing Word: ", word)
            if (dict.check(word)) return false;
            else {
                const corrected: string = dict.suggest(word).first() ?? word;
                const updatedLine: string = line.replace(word, corrected);
                editor.replaceRange(
                    updatedLine,
                    { line: cursor.line, ch: 0 },
                    { line: cursor.line, ch: line.length }
                );
                return true;
            }
        }

        const splitWords = line.split(/\s+/);

        if (fromLeft) {
            for (let i = 0; i < splitWords.length; i++) {
                if (didReplace(splitWords[i])) break;
            }
        } else {
            for (let i = splitWords.length - 1; i >= 0; i--) {
                if (didReplace(splitWords[i])) break;
            }
        }
    }

    async onload() {
        //load library when plugin is loaded
        this.dictionary = new Typo("en_US", aff, dic, {});

        this.addCommand({
            id: "spellcheck-leftmost",
            name: "Spellcheck leftmost word",
            editorCallback: (editor: Editor, _: MarkdownView) => {
                this.correctWord(true, editor);
            },
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new fyuSpellcheckSettingsTab(this.app, this));
    }

    onunload() {}
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
            .setName("Settings are on their way...")
            .setDesc("Eventually...");
    }
}
