local modid = 'negative-streak'

local ffi = require 'ffi'
local bit = require 'bit'

dofile_once('data/scripts/lib/utilities.lua')

ffi.cdef [[
    bool VirtualProtect(void* adress, size_t size, int new_protect, int* old_protect);
    int memcmp(const void *buffer1, const void *buffer2, size_t count);

    void* malloc(size_t size);
]]

-- mostly stolen from disable-mod-restrictions
local function patch_location(location, expect, patch_bytes)
    if #expect ~= #patch_bytes then
        print_error("Patch size mismatch")
        return false
    end

    location = ffi.cast('void*', location)
    expect = ffi.new('char[?]', #expect, expect)
    patch_bytes = ffi.new('char[?]', #patch_bytes, patch_bytes)

    if ffi.C.memcmp(location, patch_bytes, ffi.sizeof(expect)) == 0 then
        -- Already patched
        return true
    end

    if ffi.C.memcmp(location, expect, ffi.sizeof(expect)) ~= 0 then
        local function print_array(ptr, len)
            local str = {}
            ptr = ffi.cast("unsigned char*", ptr)
            for i = 0, len - 1 do
                table.insert(str, ("%02x"):format(ptr[i]))
            end
            return table.concat(str, ", ")
        end

        print_error("Unexpected instructions at location: ", tostring(location))
        print_error("  Expected: ", print_array(expect, ffi.sizeof(expect)))
        print_error("  Actual:   ", print_array(location, ffi.sizeof(expect)))
        print_error()
        return false
    end

    local restore_protection = ffi.new("int[1]")
    local prot_success = ffi.C.VirtualProtect(
        location, ffi.sizeof(patch_bytes), 0x40, restore_protection
    )

    if not prot_success then
        print_error("Couldn't change memory protection.")
        return false
    end

    ffi.copy(location, patch_bytes, ffi.sizeof(patch_bytes) --[[ @as number ]])

    -- Restore protection
    ffi.C.VirtualProtect(
        location,
        ffi.sizeof(patch_bytes),
        restore_protection[0],
        restore_protection
    )

    return true
end

local our_memory

-- check the first patch and if it's there,
-- grab the address from it instead of making more leaks
-- (and failing to apply the patches cuz mismatch)
local mod_reload_hack = ffi.cast('unsigned char*', 0x006e5eb4)

if mod_reload_hack[0] == 0xBA and mod_reload_hack[5] == 0x90 then
    our_memory = ffi.cast('void*', bit.bor(
        bit.lshift(mod_reload_hack[4], 24),
        bit.lshift(mod_reload_hack[3], 16),
        bit.lshift(mod_reload_hack[2], 8),
        mod_reload_hack[1]
    ))
else
    -- ffi.new allocates the memory tied to the lua state or smth, so we just malloc
    our_memory = ffi.C.malloc(8)
end

local prev_best_render = ffi.cast('int*', our_memory)
local session_render = ffi.cast('int*', tonumber(ffi.cast('int', our_memory)) + 4)

-- remove the check for highest streak being > 0
-- when choosing if to show the streak in the game over screen at all
patch_location(
    0x006e5e8d,
    { 0x7c, 0x7d }, -- JL(short) 0x7d
    { 0x66, 0x90 }  -- NOP2 (NOP but with the prefix thingy)
)

-- remove the check for prev_best.streak being >= 1
-- when choosing if to show the RECORD! thing
patch_location(
    0x006e5e97,
    { 0x7e, 0x0c }, -- JLE(short) 0x0c
    { 0x66, 0x90 }  -- NOP2
)

local function make_mov_patch(ptr)
    local offset = tonumber(ffi.cast('int', ptr)) --[[ @as number ]]
    return {
        0xBA, -- MOV EDX, imm32
        bit.band(offset, 0xff),
        bit.band(bit.rshift(offset, 8), 0xff),
        bit.band(bit.rshift(offset, 16), 0xff),
        bit.band(bit.rshift(offset, 24), 0xff),
        0x90, -- NOP
    }
end

-- change the address from which the number in parentheses is read
-- when rendering the streak in the game over screen
patch_location(
    0x006e5eb4,
    -- LEA EDX, [EBP - 0x1b4]
    --   Sets EDX to address of global_stats.prev_best.streak,
    --   where global_stats is a local copy of GLOBAL_STATS global
    --   (all names are from my labels for things in ghidra lul)
    { 0x8d, 0x95, 0x4c, 0xfe, 0xff, 0xff },
    make_mov_patch(prev_best_render)
)

-- change the address from which the streak number is read
-- when rendering the streak in the game over screen
patch_location(
    0x006e5ec8,
    -- LEA EDX, [EBP - 0x40c]
    --   Same as above but for global_stats.session.streak
    { 0x8d, 0x95, 0xf4, 0xfb, 0xff, 0xff },
    make_mov_patch(session_render)
)

local function force_record()
    -- skip the actual check of session.streak >= prev_best.streak
    patch_location(0x006e5e9f, { 0x7c, 0x04 }, { 0x66, 0x90 })
end

local function unforce_record()
    -- undo the above, duh
    patch_location(0x006e5e9f, { 0x66, 0x90 }, { 0x7c, 0x04 })
end

-- GLOBAL_STATS.prev_best.streak
local prev_best_game = ffi.cast('int*', 0x01206ba4)

-- GLOBAL_STATS.session.streak
local session_game = ffi.cast('int*', 0x0120694c)

function OnPlayerDied()
    -- if you won
    if GameHasFlagRun('ending_game_completed') or MagicNumbersGetValue('DEBUG_ALWAYS_COMPLETE_THE_GAME') ~= '0' then
        -- the negative streak is lost
        ModSettingSet(modid .. '.streak', 0)

        -- let the game render its streak
        prev_best_render[0] = prev_best_game[0]
        session_render[0] = session_game[0]
        unforce_record()
        return
    end

    local streak = ModSettingGet(modid .. '.streak') or 0
    streak = streak + 1
    ModSettingSet(modid .. '.streak', streak)

    local worst = ModSettingGet(modid .. '.worst') or 0
    if streak >= worst then
        ModSettingSet(modid .. '.worst', streak)
        force_record()
    else
        unforce_record()
    end

    prev_best_render[0] = -worst
    session_render[0] = -streak
end

local DEBUG = false

if DEBUG then
    SetWorldSeed(605142017)

    local debug_gui = nil

    session_render[0] = -ModSettingGet(modid .. '.streak') or 0
    prev_best_render[0] = -ModSettingGet(modid .. '.worst') or 0

    local function render_debug_info(shade)
        if not debug_gui then
            debug_gui = GuiCreate()
        end
        GuiStartFrame(debug_gui)

        GuiColorSetForNextWidget(debug_gui, shade, shade, shade, 1)
        GuiText(debug_gui, 65, 0, ('game: %d %d | render: %d %d'):format(
            session_game[0],
            prev_best_game[0],
            session_render[0],
            prev_best_render[0]
        ))

        GuiColorSetForNextWidget(debug_gui, shade, shade, shade, 1)
        local left, right = GuiButton(debug_gui, 1, 65, 8, '[reset]')
        if left then
            ModSettingSet(modid .. '.streak', 0)
            session_render[0] = 0
        end
        if right then
            ModSettingSet(modid .. '.worst', 0)
            prev_best_render[0] = 0
        end

        GuiColorSetForNextWidget(debug_gui, shade, shade, shade, 1)
        left, right = GuiButton(debug_gui, 2, 100, 8, '[die/win]')
        if left then
            local players = EntityGetWithTag 'player_unit'
            if #players ~= 0 then
                EntityInflictDamage(players[1], 999999, "DAMAGE_PHYSICS_HIT", "suicide", "NORMAL", 0, 0)
            end
        end
        if right then
            GameAddFlagRun('ending_game_completed')
            local players = EntityGetWithTag 'player_unit'
            if #players ~= 0 then
                EntityInflictDamage(players[1], 999999, "DAMAGE_PHYSICS_HIT", "he won", "NORMAL", 0, 0)
            end
        end
    end

    function OnWorldPreUpdate()
        render_debug_info(1)
    end

    function OnPausePreUpdate()
        render_debug_info(0.5)
    end
end
