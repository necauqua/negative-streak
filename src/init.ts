import { DEV, MOD_ID } from "$mod";
import noita from "@noita-ts/base";
import ffi from "@noita-ts/ffi";
import GLOBAL_STATS from "@noita-ts/ffi/global_stats";
import debug from "./debug";

let ourMemoryAddr;

const push = ffi.locateStringPush("$stat_streaks");

// find the next CALL after the push, which is std::string assignment
const call = ffi.scan([0xe8], { at: push });

// LEA EDX=>global_stats.prev_best.streaks
if (ffi.cast("uint8_t*", call + 5)[0] !== 0x8d) {
  // ^ this means we already patched stuff
  // just grab our pointer from the patch
  ourMemoryAddr = tonumber(ffi.cast("uint32_t*", call + 6)[0])! - 4;
} else {
  ffi.cdef("void* malloc(size_t size);");

  ourMemoryAddr = tonumber(ffi.cast("uint32_t", ffi.C.malloc(8)))!;

  // remove the check for highest streak being > 0
  // when choosing if to show the streak in the game over screen at all
  ffi.patch([0x7c, 0x7d], [0x66, 0x90], { at: push, back: true });

  // make isVanilla always return true, so that the streaks are counted and always shown
  //  basically a subset of disable mod restrictions
  const isVanillaCall = ffi.scan([0xe8], { at: push, back: true });
  const isVanillaOffset = ffi.cast("int32_t*", isVanillaCall + 1);
  const isVanillaAddr = isVanillaCall + 5 + isVanillaOffset[0];

  // just patch the function to instantly return 1 lmao
  ffi.patchRaw(isVanillaAddr, [
    0xb0, // \
    0x01, // | mov al, 1
    0xc3, // ret
  ]);

  // find and erase the GLOBAL_STATS.highest assignment to its initial value in the `if (mods are present)` block
  const killerCauseStr = ffi.locateStringPush(
    "$menugameover_causeofdeath_killer_cause",
  );

  // ew
  const highestAddr =
    tonumber(ffi.cast("uint32_t", ffi.cast("void*", GLOBAL_STATS)))! +
    ffi.offsetof("GlobalStats", "highest");

  const highestLoc = ffi.scan(highestAddr, { at: killerCauseStr, limit: 4096 });
  ffi.patch(
    [0xe8],
    [
      0x83, // \
      0xc4, // | add esp, 4 (to clean up the stack from the pushed arg)
      0x04, // /
      0x66, // \
      0x90, // | nop
    ],
    { at: highestLoc + 4 },
  );

  // remove the check for prev_best.streak being >= 1
  // when choosing if to show the RECORD! thing
  ffi.patch([0x7e, 0x0c], [0x66, 0x90], { at: push, back: true });

  const movPatch = (addr: number) => [
    0xba, // mov edx, imm32
    addr & 0xff,
    (addr >>> 8) & 0xff,
    (addr >>> 16) & 0xff,
    (addr >>> 24) & 0xff,
    0x90, // nop
  ];

  // patch both following LEA instructions to load from our memory instead
  // LEA EDX=>global_stats.prev_best.streaks
  ffi.patch([0x8d, 0x95], movPatch(ourMemoryAddr + 4), { at: push });
  // LEA EDX=>global_stats.session.streaks
  ffi.patch([0x8d, 0x95], movPatch(ourMemoryAddr), { at: push });
}

const sessionRender = ffi.cast("uint32_t*", ourMemoryAddr);
const prevBestRender = ffi.cast("uint32_t*", ourMemoryAddr + 4);

// locate the CMP instruction that we dont patch
const streakRecordJL = ffi.scan([0x39, 0x85], { at: push, back: true }) + 6;

// skip the actual check of session.streak >= prev_best.streak
const forceRecord = () => ffi.patchRaw(streakRecordJL, [0x66, 0x90]);
// undo the above, duh
const restoreRecord = () => ffi.patchRaw(streakRecordJL, [0x7c, 0x04]);

noita.on("PlayerSpawned", () => {
  if (ModSettingGet(MOD_ID + ".streak") !== undefined) {
    return;
  }

  // ideally we would scan session stat files for largest death streak retroactively,
  // but apparently you can't tell if the run was a win or not?.. nolla..
  const endroomWins = GLOBAL_STATS.KEY_VALUE_STATS.get("progress_ending0") ?? 0;
  const altarWins = GLOBAL_STATS.KEY_VALUE_STATS.get("progress_ending1") ?? 0;

  if (endroomWins + altarWins === 0) {
    ModSettingSet(MOD_ID + ".streak", GLOBAL_STATS.global.death_count);
    ModSettingSet(MOD_ID + ".worst", GLOBAL_STATS.global.death_count);
  }
});

noita.on("PlayerDied", () => {
  // if you won
  if (
    GameHasFlagRun("ending_game_completed") ||
    MagicNumbersGetValue("DEBUG_ALWAYS_COMPLETE_THE_GAME") != "0"
  ) {
    // the negative streak is lost 😂
    ModSettingSet(MOD_ID + ".streak", 0);

    // let the game render its streak
    sessionRender[0] = GLOBAL_STATS.session.streak;
    prevBestRender[0] = GLOBAL_STATS.highest.streak;
    restoreRecord();
    return;
  }

  let streak = (ModSettingGet(MOD_ID + ".streak") || 0) as number;
  streak = streak + 1;
  ModSettingSet(MOD_ID + ".streak", streak);

  let worst = (ModSettingGet(MOD_ID + ".worst") || 0) as number;
  if (streak >= worst) {
    // this follows game behaviour with streaks, we show RECORD! of number is >= previous best,
    // and we update the saved value, but show the previous one which is one lower than the new pb
    ModSettingSet(MOD_ID + ".worst", streak);
    forceRecord();
  } else {
    // RECORD! is never shown when you just died, so we keep the default behaviour here
    restoreRecord();
  }

  // we only do this for Noita Utility Box live stats tool to show it in the overlay
  GLOBAL_STATS.session.streak = -streak;

  // and render our negative streak
  sessionRender[0] = -streak;
  prevBestRender[0] = -worst;
});

if (DEV) {
  debug(sessionRender, prevBestRender);
}
