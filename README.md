# Audio Player Lib
a audio player in nodejs for linux and windows (other platforms are not tested)

you need nodejs and for linux you need [`mplayer`](http://www.mplayerhq.hu/design7/news.html) at `/usr/bin/mplayer`

than you can simply type in a other project
`npm install audio-player-lib`

than you can use the package

```
const audioPlayerLib=require("audio-player-lib");
const player=audioPlayerLib.createPlayer();

player.addTrack({
	name: "Song",	// optional
	src:"song.mp3",	// required
});

console.log(player.getPlayerKey("tracks"));
player.play();

setTimeout(player.stop,1e4);
setInterval(()=>{
	const isPlaying=player.getPlayerKey("isPlaying");
	console.log(isPlaying?"Wiedergabe Läuft ...":"Keine Wiedergabe!");
},1e3)
```
