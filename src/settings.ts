import * as lib from "data/scripts/lib/mod_settings.lua";
import { MOD_ID } from "$mod";

// Noita-TS got no sugar/typings for mod settings yet 🤷
//  but this is a good proof that you can interact with any lua from TS now, it'd just be ugly

const mod_settings = [
  {
    id: "set-negative",
    ui_name: "Set real streak value too",
    ui_description:
      "Useful for memory-reading tools (aka Noita Utility Box) to read the current streak as being negative.",
    value_default: false,
    scope: lib.MOD_SETTINGS_SCOPE_RUNTIME,
  },
];

(globalThis as any)["ModSettingsUpdate"] = (init_scope: any) =>
  lib.mod_settings_update(MOD_ID, mod_settings, init_scope);

(globalThis as any)["ModSettingsGuiCount"] = () =>
  lib.mod_settings_gui_count(MOD_ID, mod_settings);

(globalThis as any)["ModSettingsGui"] = (gui: any, in_main_menu: any) =>
  lib.mod_settings_gui(MOD_ID, mod_settings, gui, in_main_menu);
