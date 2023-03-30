const child_process=require("child_process");
let tracks=[];
let playIndex=0;
const trackTemplate={
	id: null,
	name: null,
	src: null,
};

function addTrack(track){
	const track={
		...trackTemplate,
		...track,
	};
	if(track.id) tracks.push(track);
}
function addTracks(tracks){
	for(const track of tracks){
		addTrack(track);
	}
}
function removeTrack(id){
	tracks=tracks.filter(item=>item.id!==id);
}
function play(){
	console.log("this is coming later... o_o");
}

module.exports={
	addTrack,
	addTracks,
	removeTrack,
	play,
};
