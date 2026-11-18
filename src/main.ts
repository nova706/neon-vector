import "./style.css";
import { mountNeonVectorPhaser } from "./boot/mountNeonVector";
import { GameMenuActions } from "./engine/GameMenu";
import { SettingsStore } from "./engine/storage/SettingsStore";

export { mountNeonVectorPhaser };

const root = document.querySelector<HTMLElement>("#app")!;
const settings = new SettingsStore();
void mountNeonVectorPhaser(root, () => {}, settings.namespace("neon-vector"), new GameMenuActions());
