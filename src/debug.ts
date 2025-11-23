import { MOD_ID } from "$mod";
import noita from "@noita-ts/base";
import { Ptr } from "@noita-ts/ffi";
import GLOBAL_STATS from "@noita-ts/ffi/global_stats";

export default (sessionRender: Ptr<number>, prevBestRender: Ptr<number>) => {
  // just init our memory so render doesn't show garbage
  noita.on("PlayerSpawned", () => {
    let streak = (ModSettingGet(MOD_ID + ".streak") || 0) as number;
    const worst = (ModSettingGet(MOD_ID + ".worst") || 0) as number;
    sessionRender[0] = -streak;
    prevBestRender[0] = -worst;
  });

  let debugGui: GuiID | undefined;

  const renderDebug = (shade: number) => {
    if (!debugGui) {
      debugGui = GuiCreate();
    }

    GuiStartFrame(debugGui);

    const text = string.format(
      "game: %d/%d | render: %d/%d | wins/deaths: (%d+%d)/%d",
      GLOBAL_STATS.session.streak,
      GLOBAL_STATS.highest.streak,
      sessionRender[0],
      prevBestRender[0],
      GLOBAL_STATS.KEY_VALUE_STATS.get("progress_ending0") ?? 0,
      GLOBAL_STATS.KEY_VALUE_STATS.get("progress_ending1") ?? 0,
      GLOBAL_STATS.global.death_count,
    );
    GuiColorSetForNextWidget(debugGui, shade, shade, shade, 1);
    GuiText(debugGui, 65, 0, text);

    GuiColorSetForNextWidget(debugGui, shade, shade, shade, 1);
    const [left, right] = GuiButton(debugGui, 1, 65, 8, "[reset]");

    if (left) {
      ModSettingSet(MOD_ID + ".streak", 0);
      sessionRender[0] = 0;
    }

    if (right) {
      ModSettingSet(MOD_ID + ".worst", 0);
      prevBestRender[0] = 0;
    }

    GuiColorSetForNextWidget(debugGui, shade, shade, shade, 1);
    const [left2, right2] = GuiButton(debugGui, 2, 100, 8, "[die/win]");

    if (left2) {
      const [player] = EntityGetWithTag("player_unit");
      if (player !== null) {
        EntityInflictDamage(
          player,
          999999,
          "DAMAGE_PHYSICS_HIT",
          "suicide",
          "NORMAL",
          0,
          0,
        );
      }
    }

    if (right2) {
      GameAddFlagRun("ending_game_completed");
      AddFlagPersistent(
        InputIsKeyDown(225) || InputIsKeyDown(229) // lshift/rshift
          ? "progress_ending1"
          : "progress_ending0",
      );
      GameOnCompleted();
      const [player] = EntityGetWithTag("player_unit");
      if (player !== null) {
        EntityInflictDamage(
          player,
          999999,
          "DAMAGE_PHYSICS_HIT",
          "he won",
          "NORMAL",
          0,
          0,
        );
      }
    }
  };

  noita.on("WorldPreUpdate", () => renderDebug(1));
  noita.on("PausePreUpdate", () => renderDebug(0.5));
};
