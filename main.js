const child_process=require("child_process");
const socketIo=require("socket.io");

const DEBUG=Boolean(process.env.audioPlayerLib_DEBUG);
const platform=process.platform==="win32"?"windows":process.platform;
const players=new Map();

const optionsTemplate={
	socketPort: null,
	repeat: "all",
	onEnd: track=>{
		console.log("Played: "+(track.name?track.name:track.src));
	},
	onPlay: track=>{
		console.log(`Playing ${track.album?("Album: "+track.album+", "):""}${track.discNumber!==null?("Disc: "+track.discNumber+", "):null} Track: ${track.name?track.name:track.src}`);
	},
	onAddTrack: track=>{
		//console.log("Add to Playback list: "+(track.name?entry.name:track.src));
	},
	onPause: ()=>{

	},
};
const trackTemplate={
	album: null,
	discNumber: null,
	id: null,
	name: null,
	src: null,
	trackNumber: null,
};

function addTrack(id,object){
	const player=getPlayer(id);
	if(typeof(object)==="string"){object={src:object}}
	const track={
		...trackTemplate,
		...object,
		id: String(Math.random()+""+Date.now()).substring(2).toString(36),
	};
	if(!track.id) return;

	if(player.onAddTrack(track)===false) return;

	player.setPlayerKey("tracks",[
		...player.getPlayerKey("tracks"),
		track,
	]);
}
function play(id,object=null){
	const player=getPlayer(id);
	if(typeof(object)!=="object"){
		const res=player.startPlayback(object);
		return res;
	}
	else if(object===null){
		const res=player.startPlayback();
		return res;
	}

	let trackIndex=-2;
	
	if(object.name){
		trackIndex=player.tracks.findIndex(item=>item.name===object.name);
	}
	else if(object.src){
		trackIndex=player.tracks.findIndex(item=>item.src===object.src);
	}
	else if(object.album){
		let inAlbum=(player.tracks
			.map((item,index)=>item.album!==object.album?null:{
				...item,
				index,
			})
			.filter(Boolean)	// {...} -> true; null -> false
		);
		if(inAlbum.length===0) throw new Error("Album '"+object.album+"' not found!");
		
		if(inAlbum.some(item=>typeof(item.discNumber)==="number"&&item.discNumber>0)){
			let requiredDiscNumber=1;
			if(!object.discNumber) requiredDiscNumber=inAlbum.find(item=>typeof(item.discNumber)==="number"&&item.discNumber>0).discNumber;
			else if(object.discNumber) requiredDiscNumber=object.discNumber;

			inAlbum=inAlbum.filter(item=>item.discNumber===requiredDiscNumber);
		}

		if(!object.trackNumber||object.trackNumber==1){
			const indexToSearch=inAlbum.findIndex(item=>item.trackNumber===1);
			if(indexToSearch===-1){
				trackIndex=inAlbum[0].index;
			}
			else{
				trackIndex=inAlbum[indexToSearch].index;
			}
		}
		else{
			const indexToSearch=inAlbum.findIndex(item=>item.trackNumber===object.trackNumber);
			if(indexToSearch===-1){
				console.log(`Album "${object.album}" don't hast track number "${object.trackNumber}"`);
				console.log(`Album "${object.album}" tracks: ${player.tracks
					.map((item,index)=>item.album!==object.album?null:{
						...item,
						index,
					})
					.filter(Boolean)
					.filter(item=>item.trackNumber!==null)
					.map(item=>item.trackNumber)
					.join(", ")
				}`);
				trackIndex=inAlbum[0].index;
			}
			else{
				trackIndex=inAlbum[indexToSearch].index;
			}
		}

	}

	if(trackIndex===-1) throw new Error("track not found!");
	else if(trackIndex===-2) throw new Error("wrong method!");

	player.startPlayback(trackIndex);
	return trackIndex;
}
function startPlayback(id,index=-1){
	const player=getPlayer(id);
	if(player.getPlayerKey("isPlaying")){
		if(index==-1) return false;
		player.killProcess();
	}

	const tracks=player.getPlayerKey("tracks");
	if(tracks.length===0){
		console.warn("Keine Wiedergabe möglich Warteschlange leer!");
		return;
	}
	if(index!==-1) player.setPlayerKey("trackIndex",index);
	const trackIndex=index!==-1?index:false||player.getPlayerKey("trackIndex");
	const track=tracks[trackIndex];

	if(player.onPlay(track)===false){
		return;
	};
	player.setPlayerKey("isPlaying",true);
	if(player.socketServer) player.sendCurrentlyPlaying();
	if(platform==="windows"){
		throw new Error("PLATFORM WINDOWS NOT SUPPORTED!");
		/*const fileName=`_player_${Date.now()}.vbs`
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
				player.onEnd(track);
			}
		}));*/
	}
	else{
		player.setPlayerKey("playerProcess",child_process.spawn("/usr/bin/mplayer",[
			track.src,"-softvol","-softvol-max","90",
		]));
		player.getPlayerKey("playerProcess").on("exit",(code,signal)=>{
			//console.log("mplayer exit code "+code+" and signal "+signal);
			if(
				(
					signal===null||
					signal==="SIGUSR1"
				)&&(
					code===null||
					code===0
				)
			){
				const tracks=player.getPlayerKey("tracks");
				const tracksLength=tracks.length-1;
				let trackIndex=player.getPlayerKey("trackIndex");

				if(player.repeat!=="track") trackIndex+=1;

				if(trackIndex>tracksLength){
					if(player.repeat==="nothing"){
						player.setPlayerKey("isPlaying",false);
						player.setPlayerKey("playerProcess",null);
						player.onEnd(tracks[trackIndex]);
						return;
					}
					trackIndex=0;
				}

				player.startPlayback(trackIndex);
			}
			else{
				console.log("mplayer exit code "+code+" and signal "+signal);
			}
		});
		player.getPlayerKey("playerProcess").stdout.on("data",buffer=>{
			//process.stdout.write(buffer);
		});
	}
}
function nextTrack(id){
	const player=getPlayer(id);

	if(player.getPlayerKey("isPlaying")) player.killProcess("SIGUSR1");
	else{
		const tracksLength=player.getPlayerKey("tracks").length-1;
		let trackIndex=player.getPlayerKey("trackIndex");
		
		trackIndex+=1;
		if(trackIndex>tracksLength) trackIndex=0;

		player.startPlayback(trackIndex);
	}
}
function previousTrack(id){
	const player=getPlayer(id);

	const tracksLength=player.getPlayerKey("tracks").length-1;
	let trackIndex=player.getPlayerKey("trackIndex");

	trackIndex-=1;

	if(trackIndex<0) trackIndex=tracksLength;

	if(player.getPlayerKey("isPlaying")) player.killProcess();

	player.play(trackIndex);
}
function pause(id){
	const player=getPlayer(id);
	if(player.getPlayerKey("isPlaying")){
		player.killProcess();
		if(player.socketServer) player.sendCurrentlyPlaying();
		if(player.onPause) player.onPause();
	}
}
function killProcess(id,signal="SIGINT"){
	const player=getPlayer(id);
	try{
		player.getPlayerKey("playerProcess").kill(signal);
	}catch(e){}
	player.setPlayerKey("playerProcess",null);
	player.setPlayerKey("isPlaying",false);
	if(platform==="windows"){
		child_process.exec("taskkill -f -im wscript.exe");
	}
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
function createSocketServer(id,port){
	const {
		getPlayerKey,
		nextTrack,
		pause,
		play,
		previousTrack,
		sendCurrentlyPlaying,
		setPlayerKey,
		stop,
	}=getPlayer(id);

	const socketServer=new socketIo.Server(port,{cors:{origin:"*"}});
	socketServer.on("connection",socket=>{
		socket.on("get-trackIndex",()=>{
			socket.emit("set-trackIndex",getPlayerKey("trackIndex"));
		});
		socket.on("get-tracks",()=>{
			socket.emit("set-tracks",getPlayerKey("tracks"));
		});
		socket.on("set-playback",(playerArgs,callback=()=>{})=>{
			callback(play(playerArgs));
		});
		socket.on("action-playback",(action,callback=()=>{})=>{
			let result;
			if(action==="pause") result=pause();
			else if(action==="stop") result=stop();
			else if(action==="nextTrack") result=nextTrack();
			else if(action==="previousTrack") result=previousTrack();
			else result="error";
			callback(result);
		});
		sendCurrentlyPlaying();
	});
	return socketServer;
}
function sendCurrentlyPlaying(id){
	const {
		getPlayerKey,
		socketServer,
	}=getPlayer(id);
	socketServer.emit("currentlyPlaying",{
		trackIndex: getPlayerKey("trackIndex"),
		isPlaying: getPlayerKey("isPlaying"),
		track: getPlayerKey("tracks")[getPlayerKey("trackIndex")],
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
		play: object=> play(id,object),
		previousTrack:()=> previousTrack(id),
		startPlayback: object=> startPlayback(id,object),
		stop:()=> stop(id),
	};
	const player={
		...options,
		...playerCommands,
		isPlaying: false,
		playerProcess: null,
		socketServer: null,
		trackIndex: 0,
		tracks:[],
		addPlayerKeys: object=> addPlayerKeys(id,object),
		killProcess: signal=> killProcess(id,signal),
		sendCurrentlyPlaying:()=> sendCurrentlyPlaying(id),
		setPlayer: object=> setPlayer(id,object),
		setPlayerKey: (key,value)=> setPlayerKey(id,key,value),

	};
	setPlayer(id,player);
	if(options.socketPort){
		const socketServer=createSocketServer(id,options.socketPort);
		player.setPlayerKey("socketServer",socketServer);
		player.socketPort=socketServer;
	}
	return(
		DEBUG
		?	player
		:	playerCommands
	);
}
function shutdown(){
	for(const [id,player] of players.entries()){
		console.log("Stopping player "+id);
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
