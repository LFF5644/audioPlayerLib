# Audio Player Lib
a audio player in nodejs for linux

you need nodejs and for linux you need [`mplayer`](http://www.mplayerhq.hu/design7/news.html) at `/usr/bin/mplayer`

than you can simply type in a other project
`npm install git+ssh://git@github.com:LFF5644/audioPlayerLib.git`

than you can use the package

```
const audio=require("audioPlayerLib");
const player=audio.createPlayer();

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
