let express = require('express');
let app = express();
const bodyParser = require('body-parser');
const spawn = require('child_process').spawn;
const split2 = require('split2');

app.use(bodyParser.urlencoded({extended: true}));

const state = {
	current_ytlink: ""
}

app.get('/', (req, res)=>{
	res.render('index.ejs', state);
})

app.post('/load', async (req, res)=>{
	state.current_ytlink = req.body.ytlink;
	if (state.proc) {
		state.proc.kill();
		state.proc = null;
	}

	try {
		let fmtCode = await new Promise((resolve, reject)=>{
			let fmtCode = null;
			let proc = spawn('youtube-dl', ['-F', state.current_ytlink])
			proc.stdout.pipe(split2()).on('data', (data)=>{
				if (fmtCode) return;
				let match = data.match(/(\d+)\s+m4a\s+audio only/);
				if (match && match[1]) fmtCode = match[1];
			})
			proc.on('exit', ()=>{
				if (fmtCode) {
					resolve(fmtCode)
				} else {
					reject("no m4a audio only format for this video, if its even a valid yt link")
				}
			});
		});
		console.log("fmt code is", fmtCode);

		let realURL = await new Promise((resolve, reject)=>{
			let link = null;
			let proc = spawn('youtube-dl', ['-f', fmtCode, '-g', state.current_ytlink])
			proc.stdout.pipe(split2()).on('data', (data)=>{
				if (data.length > 0) link = data;
			})
			proc.on('exit', ()=>{
				if (fmtCode) {
					resolve(link)
				} else {
					reject("no link");
				}
			});
		});
		console.log("link is", realURL);

		let ffargs = ['-i', realURL]
		if (req.body.seek_minutes) {
			ffargs.push('-ss');
			ffargs.push('00:'+req.body.seek_minutes.padStart(2, '0')+':00');
		}
		ffargs.push('-content_type');
		ffargs.push('audio/aac');
		ffargs.push('icecast://source:h0st911@127.0.0.1:80/stream.aac');

		state.proc = spawn('ffmpeg', ffargs);
		state.proc.stdout.pipe(process.stdout);
		state.proc.stderr.pipe(process.stderr);
	} catch(err) {
		console.error(err.message);
	}

	res.redirect('/');
});


app.listen(3000);
