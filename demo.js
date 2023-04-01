#!/usr/bin/env node
const audioPlayerLib=require("./main");
const player=audioPlayerLib.createPlayer();
const [node, thisFile, ...tracks]=process.argv;

if(tracks.length===0){
	const examplePath=process.platform==="win32"?"C:\\path\\to\\musik\\file\\":"/path/to/file/";
	console.log("Keine Tracks mit gegeben!");
	console.log(`${node} ${thisFile.includes(" ")?'"'+thisFile+'"':thisFile} "${examplePath+"datei1.mp3"}" "${examplePath+"datei2.mp3"}"`);
	process.exit(1);
}

for(const track of tracks){
	console.log(`Add Track: "${track}"`);
	player.addTrack(track);
}

process.stdin.on("data",buffer=>{
	const text=buffer
		.toString("utf-8")
		.trim()
	
	if(text==="play") player.play();
	else if(text==="stop") player.stop();
	else if(text==="pause") player.pause();
	else if(text==="skip") player.nextTrack();
	else if(text==="exit") process.exit(1);
	else console.log("command not found");
});

process.stdout.write("ready for command!\n$ ");
