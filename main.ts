import {
    App,
    ButtonComponent,
    Editor,
    EditorPosition,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    SliderComponent,
    SuggestModal,
    TextComponent,
} from "obsidian";
import Typo from "typo-js";
import aff from "./dictionary/en_US.aff";
import dic from "./dictionary/en_US.dic";
import { ClientOptions, OpenAI } from "openai";
import { spawn, ChildProcess } from "child_process";

interface StrongSpellcheckSettings {
    typoSettings: TypoSettings;
    llmSettings: LLMSettings;
}

interface TypoSettings {
    numSuggestions: number;
}

interface LLMSettings {
    path: string;
}

const DEFAULT_SETTINGS: StrongSpellcheckSettings = {
    typoSettings: { numSuggestions: 3 },
    llmSettings: { path: "" },
};

export default class StrongSpellcheck extends Plugin {
    dictionary: Typo;
    openai: OpenAI;
    settings: StrongSpellcheckSettings;
    child: ChildProcess | null = null;

    async correctWord(word: string, phrase: string) {
        function formatting(input: string): string {
            const specialChars = [".", "<", '"'];
            for (const char of specialChars) {
                const index = input.indexOf(char);
                if (index !== -1) {
                    return input.substring(0, index);
                }
            }
            return input; // Return the original string if no special characters found
        }

        const result = await this.openai.chat.completions.create({
            model: "Custom",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a robot that responds to prompts and answers with one word only. DO NOT RESPOND WITH LONG ANSWERS. The ONLY part of your response that will ever be appreciated is the first word you say." +
                        "\n\n" +
                        `In the phrase "${phrase}" the word "${word}" is misspelled. The correct spelling is "`,
                },
            ],
            max_tokens: 4,
            n: 1, //TODO: fix bugs and make configurable
        });
        return result.choices.map(
            (it) => formatting(it.message.content ?? "").toLowerCase() //FIXME: We should be more nuanced about capitalization
        );
    }

    startLLMProcess() {
        if (this.settings.llmSettings.path === "") return;
        this.child = spawn("bash", [`${this.settings.llmSettings.path}`], {
            stdio: "inherit",
            detached: false,
        });

        this.child.on("error", (error) => {
            console.error(`Error spawning node process: ${error}`);
            new Notice(`Error executing process: ${error}`);
        });

        this.child.on("exit", (code, signal) => {
            console.log(
                `Process exited with code ${code} and signal ${signal}`
            );
            new Notice("Node process executed and exited!");
        });
    }

    async onload() {
        await this.loadSettings();

        this.registerEvent(this.app.workspace.on("quit", () => {}));

        this.startLLMProcess();

        //load library when plugin is loaded
        this.dictionary = new Typo("en_US", aff, dic, {});

        const config: ClientOptions = {
            apiKey: "unused",
            dangerouslyAllowBrowser: true,
            baseURL: "http://localhost:8080/v1",
        };

        this.openai = new OpenAI(config);

        this.addCommand({
            id: "spellcheck-current",
            name: "Check Current Word",
            editorCheckCallback: (checking: boolean, editor: Editor) => {
                const cursor: EditorPosition = editor.getCursor();
                const wordRange = editor.wordAt(cursor);
                if (wordRange == null) return false;
                const word = editor.getRange(wordRange.from, wordRange.to);
                const dict = this.dictionary;
                const line: string = editor.getLine(cursor.line);

                /**
                 * At this point we have a valid word, even if its "correctly" spelled we want to pop up a modal
                 * so that the user can see if there are any suggestions, and also for future proofing when we
                 * have LLM correction
                 */
                if (checking) return true;

                const modal = new WordSelectModal(
                    this.app,
                    (corrected: string) => {
                        editor.replaceRange(
                            corrected,
                            { line: cursor.line, ch: wordRange.from.ch },
                            { line: cursor.line, ch: wordRange.to.ch }
                        );
                    }
                );
                modal.open();

                // Update with hunspell results
                new Promise(() => {
                    setTimeout(() => {
                        const options = dict.suggest(
                            word,
                            this.settings.typoSettings.numSuggestions
                        );
                        const typed: ModalOption[] = options.map((opt) => ({
                            option: opt,
                            desc: "Dictionary",
                        }));
                        modal.options.push(...typed);
                        modal.close();
                        modal.open();
                    }, 10); //This is so cursed :( forces stuff to run in correct order
                }).then();

                // Update with AI results
                new Promise(() => {
                    setTimeout(() => {
                        this.correctWord(word, line).then((words) => {
                            const typed: ModalOption[] = words.map((opt) => ({
                                option: opt,
                                desc: "LLM",
                            }));
                            console.log("llm options", typed);
                            modal.options.push(...typed);
                            modal.close();
                            modal.open();
                        });
                    }, 20); //This is so cursed :( forces stuff to run in correct order
                }).then();

                return true;
            },
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new StrongSpellCheckSettingsTab(this.app, this));
    }

    onunload() {
        this.child?.kill();
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

interface ModalOption {
    option: string;
    desc: string;
}

export class WordSelectModal extends SuggestModal<ModalOption> {
    options: ModalOption[] = [];
    emptyStateText: string = "Loading...";
    replaceCallback: (item: string) => void;

    constructor(app: App, replaceCallback: (choice: string) => void) {
        super(app);
        this.replaceCallback = replaceCallback;
    }

    getSuggestions(query: string): ModalOption[] | Promise<ModalOption[]> {
        return this.options.filter((it) =>
            it.option.toLowerCase().contains(query.toLowerCase())
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChooseSuggestion(
        item: ModalOption,
        ignored: MouseEvent | KeyboardEvent
    ): void {
        this.replaceCallback(item.option);
    }

    renderSuggestion(value: ModalOption, el: HTMLElement): void {
        el.createEl("div", { text: value.option });
        el.createEl("small", { text: value.desc });
    }
}

class StrongSpellCheckSettingsTab extends PluginSettingTab {
    plugin: StrongSpellcheck;

    constructor(app: App, plugin: StrongSpellcheck) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl).setHeading().setName("Dictionary");

        new Setting(containerEl)
            .setName("Desired Result Number")
            .setDesc("Number of results to get from typo.js")
            .addSlider((slider: SliderComponent) => {
                slider
                    .setValue(this.plugin.settings.typoSettings.numSuggestions)
                    .setLimits(0, 10, 1)
                    .setDynamicTooltip()
                    .onChange((num: number) => {
                        this.plugin.settings.typoSettings.numSuggestions = num;
                        this.plugin.saveSettings().then();
                    });
            });

        new Setting(containerEl).setHeading().setName("LLM");

        new Setting(containerEl)
            .setName("Target Directory")
            .setDesc("Valid, executable, llamafile to use for suggestions")
            .addText((text: TextComponent) => {
                text.setValue(this.plugin.settings.llmSettings.path)
                    .setPlaceholder("Path")
                    .onChange((path: string) => {
                        this.plugin.settings.llmSettings.path = path;
                        this.plugin.saveSettings().then();
                    });
            })
            .addButton((cb: ButtonComponent) => {
                cb.setButtonText("Refresh LLM").onClick(() => {
                    this.plugin.child?.kill(); //kill any existing process
                    this.plugin.startLLMProcess(); //start anew
                });
            });
        //TODO: Easy download button
    }
}
