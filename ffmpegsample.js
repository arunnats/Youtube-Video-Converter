const cp = require("child_process");
const readline = require("readline");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename"); // Import sanitize-filename module
const ffmpeg = "./ffmpeg/bin/ffmpeg.exe";

const url = "https://www.youtube.com/watch?v=2SUwOgmvzK4";
const format = "mp4";

async function downloadVideo() {
	const info = await ytdl.getInfo(url);
	const sanitizedTitle = sanitize(info.videoDetails.title);
	const outputFileName = `${sanitizedTitle}.${format}`;

	// Get audio and video streams
	const audio = ytdl(url, { quality: "highestaudio" });
	const video = ytdl(url, { quality: "highestvideo" });

	// Start the ffmpeg child process
	const ffmpegProcess = cp.spawn(
		ffmpeg,
		[
			"-loglevel",
			"8",
			"-hide_banner",
			"-progress",
			"pipe:3",
			"-i",
			"pipe:4",
			"-i",
			"pipe:5",
			"-map",
			"0:a",
			"-map",
			"1:v",
			"-c:v",
			"copy",
			outputFileName,
		],
		{
			windowsHide: true,
			stdio: ["inherit", "inherit", "inherit", "pipe", "pipe", "pipe"],
		}
	);

	ffmpegProcess.on("close", () => {
		console.log("done");
	});

	// Link streams
	ffmpegProcess.stdio[3].on("data", (chunk) => {
		const lines = chunk.toString().trim().split("\n");
		const args = {};
		for (const l of lines) {
			const [key, value] = l.split("=");
			args[key.trim()] = value.trim();
		}
	});
	audio.pipe(ffmpegProcess.stdio[4]);
	video.pipe(ffmpegProcess.stdio[5]);
}

downloadVideo().catch(console.error);
