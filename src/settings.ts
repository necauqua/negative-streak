declare global {
  interface SettingsShape extends ExtractSettings<
    typeof import("./settings")
  > {}
}

export default [
  {
    id: "set-negative",
    ui_name: "Set real streak value too",
    ui_description:
      "Useful for memory-reading tools (aka Noita Utility Box) to read the current streak as being negative.",
    value_default: false,
    scope: ModSettingScope.Runtime,
  },
] as const satisfies ModSetting[];
