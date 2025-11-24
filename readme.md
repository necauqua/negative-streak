## Negative Streak

![preview](https://storage.modworkshop.net/mods/images/t9YaJgRIOsrxH8Q8Z2qejvMIBujAVH6oiGGuPYC9.webp)

This mod patches the Noita engine to show a "negative streak" counter in the
"streaks" stat (which usually shows winstreaks), counting the number of
consecutive runs where you died and showing them with a negative sign.

Usually the game does not show winstreaks with mods installed, so this mod
also includes another small patch to the engine to reenable them, meaning you
can use it to make the game show winstreaks when playing with mods.

Note that as a consequence of that, the winstreaks are counted
(and can be lost) during daily runs/nightmare/twitch integration as well
(they are considered mods by the game).

### Installation

The mod patches the engine assembly code, which cannot be done without it
"requesting unsafe API permissions", so it cannot be uploaded to the
Steam Workshop and you have to install it manually from here.

Download the `negative-streak.zip` zip file from the
[releases](https://github.com/necauqua/negative-streak/releases) page or from the
[mod workshop](https://modworkshop.net/mod/49379) and unpack it into your
`mods` folder.

The `mods` folder can be found next to the `noita.exe` file wherever the game
is installed on your system. If using Steam, you can right click on the game in
your library, select "Manage" -> "Browse local files" to open the game folder,
the `mods` folder should be there.

The zip file contains a single folder named `negative-streak`, and that folder
should be placed in your `mods` folder, after which the mod should appear in
your mod list in game.

### Building from source

Unlike most Noita mods, this mod is written in TypeScript and then transpiled
to Lua using the [Noita-TS](https://github.com/necauqua/noita-ts) project.

This adds a build step to it, so if you want to do it yourself, you can clone
this repo and run those commands:

```bash
npm install
npx nts build
```

This will create the `dist/negative-streak.zip` file.

If you have Noita installed through Steam, you can also run `npx nts run` to
have noita-ts create and launch an isolated Noita instance with a dev build
(includes debug features) of the mod installed, it's very convenient, and also
turbo-untested on Windows.

### License
This mod is licensed under the MIT license. See the LICENSE file for details.
