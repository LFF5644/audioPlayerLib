const child_process=require("child_process");
const fs=require("fs");
const players={};
const trackTemplate={
	id: null,
	name: null,
	src: null,
};
const platform=process.platform==="win32"?"windows":process.platform;

function addTrack(id,object){
	const player=players[id];
	if(typeof(object)==="string"){object={src:object}}
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

	const tracks=player.getPlayerKey("tracks");
	if(tracks.length===0){
		console.warn("Keine Wiedergabe möglich Warteschlange leer!");
		return;
	}
	const trackIndex=player.getPlayerKey("trackIndex");
	const track=tracks[trackIndex];

	console.log(`Playing: ${track.name?track.name:track.src}`);

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
			if(
				signal==="SIGUSR1"&&
				code===null
			){
				player.nextTrack();
			}
		}));
	}
	else{
		player.setPlayerKey("playerProcess",child_process.spawn("/usr/bin/mplayer",[
			track.src,"-softvol","-softvol-max","90",
		]));
		player.getPlayerKey("playerProcess").on("exit",(code,signal)=>{
			console.log("mplayer exit code "+code+" and signal "+signal);
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
		});
		player.getPlayerKey("playerProcess").stdout.on("data",buffer=>{
			//process.stdout.write(buffer);
		});
	}
}
function nextTrack(id){
	const player=players[id];
	const tracks=player.getPlayerKey("tracks");
	let trackIndex=player.getPlayerKey("trackIndex");
	const tracksLength=tracks.length-1;

	trackIndex+=1;

	if(trackIndex>tracksLength){
		trackIndex=0;
	}

	if(player.getPlayerKey("isPlaying")){
		trackIndex-=1;
		player.setPlayerKey("trackIndex",trackIndex);
		player.killProcess("SIGUSR1");
	}else{
		player.setPlayerKey("trackIndex",trackIndex);
		player.play();
	}
}
function pause(id){
	const player=players[id];
	if(player.getPlayerKey("isPlaying")){
		player.setPlayerKey("isPlaying",false);
		player.killProcess();
		if(platform==="windows"){
			child_process.exec("taskkill -f -im wscript.exe");
		}
	}
}
function killProcess(id,signal="SIGINT"){
	const player=players[id];
	try{
		player.getPlayerKey("playerProcess").kill(signal);
	}catch(e){}
	player.setPlayerKey("playerProcess",null);
}
function stop(id){
	const player=players[id];
	player.pause();
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
		playerProcess: null,
		trackIndex: 0,
		tracks:[],
		killProcess: signal=> killProcess(id,signal),
		setPlayer:()=> setPlayer(id),
		setPlayerKey: (key,value)=> setPlayerKey(id,key,value),

	};
	return playerCommands;
}
function shutdown(){
	for(const playerId of Object.keys(players)){
		const player=players[playerId];
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
