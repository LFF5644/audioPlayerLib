const child_process=require("child_process");
const players={};
const trackTemplate={
	id: null,
	name: null,
	src: null,
};
const platform=process.platform==="win32"?"windows":process.platform;

function addTrack(id,object){
	const player=players[id];
	const track={
		...trackTemplate,
		...object,
		id: Date.now(),
	};
	if(!track.id) return;

	player.setPlayerKey("tracks",[
		...player.getPlayerKey("tracks"),
		track,
	]);
}
function play(id){
	const player=players[id];
	if(player.getPlayerKey("isPlaying")){
		return false;
	}
	player.setPlayerKey("isPlaying",true);
	const src=player.getPlayerKey("tracks")[player.getPlayerKey("trackIndex")];
	if(platform==="windows"){
		throw new Error("Windows is not allowed ....");
	}
	else{
		const tracks=player.getPlayerKey("tracks");
		const trackIndex=player.getPlayerKey("trackIndex");
		const track=tracks[trackIndex];

		player.setPlayerKey("playerProcess",child_process.spawn("/usr/bin/mplayer",[
			track.src,"-softvol","-softvol-max","90",
		]));
		player.getPlayerKey("playerProcess").on("exit",code=>{
			player.setPlayerKey("playerProcess",undefined);
			if(player.getPlayerKey("isPlaying")){
				player.setPlayerKey("isPlaying",false);
				player.nextTrack();
			}
		});
		player.getPlayerKey("playerProcess").stdout.on("data",buffer=>{
			process.stdout.write(buffer);
		});

		console.log(`Playing: ${track.name?track.name:track.src}`);
	}
}
function nextTrack(id){
	const player=players[id];
	if(player.getPlayerKey("isPlaying")){
		player.setPlayerKey("isPlaying",false);
		player.getPlayerKey("playerProcess").kill();
		player.setPlayerKey("playerProcess",undefined);
	}
	const tracks=player.getPlayerKey("tracks");
	let trackIndex=player.getPlayerKey("trackIndex");
	const tracksLength=tracks.length-1;

	trackIndex+=1;

	if(trackIndex>tracksLength){
		trackIndex=0;
	}

	player.setPlayerKey("trackIndex",trackIndex);
	player.play();
}
function pause(id){
	const player=players[id];
	if(player.getPlayerKey("isPlaying")){
		player.setPlayerKey("isPlaying",false);
		player.getPlayerKey("playerProcess").kill();
		player.setPlayerKey("playerProcess",undefined);
	}
	
}
function stop(id){
	const player=players[id];
	if(player.getPlayerKey("isPlaying")){
		player.pause();
	}
	player.setPlayerKey("trackIndex",0);
}
function getPlayer(id){
	return players[id];
}
function getPlayerKey(id,key){
	return players[id][key];
}
function setPlayer(id,object){
	players[id]=object;
}
function setPlayerKey(id,key,value){
	players[id][key]=value;
}
function createPlayer(){
	const id=Date.now();
	const playerCommands={
		addTrack: track=> addTrack(id,track),
		getPlayer:()=> getPlayer(id),
		getPlayerKey: key=> getPlayerKey(id,key),
		nextTrack:()=> nextTrack(id),
		pause:()=> pause(id),
		play:()=> play(id),
		stop:()=> stop(id),
	};
	players[id]={
		...playerCommands,
		isPlaying: false,
		trackIndex: 0,
		tracks:[],
		setPlayer:()=> setPlayer(id),
		setPlayerKey: (key,value)=> setPlayerKey(id,key,value),

	};
	return playerCommands;
}

module.exports={
	createPlayer,
};
