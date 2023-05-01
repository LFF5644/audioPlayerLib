const child_process=require("child_process");
const fs=require("fs");
const players=new Map();
const trackTemplate={
	id: null,
	name: null,
	src: null,
};
const platform=process.platform==="win32"?"windows":process.platform;
const optionsTemplate={
	repeat: "all",
	onEnd: (track,end)=>{
		//console.log("Played: "+(track.name?track.name:track.src));
		if(end){
			console.log("Playback finished!");
		}
	},
	onPlay: track=>{
		console.log("Playing: "+(track.name?track.name:track.src));
	},
	onAddTrack: track=>{
		//console.log("Add to Playback list: "+(track.name?entry.name:track.src));
	}
};

function addTrack(id,object){
	const player=getPlayer(id);
	if(typeof(object)==="string"){object={src:object}}
	const track={
		...trackTemplate,
		...object,
		id: Date.now(),
	};
	if(!track.id) return;

	if(player.onAddTrack(track)===false) return;

	player.setPlayerKey("tracks",[
		...player.getPlayerKey("tracks"),
		track,
	]);
}
function play(id){
	const player=getPlayer(id);
	if(player.getPlayerKey("isPlaying")){
		return false;
	}
	player.setPlayerKey("isPlaying",true);

	const tracks=player.getPlayerKey("tracks");
	if(tracks.length===0){
		console.warn("Keine Wiedergabe möglich Warteschlange leer!");
		return;
	}
	const trackIndex=player.getPlayerKey("trackIndex");
	const track=tracks[trackIndex];

	if(player.onPlay(track)===false){
		player.onEnd(track,true);
		return;
	};

	if(platform==="windows"){
		const fileName=`_player_${Date.now()}.vbs`
		fs.writeFileSync(fileName,`\
			Set Sound=CreateObject("WMPlayer.OCX.7")
			Sound.URL="${track.src}"
			Sound.Controls.play
			do while Sound.currentmedia.duration=0
			wscript.sleep 100
			loop
			wscript.sleep(int(Sound.currentmedia.duration)+1)*1000\
		`.split("\t").join(""));
		player.setPlayerKey("playerProcess",child_process.exec("start \"\" /wait C:\\Windows\\System32\\wscript.exe "+fileName,(error,stdout,stderr)=>{
			child_process.exec(`del /Q /F "${fileName}"`);
			console.log("wscript exit code "+code+" and signal "+signal);
			player.setPlayerKey("isPlaying",false);
			player.setPlayerKey("isPlaying",false);
			if(
				signal==="SIGUSR1"&&
				code===null
			){
				player.nextTrack();
			}
			else if(
				signal===null&&
				code===0
			){
				player.nextTrack();
			}
			else{
				player.onEnd(track,true);
			}
		}));
	}
	else{
		player.setPlayerKey("playerProcess",child_process.spawn("/usr/bin/mplayer",[
			track.src,"-softvol","-softvol-max","90",
		]));
		player.getPlayerKey("playerProcess").on("exit",(code,signal)=>{
			//console.log("mplayer exit code "+code+" and signal "+signal);
			player.setPlayerKey("isPlaying",false);
			if(
				signal==="SIGUSR1"&&
				code===null
			){
				player.nextTrack();
			}
			else if(
				signal===null&&
				code===0
			){
				player.nextTrack();
			}
			else{
				player.onEnd(track,true);
			}
		});
		player.getPlayerKey("playerProcess").stdout.on("data",buffer=>{
			//process.stdout.write(buffer);
		});
	}
}
function nextTrack(id){
	const player=getPlayer(id);
	const tracks=player.getPlayerKey("tracks");
	let trackIndex=player.getPlayerKey("trackIndex");
	const tracksLength=tracks.length-1;

	if(player.repeat!=="track") trackIndex+=1;

	if(trackIndex>tracksLength){
		if(player.repeat==="nothing"){
			player.onEnd(player.getPlayerKey("tracks")[player.getPlayerKey("trackIndex")],true);
			return;
		}
		trackIndex=0;
	}

	if(player.getPlayerKey("isPlaying")){
		trackIndex-=1;
		player.setPlayerKey("trackIndex",trackIndex);
		player.killProcess("SIGUSR1");
	}else{
		player.onEnd(player.getPlayerKey("tracks")[player.getPlayerKey("trackIndex")],false);
		player.setPlayerKey("trackIndex",trackIndex);
		player.play();
	}
}
function pause(id){
	const player=getPlayer(id);
	if(player.getPlayerKey("isPlaying")){
		player.setPlayerKey("isPlaying",false);
		player.killProcess();
		if(platform==="windows"){
			child_process.exec("taskkill -f -im wscript.exe");
		}
	}
}
function killProcess(id,signal="SIGINT"){
	const player=getPlayer(id);
	try{
		player.getPlayerKey("playerProcess").kill(signal);
	}catch(e){}
	player.setPlayerKey("playerProcess",null);
}
function stop(id){
	const player=getPlayer(id);
	player.pause();
	player.setPlayerKey("trackIndex",0);
}
function getPlayer(id){
	//return getPlayer(id);
	return players.get(id);
}
function getPlayerKey(id,key){
	//return getPlayer(id)[key];
	return players.get(id)[key];
}
function setPlayer(id,object){
	//getPlayer(id)=object;
	players.set(id,object);
}
function addPlayerKeys(id,object){
	players.set(id,{
		...players.get(id),
		...object,
	});
}
function setPlayerKey(id,key,value){
	//getPlayer(id)[key]=value;
	players.set(id,{
		...players.get(id),
		[key]: value,
	});
}
function createPlayer(options){

	options=!options?optionsTemplate:{
		...optionsTemplate,
		...options,
	};

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
	setPlayer(id,{
		...options,
		...playerCommands,
		isPlaying: false,
		playerProcess: null,
		trackIndex: 0,
		tracks:[],
		addPlayerKeys: object=> addPlayerKeys(id,object),
		killProcess: signal=> killProcess(id,signal),
		setPlayer: object=> setPlayer(id,object),
		setPlayerKey: (key,value)=> setPlayerKey(id,key,value),

	});
	return playerCommands;
}
function shutdown(){
	for(const player of players.entries()){
		player.killProcess();
	}
}

process.on('exit',shutdown);
process.on('SIGINT',shutdown);
process.on('SIGUSR1',shutdown);
process.on('SIGUSR2',shutdown);

module.exports={
	createPlayer,
};
